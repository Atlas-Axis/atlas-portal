import { Client as NotionClient } from '@notionhq/client';
import { NotionRateLimiter } from '@/app/server/services/notion/rate-limiter';

// Read Notion API keys from environment variables
// For read operations, use the NOTION_SECRETS_READ variable (plural, as multiple keys allowed with comma separation)
// For write operations, use the NOTION_SECRET_WRITE variable
const notionSecretsForReading = process.env.NOTION_SECRETS_READ?.split(',')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

const notionSecretForWriting = process.env.NOTION_SECRET_WRITE;

if (!notionSecretsForReading || notionSecretsForReading.length === 0) {
  throw new Error('Missing NOTION_SECRETS_READ or NOTION_SECRET in environment variables');
}
if (!notionSecretForWriting) {
  throw new Error('Missing NOTION_SECRET_WRITE in environment variables');
}

interface NotionClientWithRateLimiter {
  client: NotionClient;
  rateLimiter: NotionRateLimiter;
  activeRequests: number;
}

/**
 * Notion proxy that manages multiple API clients with rate limiting and load balancing
 */
export class NotionProxy {
  private clients: NotionClientWithRateLimiter[] = [];
  private totalApiCalls = 0;

  constructor(secrets: string[]) {
    console.log(`🔧 Initializing Notion proxy with ${secrets.length} API client(s)`);

    this.clients = secrets.map((secret) => ({
      client: new NotionClient({ auth: secret }),
      rateLimiter: new NotionRateLimiter(),
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

// Singleton instances
let notionProxyReadInstance: NotionProxy | null = null;
let notionProxyWriteInstance: NotionProxy | null = null;

/**
 * Get the singleton NotionProxy instance with lazy initialization
 * @param mode - 'read' or 'write' mode to determine which Notion API key to use (read-only API access vs write API access)
 */
export function notion(mode: 'read' | 'write' = 'read'): NotionProxy & NotionClient {
  if (mode === 'read') {
    if (!notionProxyReadInstance) {
      if (!notionSecretsForReading) {
        throw new Error('NOTION_SECRETS_READ is undefined');
      }
      notionProxyReadInstance = new NotionProxy(notionSecretsForReading);
    }
    return notionProxyReadInstance as NotionProxy & NotionClient;
  } else {
    if (!notionProxyWriteInstance) {
      if (!notionSecretForWriting) {
        throw new Error('NOTION_SECRET_WRITE is undefined');
      }
      notionProxyWriteInstance = new NotionProxy([notionSecretForWriting]);
    }
    return notionProxyWriteInstance as NotionProxy & NotionClient;
  }
}
