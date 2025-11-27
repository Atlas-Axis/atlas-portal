import { Client as NotionClient } from '@notionhq/client';
import { DEBUG_LOGGING } from '@/app/shared/utils/is-debug-logging-enabled';
import { ParallelNotionRateLimiter } from './parallel-rate-limiter';

/**
 * Reads and validates Notion API key from environment variables.
 * Supports multiple comma-separated API keys for load balancing.
 * Throws if required secret is missing.
 */
function getNotionApiKeys(): string[] {
  const notionApiKeys = process.env.NOTION_API_KEY?.split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (!notionApiKeys || notionApiKeys.length === 0) {
    throw new Error('Missing NOTION_API_KEY in environment variables');
  }
  return notionApiKeys;
}

interface NotionClientWithRateLimiter {
  client: NotionClient;
  rateLimiter: ParallelNotionRateLimiter;
  activeRequests: number;
}

/**
 * Notion proxy that manages multiple API clients with rate limiting and load balancing
 */
export class NotionProxy {
  private clients: NotionClientWithRateLimiter[] = [];
  private totalApiCalls = 0;

  constructor(secrets: string[]) {
    if (DEBUG_LOGGING()) {
      console.log(`Initializing Notion proxy with ${secrets.length} API client(s)`);
    }

    this.clients = secrets.map((secret) => ({
      client: new NotionClient({ auth: secret }),
      rateLimiter: new ParallelNotionRateLimiter(),
      activeRequests: 0,
    }));

    // Return a Proxy that automatically intercepts property access
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        // If the property exists on the NotionProxy instance itself, return it
        if (prop in target) {
          return Reflect.get(target, prop, receiver);
        }

        // Otherwise, create a proxy for the Notion client property
        return target.createNotionPropertyProxy(prop as keyof NotionClient);
      },
    }) as unknown as NotionProxy & NotionClient;
  }

  /**
   * Get the next available client with the least active requests
   */
  private getNextAvailableClient(): NotionClientWithRateLimiter {
    // Find the client with the least active requests
    return this.clients.reduce((best, current) => (current.activeRequests < best.activeRequests ? current : best));
  }

  /**
   * Execute an API call with automatic client selection and rate limiting
   */
  private async executeApiCall<T>(apiCall: (client: NotionClient) => Promise<T>): Promise<T> {
    const clientWithLimiter = this.getNextAvailableClient();

    clientWithLimiter.activeRequests++;
    this.totalApiCalls++;

    try {
      return await clientWithLimiter.rateLimiter.add(() => apiCall(clientWithLimiter.client));
    } finally {
      clientWithLimiter.activeRequests--;
    }
  }

  /**
   * Creates a proxy for any Notion client property (blocks, pages, databases, etc.)
   */
  private createNotionPropertyProxy(prop: keyof NotionClient): unknown {
    return new Proxy(
      {},
      {
        get: (_, nestedProp) => {
          return this.createNestedProxy([prop, nestedProp]);
        },
      },
    );
  }

  /**
   * Creates a nested proxy that can handle arbitrarily deep property access
   */
  private createNestedProxy(path: (string | symbol)[]): unknown {
    // Use arrow function to preserve 'this' context
    const proxyFunction = (...args: unknown[]) => {
      // If called as a function, execute the API call
      return this.executeApiCall((client: NotionClient) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let current: any = client;
        for (const prop of path) {
          current = current[prop];
        }
        return current(...args);
      });
    };

    return new Proxy(proxyFunction, {
      get: (_, nestedProp) => {
        // If accessed as a property, extend the path and return another proxy
        return this.createNestedProxy([...path, nestedProp]);
      },
    });
  }

  /**
   * Get statistics about the proxy clients
   */
  getNotionProxyStats() {
    return {
      totalClients: this.clients.length,
      totalApiCalls: this.totalApiCalls,
    };
  }
}

// Singleton instance
let notionProxyInstance: NotionProxy | null = null;

/**
 * Get the singleton NotionProxy instance with lazy initialization.
 * Uses NOTION_API_KEY environment variable (supports comma-separated keys for load balancing).
 */
export function notion(): NotionProxy & NotionClient {
  if (!notionProxyInstance) {
    const apiKeys = getNotionApiKeys();
    notionProxyInstance = new NotionProxy(apiKeys);
  }
  return notionProxyInstance as NotionProxy & NotionClient;
}
