import { vi } from 'vitest';

/**
 * Mock implementation of the Notion API client for testing.
 *
 * This class provides a mock of the Notion API client without making actual API calls.
 * It stores Notion pages and databases in-memory and simulates Notion API behaviors including
 * error conditions, validation, and state management.
 *
 * **Key Features:**
 * - In-memory storage for pages and databases
 * - Complete call logging for test verification
 * - Realistic error handling (e.g., object_not_found, validation_error)
 * - Parent validation (enforces database_id parent type per project standards)
 * - Timestamps and metadata tracking
 *
 * **Usage in Tests:**
 *
 * @example
 * ```typescript
 * import { describe, it, expect, beforeEach } from 'vitest';
 * import { mockNotionClient } from './notion-client.mock';
 *
 * describe('My Feature', () => {
 *   beforeEach(() => {
 *     mockNotionClient.reset(); // Clear state between tests
 *   });
 *
 *   it('should retrieve a page', async () => {
 *     // Setup: Add a mock page
 *     const pageId = 'test-page-id';
 *     mockNotionClient.addMockPage(pageId, {
 *       properties: { Name: { title: [{ text: { content: 'Test' } }] } }
 *     });
 *
 *     // Act: Retrieve the page
 *     const page = await mockNotionClient.pages.retrieve({ page_id: pageId });
 *
 *     // Assert
 *     expect(page).toBeDefined();
 *     expect(mockNotionClient.getCallCount('pages.retrieve')).toBe(1);
 *   });
 *
 *   it('should create a page in a database', async () => {
 *     // Setup: Add a mock database
 *     const dbId = 'test-db-id';
 *     mockNotionClient.addMockDatabase(dbId);
 *
 *     // Act: Create a page
 *     const newPage = await mockNotionClient.pages.create({
 *       parent: { type: 'database_id', database_id: dbId },
 *       properties: { Name: { title: [{ text: { content: 'New Page' } }] } }
 *     });
 *
 *     // Assert
 *     expect(newPage.id).toBeDefined();
 *     expect(mockNotionClient.get(newPage.id)).toBeDefined();
 *   });
 * });
 * ```
 *
 * **Mocking the Notion Client Module:**
 *
 * @example
 * ```typescript
 * import { vi, beforeEach } from 'vitest';
 * import { mockNotionClient } from './notion-client.mock';
 *
 * // Mock the notion client module
 * vi.mock('@/app/server/services/notion/notion-client', () => ({
 *   getNotionClient: () => mockNotionClient,
 * }));
 *
 * beforeEach(() => {
 *   mockNotionClient.reset();
 * });
 * ```
 *
 * **Important Notes:**
 * - Always call `reset()` between tests to clear state
 * - Pages must be added to databases that exist (use `addMockDatabase` first)
 * - Parent type must be 'database_id' (enforced per project architecture)
 * - All operations are logged in `callLog` for verification
 * - Error codes match Notion API conventions (object_not_found, validation_error)
 */
export class NotionClientMock {
  /**
   * In-memory storage for mock pages.
   * Maps page_id (string) to page objects matching Notion API structure.
   * @private
   */
  private pagesMap: Map<string, unknown> = new Map();

  /**
   * In-memory storage for mock databases.
   * Maps database_id (string) to database objects matching Notion API structure.
   * Public to allow test inspection if needed.
   */
  databases: Map<string, unknown> = new Map();

  /**
   * Complete log of all API calls made during testing.
   * Useful for verifying call counts, arguments, and timing.
   * Each entry contains: method name, arguments, and timestamp.
   */
  callLog: Array<{ method: string; args: unknown; timestamp: Date }> = [];

  /**
   * Mock implementation of the Notion Pages API.
   * Provides retrieve, update, and create operations with realistic behavior.
   */
  pages = {
    /**
     * Retrieves a page by its ID.
     *
     * @param page_id - The Notion page ID to retrieve
     * @returns The page object if found
     * @throws Error with code 'object_not_found' if page doesn't exist
     *
     * @example
     * ```typescript
     * const page = await mockNotionClient.pages.retrieve({ page_id: 'test-id' });
     * ```
     */
    retrieve: vi.fn(async ({ page_id }: { page_id: string }) => {
      this.callLog.push({ method: 'pages.retrieve', args: { page_id }, timestamp: new Date() });

      const page = this.pagesMap.get(page_id);
      if (!page) {
        const error = new Error('Page not found') as Error & { code?: string };
        error.code = 'object_not_found';
        throw error;
      }
      return page;
    }),

    /**
     * Updates an existing page's properties or archive status.
     *
     * @param page_id - The Notion page ID to update
     * @param properties - Optional properties to update (merged with existing)
     * @param archived - Optional archive status
     * @returns The updated page object
     * @throws Error with code 'object_not_found' if page doesn't exist
     *
     * @example
     * ```typescript
     * const updated = await mockNotionClient.pages.update({
     *   page_id: 'test-id',
     *   properties: { Name: { title: [{ text: { content: 'Updated' } }] } },
     *   archived: false
     * });
     * ```
     */
    update: vi.fn(
      async ({ page_id, properties, archived }: { page_id: string; properties?: unknown; archived?: boolean }) => {
        this.callLog.push({ method: 'pages.update', args: { page_id, properties, archived }, timestamp: new Date() });

        const page = this.pagesMap.get(page_id) as Record<string, unknown> | undefined;
        if (!page) {
          const error = new Error('Page not found') as Error & { code?: string };
          error.code = 'object_not_found';
          throw error;
        }

        // Update mock page (merge properties, update metadata)
        const updated = {
          ...page,
          properties: properties ? { ...(page.properties as object), ...(properties as object) } : page.properties,
          archived: archived !== undefined ? archived : page.archived,
          last_edited_time: new Date().toISOString(),
        };
        this.pagesMap.set(page_id, updated);
        return updated;
      },
    ),

    /**
     * Creates a new page in a database.
     *
     * **CRITICAL:** Parent type MUST be 'database_id' per project architecture.
     * Pages in Notion databases must have database as parent, not another page.
     * Hierarchy is managed through relationship properties, not page parents.
     *
     * @param parent - Parent object with type 'database_id' and database_id
     * @param properties - Page properties matching database schema
     * @returns The newly created page object with generated ID
     * @throws Error if parent type is not 'database_id'
     * @throws Error with code 'validation_error' if database doesn't exist
     *
     * @example
     * ```typescript
     * // First, ensure database exists
     * mockNotionClient.addMockDatabase('db-123');
     *
     * // Then create page
     * const newPage = await mockNotionClient.pages.create({
     *   parent: { type: 'database_id', database_id: 'db-123' },
     *   properties: {
     *     Name: { title: [{ text: { content: 'My Page' } }] },
     *     Status: { select: { name: 'Active' } }
     *   }
     * });
     * ```
     */
    create: vi.fn(
      async ({ parent, properties }: { parent: { type: string; database_id: string }; properties: unknown }) => {
        this.callLog.push({ method: 'pages.create', args: { parent, properties }, timestamp: new Date() });

        // Verify parent is database_id (enforced by project architecture)
        if (parent.type !== 'database_id') {
          throw new Error(`Invalid parent type: ${parent.type}. Only database_id is supported.`);
        }

        // Verify database exists
        const db = this.databases.get(parent.database_id);
        if (!db) {
          const error = new Error('Database not found') as Error & { code?: string };
          error.code = 'validation_error';
          throw error;
        }

        // Create new page with generated ID
        const newPageId = `mock-page-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const newPage = {
          id: newPageId,
          object: 'page',
          parent,
          properties,
          archived: false,
          created_time: new Date().toISOString(),
          last_edited_time: new Date().toISOString(),
        };
        this.pagesMap.set(newPageId, newPage);
        return newPage;
      },
    ),
  };

  // ============================================================================
  // Test Helper Methods
  // ============================================================================

  /**
   * Adds a mock page to the in-memory storage for testing.
   *
   * This is a convenience method for setting up test data. The page will be
   * available for retrieval, update operations.
   *
   * @param pageId - The page ID to use (should be unique)
   * @param data - Optional page data to customize the mock page
   * @returns The created page object
   *
   * @example
   * ```typescript
   * // Add a simple page
   * mockNotionClient.addMockPage('page-1');
   *
   * // Add a page with custom properties
   * mockNotionClient.addMockPage('page-2', {
   *   properties: {
   *     Name: { title: [{ text: { content: 'Test Page' } }] },
   *     Status: { select: { name: 'Active' } }
   *   },
   *   archived: false
   * });
   * ```
   */
  addMockPage(pageId: string, data: Record<string, unknown> = {}) {
    const page = {
      id: pageId,
      object: 'page',
      parent: data.parent || { type: 'database_id', database_id: 'mock-db' },
      properties: data.properties || {},
      archived: data.archived || false,
      created_time: data.created_time || new Date().toISOString(),
      last_edited_time: data.last_edited_time || new Date().toISOString(),
      ...data,
    };
    this.pagesMap.set(pageId, page);
    return page;
  }

  /**
   * Adds a mock database to the in-memory storage for testing.
   *
   * Databases must exist before pages can be created in them. Always call this
   * before using `pages.create()` or when setting up pages with `addMockPage()`.
   *
   * @param dbId - The database ID to use (should be unique)
   * @param data - Optional database data to customize the mock database
   * @returns The created database object
   *
   * @example
   * ```typescript
   * // Add a simple database
   * mockNotionClient.addMockDatabase('db-1');
   *
   * // Add a database with custom title
   * mockNotionClient.addMockDatabase('db-2', {
   *   title: [{ text: { content: 'My Custom Database' } }]
   * });
   * ```
   */
  addMockDatabase(dbId: string, data: Record<string, unknown> = {}) {
    const database = {
      id: dbId,
      object: 'database',
      title: data.title || [{ text: { content: 'Mock Database' } }],
      ...data,
    };
    this.databases.set(dbId, database);
    return database;
  }

  /**
   * Resets all mock state to a clean slate.
   *
   * **IMPORTANT:** Always call this in `beforeEach()` to ensure test isolation.
   * Clears all pages, databases, call logs, and vitest mock call counts.
   *
   * @example
   * ```typescript
   * beforeEach(() => {
   *   mockNotionClient.reset();
   * });
   * ```
   */
  reset() {
    this.pagesMap.clear();
    this.databases.clear();
    this.callLog = [];
    // Reset vitest mock call counts
    this.pages.retrieve.mockClear();
    this.pages.update.mockClear();
    this.pages.create.mockClear();
  }

  /**
   * Retrieves a page from the mock storage by ID.
   *
   * This is a direct accessor to the internal storage, bypassing the
   * `pages.retrieve` API method. Useful for verifying page state in tests
   * without triggering call logs.
   *
   * @param pageId - The page ID to retrieve
   * @returns The page object if found, undefined otherwise
   *
   * @example
   * ```typescript
   * const page = mockNotionClient.get('page-1');
   * expect(page).toBeDefined();
   * expect(page.archived).toBe(false);
   * ```
   */
  get(pageId: string) {
    return this.pagesMap.get(pageId);
  }

  /**
   * Gets the total number of times a specific API method was called.
   *
   * @param method - The method name (e.g., 'pages.retrieve', 'pages.create')
   * @returns The number of calls made to that method
   *
   * @example
   * ```typescript
   * await mockNotionClient.pages.retrieve({ page_id: 'test' });
   * await mockNotionClient.pages.retrieve({ page_id: 'test2' });
   * expect(mockNotionClient.getCallCount('pages.retrieve')).toBe(2);
   * ```
   */
  getCallCount(method: string): number {
    return this.callLog.filter((c) => c.method === method).length;
  }

  /**
   * Gets the most recent call to a specific API method.
   *
   * @param method - The method name (e.g., 'pages.update')
   * @returns The last call object with method, args, and timestamp, or undefined if no calls
   *
   * @example
   * ```typescript
   * await mockNotionClient.pages.update({ page_id: 'test', archived: true });
   * const lastCall = mockNotionClient.getLastCall('pages.update');
   * expect(lastCall?.args).toEqual({ page_id: 'test', archived: true });
   * ```
   */
  getLastCall(method: string): { method: string; args: unknown; timestamp: Date } | undefined {
    const calls = this.callLog.filter((c) => c.method === method);
    return calls[calls.length - 1];
  }

  /**
   * Gets all calls to a specific API method in chronological order.
   *
   * @param method - The method name (e.g., 'pages.create')
   * @returns Array of call objects with method, args, and timestamp
   *
   * @example
   * ```typescript
   * await mockNotionClient.pages.create({ parent: {...}, properties: {...} });
   * await mockNotionClient.pages.create({ parent: {...}, properties: {...} });
   * const calls = mockNotionClient.getAllCalls('pages.create');
   * expect(calls).toHaveLength(2);
   * expect(calls[0].args).toEqual(...);
   * ```
   */
  getAllCalls(method: string): Array<{ method: string; args: unknown; timestamp: Date }> {
    return this.callLog.filter((c) => c.method === method);
  }
}

// ============================================================================
// Exported Utilities
// ============================================================================

/**
 * Global singleton instance of the mock Notion client.
 *
 * Use this shared instance across all tests for consistency. Remember to call
 * `reset()` in `beforeEach()` to ensure test isolation.
 *
 * @example
 * ```typescript
 * import { mockNotionClient } from './notion-client.mock';
 *
 * // In test setup
 * beforeEach(() => {
 *   mockNotionClient.reset();
 * });
 *
 * // In tests
 * it('should work', async () => {
 *   mockNotionClient.addMockPage('test-id');
 *   const page = await mockNotionClient.pages.retrieve({ page_id: 'test-id' });
 *   expect(page).toBeDefined();
 * });
 * ```
 */
export const mockNotionClient = new NotionClientMock();

/**
 * Factory function to create or return the mock Notion client.
 *
 * This function is designed to be used with `vi.mock()` to replace the real
 * Notion client module. It returns the global singleton instance.
 *
 * @returns The global mockNotionClient instance
 *
 * @example
 * ```typescript
 * // In test file
 * vi.mock('@/app/server/services/notion/notion-client', () => ({
 *   getNotionClient: () => createMockNotionClient(),
 * }));
 * ```
 */
export function createMockNotionClient() {
  return mockNotionClient;
}
