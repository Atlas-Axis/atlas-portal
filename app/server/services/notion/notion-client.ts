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
export function notion(mode: 'read' | 'write' = 'read'): NotionProxy {
  if (mode === 'read') {
    if (!notionProxyReadInstance) {
      notionProxyReadInstance = new NotionProxy(notionSecretsForReading);
    }
    return notionProxyReadInstance;
  } else {
    if (!notionProxyWriteInstance) {
      if (!notionSecretForWriting) {
        throw new Error('NOTION_SECRET_WRITE is undefined');
      }
      notionProxyWriteInstance = new NotionProxy([notionSecretForWriting]);
    }
    return notionProxyWriteInstance;
  }
}
