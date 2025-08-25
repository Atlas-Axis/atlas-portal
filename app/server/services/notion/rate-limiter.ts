import { delay } from '@/app/server/utils/utils';

/**
 * Rate limiter for Notion API requests using sliding window
 */
export class NotionRateLimiter {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;
  private requestTimestamps: number[] = [];
  private readonly windowSizeMs = 1000; // 1 second
  private readonly maxRequestsPerWindow = 3; // 3 requests per 1 second max

  // Add an API request to the queue by passing a function that returns a Promise
  async add<T>(apiCall: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await this.executeWithRetry(apiCall);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.processing) {
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

        return await apiCall();
      } catch (error: unknown) {
        lastError = error;

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
          console.log(`Rate limited, retrying after ${delayMs}ms (attempt ${attempt}/${maxRetries})`);
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
      throw new Error(`Max retries (${maxRetries}) exceeded for API request`);
    } else {
      // Re-throw the original error for non-429 errors
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
        // console.log(`Rate limit reached, waiting ${waitTime}ms before next request`);
        await delay(waitTime);
        // Clean up again after waiting
        const newNow = Date.now();
        this.requestTimestamps = this.requestTimestamps.filter((timestamp) => newNow - timestamp < this.windowSizeMs);
      }
    }
  }

  private async processQueue() {
    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        await task();
      }
    }

    this.processing = false;
  }
}
