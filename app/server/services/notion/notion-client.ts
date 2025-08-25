import { Client as NotionClient } from '@notionhq/client';
import { NotionRateLimiter } from '@/app/server/services/notion/rate-limiter';

// Check for multiple secrets first, fallback to single secret for backward compatibility
const notionSecrets =
  process.env.NOTION_SECRETS?.split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0) || (process.env.NOTION_SECRET ? [process.env.NOTION_SECRET] : []);

if (notionSecrets.length === 0) {
  throw new Error('Missing NOTION_SECRETS or NOTION_SECRET in environment variables');
}

interface NotionClientWithRateLimiter {
  client: NotionClient;
  rateLimiter: NotionRateLimiter;
  activeRequests: number;
}

/**
 * Notion proxy that manages multiple API clients with rate limiting and load balancing
 */
class NotionProxy {
  private clients: NotionClientWithRateLimiter[] = [];
  private totalApiCalls = 0;

  constructor(secrets: string[]) {
    console.log(`🔧 Initializing Notion proxy with ${secrets.length} API client(s)`);

    this.clients = secrets.map((secret) => ({
      client: new NotionClient({ auth: secret }),
      rateLimiter: new NotionRateLimiter(),
      activeRequests: 0,
    }));
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
   * Proxy for notion.blocks.children.list
   */
  get blocks() {
    return {
      children: {
        list: (params: Parameters<NotionClient['blocks']['children']['list']>[0]) =>
          this.executeApiCall((client) => client.blocks.children.list(params)),
      },
      retrieve: (params: Parameters<NotionClient['blocks']['retrieve']>[0]) =>
        this.executeApiCall((client) => client.blocks.retrieve(params)),
    };
  }

  /**
   * Proxy for notion.pages
   */
  get pages() {
    return {
      retrieve: (params: Parameters<NotionClient['pages']['retrieve']>[0]) =>
        this.executeApiCall((client) => client.pages.retrieve(params)),
      update: (params: Parameters<NotionClient['pages']['update']>[0]) =>
        this.executeApiCall((client) => client.pages.update(params)),
    };
  }

  /**
   * Proxy for notion.databases
   */
  get databases() {
    return {
      query: (params: Parameters<NotionClient['databases']['query']>[0]) =>
        this.executeApiCall((client) => client.databases.query(params)),
      retrieve: (params: Parameters<NotionClient['databases']['retrieve']>[0]) =>
        this.executeApiCall((client) => client.databases.retrieve(params)),
    };
  }

  /**
   * Get statistics about the proxy clients
   */
  getNotionProxyStats() {
    return {
      totalClients: this.clients.length,
      totalApiCalls: this.totalApiCalls,
      clientStats: this.clients.map((client, index) => ({
        index,
        activeRequests: client.activeRequests,
      })),
    };
  }
}

// Singleton instance
let notionProxyInstance: NotionProxy | null = null;

/**
 * Get the singleton NotionProxy instance with lazy initialization
 */
export function notion(): NotionProxy {
  if (!notionProxyInstance) {
    notionProxyInstance = new NotionProxy(notionSecrets);
  }
  return notionProxyInstance;
}
