import { delay } from '@/app/server/utils/utils';

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
  private readonly apiTimeoutMs = 30_000; // 30 second timeout for API calls
  private readonly queueTimeoutMs = 60_000; // 1 minute timeout for queue processing
  private readonly enableLogging: boolean;

  constructor(enableLogging = true) {
    this.enableLogging = enableLogging;
  }

  private log(level: 'info' | 'warn' | 'error', message: string, data?: unknown) {
    if (!this.enableLogging) return;

    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [NotionRateLimiter] [${level.toUpperCase()}] ${message}`;

    if (data) {
      console[level](logMessage, data);
    } else {
      console[level](logMessage);
    }
  }

  // Add an API request to the queue by passing a function that returns a Promise
  async add<T>(apiCall: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      // Create a timeout for the entire queue operation
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
          this.log('error', 'API call failed after retries', { error });
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

  private async executeWithRetry<T>(apiCall: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
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

        this.log('info', `API call successful on attempt ${attempt}`);
        return apiResult;
      } catch (error: unknown) {
        lastError = error;
        this.log('warn', `API call failed on attempt ${attempt}/${maxRetries}`, { error });

        // Handle non-retryable errors
        const apiError = error as { status?: number; headers?: Record<string, string> };

        // Handle rate limiting (HTTP 429)
        if (apiError?.status === 429 && attempt < maxRetries) {
          const retryAfter = apiError?.headers?.['retry-after'];
          // Calculate delay based on Retry-After header or exponential backoff
          const baseDelayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, attempt) * 1000;
          // Add jitter (±25% randomness) to prevent thundering herd effect
          const jitter = baseDelayMs * 0.25 * Math.random();
          const delayMs = Math.max(100, Math.round(baseDelayMs + jitter)); // Minimum 100ms delay
          this.log('warn', `Rate limited, retrying after ${delayMs}ms (attempt ${attempt}/${maxRetries})`);
          await delay(delayMs);
          continue;
        }

        // If it's not a retryable error or we've exhausted retries, break out of the loop
        break;
      }
    }

    // If we get here, all retries were exhausted
    const apiError = lastError as { status?: number };
    if (apiError?.status === 429) {
      const errorMessage = `Max retries (${maxRetries}) exceeded for API request`;
      this.log('error', errorMessage);
      throw new Error(errorMessage);
    } else {
      // Re-throw the original error for non-429 errors
      this.log('error', 'API call failed with non-retryable error', { error: lastError });
      throw lastError;
    }
  }

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

    this.log('info', `Starting queue processing with ${this.queue.length} tasks`);

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

      this.log('info', 'Queue processing completed successfully');
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
