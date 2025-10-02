import { delay } from '@/app/shared/utils/utils';

const MAX_RETRIES = 3;
const DEBUG_LOGGING = Boolean(Number(process.env.DEBUG_LOGGING));

/**
 * Rate limiter for Notion API requests using sliding window, and exponential backoff
 * with proper concurrency control, timeout handling, and comprehensive logging
 */
export class NotionRateLimiter {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private processingLock = false; // Mutex to prevent concurrent queue processing
  private requestTimestamps: number[] = [];
  private readonly windowSizeMs = 1000; // 1 second
  private readonly maxRequestsPerWindow = 3; // 3 requests per 1 second max
  private readonly apiTimeoutMs = 90_000; // 90 second timeout for API calls
  private readonly queueTimeoutMs = 180_000; // 180 second timeout for queued item processing
  private readonly enableLogging: boolean;

  constructor(enableLogging = true) {
    this.enableLogging = enableLogging;
  }

  private log(level: 'info' | 'warn' | 'error', message: string, data?: unknown) {
    if (!this.enableLogging) return;

    const timestamp = new Date().toUTCString().slice(17, 25); // HH:MM:SS format in UTC
    const prefix = level === 'info' ? '' : `[${timestamp} UTC]`;
    const logMessage = `${prefix} ${message}`;

    if (data) {
      console[level](logMessage, data);
    } else {
      console[level](logMessage);
    }
  }

  // Add an API request to the queue by passing a function that returns a Promise
  async add<T>(apiCall: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      // Create a timeout for the entire queued operation
      const queueTimeout = setTimeout(() => {
        this.log('error', 'Queue operation timed out', { timeoutMs: this.queueTimeoutMs });
        reject(new Error(`Queue operation timed out after ${this.queueTimeoutMs}ms`));
      }, this.queueTimeoutMs);

      this.queue.push(async () => {
        try {
          clearTimeout(queueTimeout);
          const result = await this.executeWithRetry(apiCall);
          resolve(result);
        } catch (error) {
          clearTimeout(queueTimeout);
          this.log('error', 'Notion API call failed after retries', { error });
          reject(error);
        }
      });

      // Use async scheduling to prevent race conditions in queue processing
      this.scheduleQueueProcessing();
    });
  }

  /**
   * Schedule queue processing with concurrency control to prevent race conditions
   */
  private scheduleQueueProcessing() {
    // Use setImmediate to ensure async scheduling and prevent blocking
    setImmediate(() => {
      if (!this.processingLock && this.queue.length > 0) {
        this.processQueue();
      }
    });
  }

  private async executeWithRetry<T>(apiCall: () => Promise<T>, maxRetries = MAX_RETRIES): Promise<T> {
    let lastError: unknown = null;
    let realRetryCount = 0; // Count only actual API errors, not rate limiting

    while (true) {
      // Capture start time for duration calculation
      const startTime = Date.now();

      try {
        // Check if we need to wait before making the request
        await this.waitIfNeeded();

        // Record the request timestamp - used by the sliding window
        this.requestTimestamps.push(Date.now());

        // Add timeout to the API call to prevent hanging
        const apiResult = await Promise.race([
          apiCall(),
          new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error(`API call timed out after ${this.apiTimeoutMs}ms`));
            }, this.apiTimeoutMs);
          }),
        ]);

        const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
        const retryInfo = realRetryCount > 0 ? ` on retry ${realRetryCount}` : '';
        // Only log successful requests when DEBUG_LOGGING is enabled or if there were retries
        if (DEBUG_LOGGING || realRetryCount > 0) {
          this.log('info', `Notion API call succeeded${retryInfo} (${durationSeconds}s)`);
        }
        return apiResult;
      } catch (error: unknown) {
        lastError = error;
        const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);

        const apiError = error as { status?: number; headers?: Record<string, string> };

        // Handle rate limiting (HTTP 429) - doesn't count as a retry
        if (apiError?.status === 429) {
          const retryAfter = apiError?.headers?.['retry-after'];
          // Calculate delay based on Retry-After header or exponential backoff
          const baseDelayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, realRetryCount + 1) * 1000;
          // Add jitter (±25% randomness) to prevent thundering herd effect
          const jitter = baseDelayMs * 0.25 * Math.random();
          const delayMs = Math.max(100, Math.round(baseDelayMs + jitter)); // Minimum 100ms delay
          this.log(
            'warn',
            `Rate limited (429), retrying after ${delayMs}ms (${durationSeconds}s) - not counted as retry`,
          );
          await delay(delayMs);
          continue;
        }

        // This is a real API error - count it as a retry
        realRetryCount++;
        this.log('error', `Notion API call failed on retry ${realRetryCount}/${maxRetries} (${durationSeconds}s)`, {
          error,
        });

        // If we've exhausted all retries for real API errors, break out
        if (realRetryCount >= maxRetries) {
          break;
        }

        // Wait before retrying (exponential backoff for real errors)
        const delayMs = Math.pow(2, realRetryCount) * 1000;
        this.log('warn', `API error, retrying after ${delayMs}ms (retry ${realRetryCount}/${maxRetries})`);
        await delay(delayMs);
      }
    }

    // If we get here, all retries were exhausted
    const errorMessage = `Max retries (${maxRetries}) exceeded for API request`;
    this.log('error', errorMessage, { lastError });
    throw new Error(errorMessage);
  }

  // Wait for the next available slot in the rate limit window, when we already exceeded the per-second limit
  private async waitIfNeeded(): Promise<void> {
    const now = Date.now();

    // Remove timestamps outside the sliding window
    this.requestTimestamps = this.requestTimestamps.filter((timestamp) => now - timestamp < this.windowSizeMs);

    // If we're at the limit, wait until the oldest request is outside the window
    if (this.requestTimestamps.length >= this.maxRequestsPerWindow) {
      const oldestRequest = this.requestTimestamps[0];
      const waitTime = this.windowSizeMs - (now - oldestRequest) + 10; // Add 10ms buffer
      if (waitTime > 0) {
        this.log('info', `Rate limit reached, waiting ${waitTime}ms before next request`);
        await delay(waitTime);
        // Clean up again after waiting
        const newNow = Date.now();
        this.requestTimestamps = this.requestTimestamps.filter((timestamp) => newNow - timestamp < this.windowSizeMs);
      }
    }
  }

  private async processQueue() {
    // Implement mutex-like behavior to prevent concurrent queue processing
    if (this.processingLock) {
      this.log('info', 'Queue processing already in progress, skipping');
      return;
    }

    this.processingLock = true;
    this.processing = true;

    // this.log('info', `Starting queue processing with ${this.queue.length} tasks`);

    try {
      while (this.queue.length > 0) {
        const task = this.queue.shift();
        if (task) {
          try {
            await task();
          } catch (error) {
            // Individual task errors are handled in the task itself
            // This catch is for any unexpected errors in task execution
            this.log('error', 'Unexpected error during task execution', { error });
          }
        }
      }

      // this.log('info', 'Queue processing completed successfully');
    } catch (error) {
      this.log('error', 'Critical error during queue processing', { error });
    } finally {
      this.processing = false;
      this.processingLock = false;

      // If new tasks were added while processing, schedule another processing round
      if (this.queue.length > 0) {
        this.log('info', `New tasks added during processing, scheduling another round (${this.queue.length} tasks)`);
        this.scheduleQueueProcessing();
      }
    }
  }

  /**
   * Get current queue status for monitoring
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      requestsInWindow: this.requestTimestamps.length,
      maxRequestsPerWindow: this.maxRequestsPerWindow,
      windowSizeMs: this.windowSizeMs,
    };
  }
}
