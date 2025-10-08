import { DEBUG_LOGGING } from '@/app/shared/utils/is-debug-logging-enabled';
import { delay } from '@/app/shared/utils/utils';

/**
 * A simpler, reliable rate limiter that supports controlled parallelism.
 *
 * Compatibility goals with NotionRateLimiter:
 * - Same constructor signature: new(enableLogging?: boolean)
 * - Same public methods: add<T>(apiCall), getStatus()
 *
 * Behavior improvements:
 * - Allows up to `maxRequestsPerWindow` concurrent starts within a sliding window
 * - Robust 429 Retry-After header handling (case-insensitive, Headers support)
 * - Cancellation-aware queue timeouts (task removed/skipped when timed out)
 * - Portable scheduling (setImmediate fallback)
 */
export class ParallelNotionRateLimiter {
  private queue: Array<{ id: number; run: () => Promise<void>; cancelled: boolean }> = [];
  private requestTimestamps: number[] = [];
  private inFlight = 0;
  private nextId = 1;
  private drainScheduled = false;

  private readonly windowSizeMs = 1000; // 1 second
  private readonly maxRequestsPerWindow = 3; // 3 requests per 1 second max
  private readonly apiTimeoutMs = 90_000; // 90 second timeout for API calls
  private readonly queueTimeoutMs = 180_000; // 180 second timeout for queued item processing
  private readonly maxRetries = 3;
  private readonly enableLogging: boolean;

  constructor(enableLogging = true) {
    this.enableLogging = enableLogging;
  }

  private log(level: 'info' | 'warn' | 'error', message: string, data?: unknown) {
    if (!this.enableLogging) return;
    if (!DEBUG_LOGGING() && level === 'info') return;

    const timestamp = new Date().toUTCString().slice(17, 25); // HH:MM:SS UTC
    const prefix = level === 'info' ? '' : `[${timestamp} UTC]`;
    const logMessage = `${prefix} ${message}`;

    if (data) {
      console[level](logMessage, data);
    } else {
      console[level](logMessage);
    }
  }

  async add<T>(apiCall: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = this.nextId++;
      let settled = false;
      const entry = { id, cancelled: false, run: async () => {} };

      const onSettle =
        <U>(fn: (v: U) => void) =>
        (v: U) => {
          if (!settled) {
            settled = true;
            fn(v);
          }
        };

      const resolveOnce = onSettle<T>((v) => resolve(v));
      const rejectOnce = onSettle<unknown>((e) => reject(e));

      const queueTimeout = setTimeout(() => {
        entry.cancelled = true;
        // Remove the entry if it's still in the queue
        this.queue = this.queue.filter((q) => q.id !== id);
        this.log('error', 'Queue operation timed out', { timeoutMs: this.queueTimeoutMs });
        rejectOnce(new Error(`Queue operation timed out after ${this.queueTimeoutMs}ms`));
      }, this.queueTimeoutMs);

      entry.run = async () => {
        if (entry.cancelled) return;
        clearTimeout(queueTimeout);
        try {
          const result = await this.executeWithRetry(apiCall);
          resolveOnce(result);
        } catch (error) {
          this.log('error', 'Notion API call failed after retries', { error });
          rejectOnce(error);
        }
      };

      this.queue.push(entry);
      this.schedule();
    });
  }

  private schedule() {
    if (this.drainScheduled) return;
    this.drainScheduled = true;
    const schedule = typeof setImmediate === 'function' ? setImmediate : (fn: () => void) => setTimeout(fn, 0);
    schedule(() => this.drain());
  }

  private async drain() {
    this.drainScheduled = false;
    // Start as many tasks as allowed right now
    while (this.queue.length > 0) {
      const now = Date.now();
      // Trim old timestamps outside window
      this.requestTimestamps = this.requestTimestamps.filter((t) => now - t < this.windowSizeMs);

      // Can we start another request right now?
      if (this.requestTimestamps.length >= this.maxRequestsPerWindow) {
        // Wait until the oldest timestamp falls out of the window, then reschedule
        const oldest = this.requestTimestamps[0];
        const waitMs = Math.max(0, this.windowSizeMs - (now - oldest));
        if (waitMs > 0) {
          this.log('info', `Rate limit reached, waiting ${waitMs}ms before starting next request`);
          setTimeout(() => this.schedule(), waitMs + 1);
          return;
        }
      }

      // Also respect current in-flight concurrency up to maxRequestsPerWindow
      if (this.inFlight >= this.maxRequestsPerWindow) {
        // Try later when in-flight decreases
        this.log('info', 'Max concurrency reached, deferring scheduling');
        this.schedule();
        return;
      }

      // Start next queued task
      const next = this.queue.shift();
      if (!next) break;
      if (next.cancelled) continue;

      this.requestTimestamps.push(Date.now());
      this.inFlight++;
      // Fire and forget, then reschedule when complete
      next
        .run()
        .catch(() => {})
        .finally(() => {
          this.inFlight--;
          this.schedule();
        });
    }
  }

  private async executeWithRetry<T>(apiCall: () => Promise<T>): Promise<T> {
    let retries = 0;
    let lastError: unknown = null;

    while (true) {
      const startedAt = Date.now();
      try {
        // Add timeout guard to the API call with safe loser suppression
        const result = await this.withTimeout(apiCall, this.apiTimeoutMs);

        const secs = ((Date.now() - startedAt) / 1000).toFixed(2);
        if (DEBUG_LOGGING() || retries > 0)
          this.log('info', `Notion API call succeeded${retries ? ` on retry ${retries}` : ''} (${secs}s)`);
        return result;
      } catch (error: unknown) {
        lastError = error;
        const secs = ((Date.now() - startedAt) / 1000).toFixed(2);

        // Handle 429 specially (does not count toward retries)
        if (this.isRateLimitedError(error)) {
          const delayMs = this.getRetryAfterDelayMs(error, retries);
          this.log('warn', `Rate limited (429), retrying after ${delayMs}ms (${secs}s) - not counted as retry`);
          await delay(delayMs);
          continue;
        }

        retries++;
        this.log('error', `Notion API call failed on retry ${retries}/${this.maxRetries} (${secs}s)`, { error });
        if (retries >= this.maxRetries) break;
        const backoff = Math.pow(2, retries) * 1000;
        this.log('warn', `API error, retrying after ${backoff}ms (retry ${retries}/${this.maxRetries})`);
        await delay(backoff);
      }
    }

    const msg = `Max retries (${this.maxRetries}) exceeded for API request`;
    this.log('error', msg, { lastError });
    throw new Error(msg);
  }

  private async withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    let timedOut = false;
    const apiPromise = fn();

    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        timedOut = true;
        reject(new Error(`API call timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      // Clear the timer when apiPromise settles to avoid leaks
      apiPromise.finally(() => clearTimeout(timer));
    });

    try {
      // Race api vs timeout
      return await Promise.race([apiPromise, timeoutPromise]);
    } finally {
      // If timeout won, suppress later apiPromise rejection to avoid unhandled rejection
      if (timedOut) {
        apiPromise.catch(() => {});
      }
    }
  }

  private isRateLimitedError(error: unknown): boolean {
    const status = this.getStatusCode(error);
    return status === 429;
  }

  private getRetryAfterDelayMs(error: unknown, retriesSoFar: number): number {
    const headers = this.getHeaders(error);
    const retryAfter = this.getHeaderCaseInsensitive(headers, 'retry-after');
    let baseMs: number;
    if (retryAfter) {
      const seconds = Number.parseInt(retryAfter, 10);
      if (!Number.isNaN(seconds)) {
        baseMs = Math.max(0, seconds * 1000);
      } else {
        // Support HTTP-date format per RFC7231 (e.g., Wed, 21 Oct 2015 07:28:00 GMT)
        const targetTime = Date.parse(retryAfter);
        if (!Number.isNaN(targetTime)) {
          const diff = targetTime - Date.now();
          baseMs = Math.max(0, diff);
        } else {
          baseMs = Math.pow(2, retriesSoFar + 1) * 1000;
        }
      }
    } else {
      baseMs = Math.pow(2, retriesSoFar + 1) * 1000;
    }
    // ±25% jitter to avoid alignment
    const jitterFactor = 0.75 + Math.random() * 0.5;
    const withJitter = Math.round(baseMs * jitterFactor);
    return Math.max(100, withJitter);
  }

  private getStatusCode(error: unknown): number | undefined {
    if (!error || typeof error !== 'object') return undefined;
    const anyErr = error as Record<string, unknown>;
    const directStatus = anyErr['status'];
    const response = anyErr['response'] as Record<string, unknown> | undefined;
    const code = anyErr['code'];
    const statusValue = directStatus ?? response?.['status'] ?? code;
    const numeric = typeof statusValue === 'string' ? Number(statusValue) : (statusValue as number | undefined);
    return typeof numeric === 'number' && !Number.isNaN(numeric) ? numeric : undefined;
  }

  private getHeaders(error: unknown): Headers | Record<string, string | number | undefined> | undefined {
    if (!error || typeof error !== 'object') return undefined;
    const anyErr = error as Record<string, unknown>;
    const headers = (anyErr['headers'] ?? (anyErr['response'] as Record<string, unknown> | undefined)?.['headers']) as
      | Headers
      | Record<string, string | number | undefined>
      | undefined;
    return headers;
  }

  private getHeaderCaseInsensitive(
    headers: Headers | Record<string, string | number | undefined> | undefined,
    name: string,
  ): string | null {
    if (!headers) return null;
    if (typeof Headers !== 'undefined' && headers instanceof Headers) {
      const v = headers.get(name);
      return v === null ? null : v;
    }
    if (this.isHeadersRecord(headers)) {
      const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
      if (!key) return null;
      const raw = headers[key];
      if (raw == null) return null;
      return String(raw);
    }
    return null;
  }

  private isHeadersRecord(
    headers: Headers | Record<string, string | number | undefined> | undefined,
  ): headers is Record<string, string | number | undefined> {
    if (!headers) return false;
    if (typeof Headers !== 'undefined' && headers instanceof Headers) return false;
    return typeof headers === 'object';
  }

  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.inFlight > 0,
      requestsInWindow: this.requestTimestamps.length,
      maxRequestsPerWindow: this.maxRequestsPerWindow,
      windowSizeMs: this.windowSizeMs,
      inFlight: this.inFlight,
    };
  }
}
