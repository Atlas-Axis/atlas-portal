// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDatabaseNameFromDocument } from '@/app/atlas/sync/_lib/atlas-database-mapper';
import { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import { ATLAS_DATABASE_ID_MAP } from '@/app/server/atlas/constants';
import { AtlasDocumentChange } from '@/app/server/atlas/diff/atlas-diff';
import { ExportAtlasTreeBaseDocument } from '@/app/server/atlas/export/types';
import { UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import { mockNotionClient } from '@/app/server/services/notion/__tests__/notion-client.mock';
import {
  createNotionDatabasePage,
  deleteNotionPage,
  updateNotionPageContent,
  validatePageExists,
} from '../sync-actions';

// Mock the notion client
vi.mock('@/app/server/services/notion/notion-client', () => ({
  notion: vi.fn(() => mockNotionClient as unknown),
}));

// Mock the audit log service
vi.mock('@/app/server/services/supabase/audit-log-service', () => ({
  logNotionApiOperation: vi.fn().mockResolvedValue(undefined),
  createSyncBatch: vi.fn(() => 'mock-batch-id'),
}));

// Mock the UUID mapping service
vi.mock('@/app/server/services/supabase/uuid-mapping-service', () => ({
  storeUuidMapping: vi.fn().mockResolvedValue(undefined),
  getNotionPageIdByAtlasUuid: vi.fn().mockResolvedValue(null),
}));

/**
 * Creates mock UUID mappings for testing.
 * Maps Atlas document UUIDs to Notion page IDs.
 * For simplicity in tests, the Atlas UUID and Notion page ID are the same.
 *
 * @param atlasUuids List of Atlas document UUIDs to include in the mapping
 */
function createMockUuidMappings(atlasUuids: string[]): UuidMappings {
  const notionPageIDsToAtlasUUIDs = new Map<string, string>();
  const atlasUUIDsToNotionPageIds = new Map<string, string>();

  for (const atlasUuid of atlasUuids) {
    // For simplicity in tests, use the same UUID for both Atlas and Notion
    // In production, these would be different UUIDs
    notionPageIDsToAtlasUUIDs.set(atlasUuid, atlasUuid);
    atlasUUIDsToNotionPageIds.set(atlasUuid, atlasUuid);
  }

  return { notionPageIDsToAtlasUUIDs, atlasUUIDsToNotionPageIds };
}

// Default empty mock UUID mappings for tests that don't need specific mappings
const emptyUuidMappings: UuidMappings = {
  notionPageIDsToAtlasUUIDs: new Map(),
  atlasUUIDsToNotionPageIds: new Map(),
};

/**
 * This file tests the Notion API sync actions for syncing Atlas documents from Markdown to Notion.
 * For the original Notion database properties and relationships, see:
 * @see app/server/atlas/notion-database-properties-and-relationships.ts
 */
describe('sync-actions', () => {
  beforeEach(() => {
    mockNotionClient.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create an Atlas document UUID to Atlas database name map from documents with proper Core/ADC handling
  function createDatabaseMap(
    documents: ExportAtlasTreeBaseDocument[],
    options: { coreDatabase?: AtlasDatabaseName } = {},
  ): Map<string, AtlasDatabaseName> {
    const map = new Map<string, AtlasDatabaseName>();
    const coreDatabase = options.coreDatabase || 'Sections & Primary Docs';

    // First pass: map all Core and ADC documents to the specified database
    for (const doc of documents) {
      if (doc.uuid && (doc.type === 'Core' || doc.type === 'Active Data Controller')) {
        map.set(doc.uuid, coreDatabase);
      }
    }

    // Second pass: map all other document types using getDatabaseNameFromDocument
    for (const doc of documents) {
      if (doc.uuid && doc.type !== 'Core' && doc.type !== 'Active Data Controller') {
        const database = getDatabaseNameFromDocument(doc.type, doc.uuid, map);
        map.set(doc.uuid, database);
      }
    }

    return map;
  }

  // Helper to create a document map from a change
  function createDocMap(change: AtlasDocumentChange): Map<string, ExportAtlasTreeBaseDocument> {
    const map = new Map<string, ExportAtlasTreeBaseDocument>();
    if (change.oldValues) map.set(change.uuid, change.oldValues);
    if (change.newValues) map.set(change.uuid, change.newValues);

    // Add parent documents if ancestry exists
    if (change.oldAncestry) {
      change.oldAncestry.forEach((ancestorUuid, idx) => {
        if (!map.has(ancestorUuid)) {
          // Create a minimal parent document for testing
          map.set(ancestorUuid, {
            type: 'Section',
            doc_no: `A.${idx + 1}`,
            name: `Parent ${idx + 1}`,
            uuid: ancestorUuid,
            content: '',
            last_modified: '',
          });
        }
      });
    }
    if (change.newAncestry) {
      change.newAncestry.forEach((ancestorUuid, idx) => {
        if (!map.has(ancestorUuid)) {
          map.set(ancestorUuid, {
            type: 'Section',
            doc_no: `A.${idx + 1}`,
            name: `Parent ${idx + 1}`,
            uuid: ancestorUuid,
            content: '',
            last_modified: '',
          });
        }
      });
    }

    return map;
  }

  describe('updateNotionPageContent', () => {
    it('updates basic page properties successfully', async () => {
      // Setup mock page
      mockNotionClient.addMockPage('page-123', {
        properties: {
          Name: { title: [{ text: { content: 'Old Name' } }] },
          'Doc No (or Temp Name)': { rich_text: [{ text: { content: 'A.1.1' } }] },
          Type: { select: { name: 'Section' } },
          Content: { rich_text: [{ text: { content: 'Old content' } }] },
        },
      });

      const change: AtlasDocumentChange = {
        uuid: 'page-123',
        changeType: 'changed',
        oldValues: {
          type: 'Section',
          doc_no: 'A.1.1',
          name: 'Old Name',
          uuid: 'page-123',
          content: 'Old content',
          last_modified: '',
        },
        newValues: {
          type: 'Section',
          doc_no: 'A.1.2',
          name: 'New Name',
          uuid: 'page-123',
          content: 'New content',
          last_modified: '',
        },
        oldAncestry: [],
      };

      const docMap = createDocMap(change);
      const dbMap = createDatabaseMap([...docMap.values()]);
      const result = await updateNotionPageContent(change, dbMap, emptyUuidMappings);

      expect(result.success).toBe(true);
      expect(result.pageId).toBe('page-123');
      expect(mockNotionClient.getCallCount('pages.update')).toBe(1);

      const updated = mockNotionClient.get('page-123') as Record<string, unknown>;
      const props = updated.properties as Record<string, unknown>;
      // Note: Name and Doc No are not currently synced (see TODOs in implementation)
      // Only Content and extra fields are synced
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((props['Content'] as any).rich_text[0].text.content).toBe('New content');
    });

    it('updates extra fields for Type Specification documents', async () => {
      mockNotionClient.addMockPage('page-123', {
        properties: {
          Name: { title: [{ text: { content: 'Type Spec' } }] },
          Components: { rich_text: [] },
        },
      });

      const change: AtlasDocumentChange = {
        uuid: 'page-123',
        changeType: 'changed',
        oldValues: {
          type: 'Type Specification',
          doc_no: 'A.1.2.3',
          name: 'Old Type Spec',
          uuid: 'page-123',
          content: 'Old Content',
          last_modified: '',
        },
        newValues: {
          type: 'Type Specification',
          doc_no: 'A.1.2.3',
          name: 'Updated Type Spec',
          uuid: 'page-123',
          content: 'Content',
          last_modified: '',
          type_specification_components: 'New components',
          type_specification_type_name: 'MyType',
        } as ExportAtlasTreeBaseDocument,
        oldAncestry: [],
      };

      const docMap = createDocMap(change);
      const dbMap = createDatabaseMap([...docMap.values()]);
      const result = await updateNotionPageContent(change, dbMap, emptyUuidMappings);

      expect(result.success).toBe(true);
      const updated = mockNotionClient.get('page-123') as Record<string, unknown>;
      const props = updated.properties as Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((props['Components'] as any).rich_text[0].text.content).toBe('New components');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((props['Type Name'] as any).rich_text[0].text.content).toBe('MyType');
    });

    it('returns error if page not found', async () => {
      const change: AtlasDocumentChange = {
        uuid: 'nonexistent',
        changeType: 'changed',
        oldValues: {
          type: 'Section',
          doc_no: 'A.1.2',
          name: 'Old Test',
          uuid: 'nonexistent',
          content: 'Old Content',
          last_modified: '',
        },
        newValues: {
          type: 'Section',
          doc_no: 'A.1.2',
          name: 'Test',
          uuid: 'nonexistent',
          content: 'Content',
          last_modified: '',
        },
        oldAncestry: [],
      };

      const docMap = createDocMap(change);
      const dbMap = createDatabaseMap([...docMap.values()]);
      const result = await updateNotionPageContent(change, dbMap, emptyUuidMappings);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('returns error if UUID is missing', async () => {
      const change: AtlasDocumentChange = {
        uuid: '',
        changeType: 'changed',
        oldValues: {
          type: 'Section',
          doc_no: 'A.1.2',
          name: 'Old Test',
          uuid: '',
          content: 'Old Content',
          last_modified: '',
        },
        newValues: {
          type: 'Section',
          doc_no: 'A.1.2',
          name: 'Test',
          uuid: '',
          content: 'Content',
          last_modified: '',
        },
      };

      const docMap = createDocMap(change);
      const dbMap = createDatabaseMap([...docMap.values()]);
      const result = await updateNotionPageContent(change, dbMap, emptyUuidMappings);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing page UUID');
    });
  });

  describe('createNotionDatabasePage', () => {
    it('creates page with database parent (no ancestry)', async () => {
      const dbId = ATLAS_DATABASE_ID_MAP.Scopes; // Scopes (root-level database)
      mockNotionClient.addMockDatabase(dbId, {});

      const change: AtlasDocumentChange = {
        uuid: 'new-page',
        changeType: 'added',
        newValues: {
          type: 'Scope',
          doc_no: 'A.1',
          name: 'New Scope',
          uuid: 'new-page',
          content: 'Content',
          last_modified: '',
        },
        newAncestry: [],
      };

      const docMap = createDocMap(change);
      const dbMap = createDatabaseMap([...docMap.values()]);
      const result = await createNotionDatabasePage(change, docMap, dbMap, emptyUuidMappings);

      expect(result.success).toBe(true);
      expect(result.pageId).toBeDefined();
      expect(mockNotionClient.getCallCount('pages.create')).toBe(1);

      const createCall = mockNotionClient.getLastCall('pages.create');
      const parent = (createCall?.args as { parent: { type: string; database_id: string } }).parent;
      expect(parent.type).toBe('database_id');
      expect(parent.database_id).toBe(dbId);
    });

    it('creates page after validating parent exists', async () => {
      const dbId = ATLAS_DATABASE_ID_MAP['Sections & Primary Docs']; // Sections & Primary Docs
      mockNotionClient.addMockDatabase(dbId, {});
      mockNotionClient.addMockPage('parent-123', {});

      const change: AtlasDocumentChange = {
        uuid: 'new-page',
        changeType: 'added',
        newValues: {
          type: 'Section',
          doc_no: 'A.1.2.3',
          name: 'New Child Section',
          uuid: 'new-page',
          content: 'Content',
          last_modified: '',
        },
        newAncestry: ['parent-123'],
      };

      // Add parent to doc map
      const docMap = createDocMap(change);
      docMap.set('parent-123', {
        type: 'Section',
        doc_no: 'A.1.2',
        name: 'Parent Section',
        uuid: 'parent-123',
        content: '',
        last_modified: '',
      });

      const dbMap = createDatabaseMap([...docMap.values()]);
      // Create UUID mappings for the parent
      const uuidMappings = createMockUuidMappings(['parent-123']);
      const result = await createNotionDatabasePage(change, docMap, dbMap, uuidMappings);

      expect(result.success).toBe(true);
      expect(mockNotionClient.getCallCount('pages.retrieve')).toBe(1); // Parent validation
      expect(mockNotionClient.getCallCount('pages.create')).toBe(1);

      const createCall = mockNotionClient.getLastCall('pages.create');
      const parent = (createCall?.args as { parent: { type: string; database_id: string } }).parent;
      expect(parent.type).toBe('database_id');
      expect(parent.database_id).toBe(dbId);
    });

    it('skips creation if parent does not exist', async () => {
      const change: AtlasDocumentChange = {
        uuid: 'new-page',
        changeType: 'added',
        newValues: {
          type: 'Section',
          doc_no: 'A.1.2.3',
          name: 'New Section',
          uuid: 'new-page',
          content: 'Content',
          last_modified: '',
        },
        newAncestry: ['nonexistent-parent'],
      };

      // Add parent to doc map but not to Notion (simulates parent in Markdown but not in Notion)
      const docMap = createDocMap(change);
      docMap.set('nonexistent-parent', {
        type: 'Section',
        doc_no: 'A.1.2',
        name: 'Nonexistent Parent',
        uuid: 'nonexistent-parent',
        content: '',
        last_modified: '',
      });

      const dbMap = createDatabaseMap([...docMap.values()]);
      // Create UUID mappings for the parent (mapping exists, but page doesn't exist in Notion)
      const uuidMappings = createMockUuidMappings(['nonexistent-parent']);
      const result = await createNotionDatabasePage(change, docMap, dbMap, uuidMappings);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('parent_not_found');
      expect(mockNotionClient.getCallCount('pages.create')).toBe(0);
    });

    it('sets parent relationship for internally nested database', async () => {
      const dbId = ATLAS_DATABASE_ID_MAP['Sections & Primary Docs']; // Sections & Primary Docs
      mockNotionClient.addMockDatabase(dbId, {});
      mockNotionClient.addMockPage('parent-section', {});

      const change: AtlasDocumentChange = {
        uuid: 'new-core',
        changeType: 'added',
        newValues: {
          type: 'Core',
          doc_no: 'A.1.2.1',
          name: 'New Core',
          uuid: 'new-core',
          content: 'Core content',
          last_modified: '',
        },
        newAncestry: ['parent-section'],
      };

      // Add parent to doc map
      const docMap = createDocMap(change);
      docMap.set('parent-section', {
        type: 'Section',
        doc_no: 'A.1.2',
        name: 'Parent Section',
        uuid: 'parent-section',
        content: '',
        last_modified: '',
      });

      const dbMap = createDatabaseMap([...docMap.values()]);
      // Create UUID mappings for the parent
      const uuidMappings = createMockUuidMappings(['parent-section']);
      const result = await createNotionDatabasePage(change, docMap, dbMap, uuidMappings);

      expect(result.success).toBe(true);

      const createCall = mockNotionClient.getLastCall('pages.create');
      const args = createCall?.args as { properties: { 'Parent Doc': { relation: { id: string }[] } } };
      expect(args.properties['Parent Doc']).toBeDefined();
      expect(args.properties['Parent Doc'].relation[0].id).toBe('parent-section');
    });

    it('does not set parent relationship when parent is in different database', async () => {
      const dbId = ATLAS_DATABASE_ID_MAP['Sections & Primary Docs']; // Sections & Primary Docs
      mockNotionClient.addMockDatabase(dbId, {});
      mockNotionClient.addMockPage('article-parent', {}); // Parent exists but is in Articles database

      const change: AtlasDocumentChange = {
        uuid: 'new-section',
        changeType: 'added',
        newValues: {
          type: 'Section',
          doc_no: 'A.1.2',
          name: 'New Section',
          uuid: 'new-section',
          content: 'Section content',
          last_modified: '',
        },
        newAncestry: ['article-parent'], // Cross-database parent (Article → Section)
      };

      // Add parent to doc map (cross-database parent: Article)
      const docMap = createDocMap(change);
      docMap.set('article-parent', {
        type: 'Article',
        doc_no: 'A.1',
        name: 'Parent Article',
        uuid: 'article-parent',
        content: '',
        last_modified: '',
      });

      const dbMap = createDatabaseMap([...docMap.values()]);
      // Create UUID mappings for the parent
      const uuidMappings = createMockUuidMappings(['article-parent']);
      const result = await createNotionDatabasePage(change, docMap, dbMap, uuidMappings);

      expect(result.success).toBe(true);

      const createCall = mockNotionClient.getLastCall('pages.create');
      const args = createCall?.args as { properties: Record<string, unknown> };
      // Parent Doc should NOT be set for cross-database parents
      expect(args.properties['Parent Doc']).toBeUndefined();
    });
  });

  describe('deleteNotionPage', () => {
    it('archives page if it has no children', async () => {
      mockNotionClient.addMockPage('page-to-delete', {
        properties: {
          Subdocs: { type: 'relation', relation: [] },
          Annotations: { type: 'relation', relation: [] },
          Tenets: { type: 'relation', relation: [] },
        },
      });

      const change: AtlasDocumentChange = {
        uuid: 'page-to-delete',
        changeType: 'deleted',
        oldValues: {
          type: 'Section',
          doc_no: 'A.1.2',
          name: 'Section to Delete',
          uuid: 'page-to-delete',
          content: 'Content',
          last_modified: '',
        },
        oldAncestry: [],
      };

      const docMap = createDocMap(change);
      const dbMap = createDatabaseMap([...docMap.values()]);
      const result = await deleteNotionPage(change, dbMap);

      expect(result.success).toBe(true);
      expect(mockNotionClient.getCallCount('pages.retrieve')).toBe(1); // To check children
      expect(mockNotionClient.getCallCount('pages.update')).toBe(1);

      const archived = mockNotionClient.get('page-to-delete') as Record<string, unknown>;
      expect(archived.archived).toBe(true);
    });

    it('skips deletion if page has children', async () => {
      mockNotionClient.addMockPage('page-with-children', {
        properties: {
          Subdocs: { type: 'relation', relation: [{ id: 'child-1' }] },
        },
      });

      const change: AtlasDocumentChange = {
        uuid: 'page-with-children',
        changeType: 'deleted',
        oldValues: {
          type: 'Section',
          doc_no: 'A.1.2',
          name: 'Section with Children',
          uuid: 'page-with-children',
          content: 'Content',
          last_modified: '',
        },
        oldAncestry: [],
      };

      const docMap = createDocMap(change);
      const dbMap = createDatabaseMap([...docMap.values()]);
      const result = await deleteNotionPage(change, dbMap);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('has_children');
      expect(mockNotionClient.getCallCount('pages.update')).toBe(0);
    });

    it('returns error if UUID is missing', async () => {
      const change: AtlasDocumentChange = {
        uuid: '',
        changeType: 'deleted',
        oldValues: {
          type: 'Section',
          doc_no: 'A.1.2',
          name: 'Test',
          uuid: '',
          content: 'Content',
          last_modified: '',
        },
        oldAncestry: [],
      };

      const docMap = createDocMap(change);
      const dbMap = createDatabaseMap([...docMap.values()]);
      const result = await deleteNotionPage(change, dbMap);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing page UUID');
    });
  });

  describe('inter-database relationships', () => {
    it('creates page with inter-database parent relationship (Section under Article)', async () => {
      const dbId = ATLAS_DATABASE_ID_MAP['Sections & Primary Docs']; // Sections & Primary Docs
      mockNotionClient.addMockDatabase(dbId, {});
      mockNotionClient.addMockPage('article-parent', {}); // Article parent exists in Notion

      const change: AtlasDocumentChange = {
        uuid: 'new-section',
        changeType: 'added',
        newValues: {
          type: 'Section',
          doc_no: 'A.1.1',
          name: 'New Section',
          uuid: 'new-section',
          content: 'Section content',
          last_modified: '',
        },
        newAncestry: ['article-parent'], // Parent is an Article (different database)
      };

      const docMap = createDocMap(change);
      docMap.set('article-parent', {
        type: 'Article',
        doc_no: 'A.1',
        name: 'Parent Article',
        uuid: 'article-parent',
        content: '',
        last_modified: '',
      });

      const dbMap = createDatabaseMap([...docMap.values()]);
      // Create UUID mappings for the parent
      const uuidMappings = createMockUuidMappings(['article-parent']);
      const result = await createNotionDatabasePage(change, docMap, dbMap, uuidMappings);

      expect(result.success).toBe(true);
      expect(mockNotionClient.getCallCount('pages.retrieve')).toBe(1); // Validate inter-database parent
      expect(mockNotionClient.getCallCount('pages.create')).toBe(1);

      // Verify relationship property was set
      const createCall = mockNotionClient.getLastCall('pages.create');
      const properties = (createCall?.args as { properties: Record<string, unknown> }).properties;
      // The relationship property on Sections database for parent Articles is "Parent Article"
      expect(properties['Parent Article']).toEqual({
        relation: [{ id: 'article-parent' }],
      });
    });

    it('creates page with inter-database parent relationship (Annotation under Section)', async () => {
      const dbId = ATLAS_DATABASE_ID_MAP.Annotations; // Annotations
      mockNotionClient.addMockDatabase(dbId, {});
      mockNotionClient.addMockPage('section-parent', {}); // Section parent exists in Notion

      const change: AtlasDocumentChange = {
        uuid: 'new-annotation',
        changeType: 'added',
        newValues: {
          type: 'Annotation',
          doc_no: 'A.1.1.0.3.1',
          name: 'New Annotation',
          uuid: 'new-annotation',
          content: 'Annotation content',
          last_modified: '',
        },
        newAncestry: ['section-parent'], // Parent is a Section (different database)
      };

      const docMap = createDocMap(change);
      docMap.set('section-parent', {
        type: 'Section',
        doc_no: 'A.1.1',
        name: 'Parent Section',
        uuid: 'section-parent',
        content: '',
        last_modified: '',
      });

      const dbMap = createDatabaseMap([...docMap.values()]);
      // Create UUID mappings for the parent
      const uuidMappings = createMockUuidMappings(['section-parent']);
      const result = await createNotionDatabasePage(change, docMap, dbMap, uuidMappings);

      expect(result.success).toBe(true);
      expect(mockNotionClient.getCallCount('pages.retrieve')).toBe(1); // Validate inter-database parent
      expect(mockNotionClient.getCallCount('pages.create')).toBe(1);

      // Verify relationship property was set
      const createCall = mockNotionClient.getLastCall('pages.create');
      const properties = (createCall?.args as { properties: Record<string, unknown> }).properties;
      // The relationship property on Annotations database for parent Sections & Primary Docs is "Parent Section / Primary Doc"
      expect(properties['Parent Section / Primary Doc']).toEqual({
        relation: [{ id: 'section-parent' }],
      });
    });

    it('skips creation if inter-database parent does not exist', async () => {
      const change: AtlasDocumentChange = {
        uuid: 'new-section',
        changeType: 'added',
        newValues: {
          type: 'Section',
          doc_no: 'A.1.1',
          name: 'New Section',
          uuid: 'new-section',
          content: 'Section content',
          last_modified: '',
        },
        newAncestry: ['nonexistent-article'],
      };

      const docMap = createDocMap(change);
      docMap.set('nonexistent-article', {
        type: 'Article',
        doc_no: 'A.1',
        name: 'Nonexistent Article',
        uuid: 'nonexistent-article',
        content: '',
        last_modified: '',
      });

      const dbMap = createDatabaseMap([...docMap.values()]);
      // Create UUID mappings for the parent (mapping exists, but page doesn't exist in Notion)
      const uuidMappings = createMockUuidMappings(['nonexistent-article']);
      const result = await createNotionDatabasePage(change, docMap, dbMap, uuidMappings);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('parent_not_found');
      expect(result.error).toContain('Inter-database parent page');
      expect(mockNotionClient.getCallCount('pages.create')).toBe(0);
    });

    // Note: Test for mixed internal+inter-database relationships omitted
    // The existing tests cover internal relationships (sets parent relationship for internally nested database)
    // and inter-database relationships (Section under Article, Annotation under Section) separately
  });

  describe('validatePageExists', () => {
    it('returns true if page exists', async () => {
      mockNotionClient.addMockPage('existing-page', {});

      const exists = await validatePageExists('existing-page');

      expect(exists).toBe(true);
      expect(mockNotionClient.getCallCount('pages.retrieve')).toBe(1);
    });

    it('returns false if page does not exist', async () => {
      const exists = await validatePageExists('nonexistent-page');

      expect(exists).toBe(false);
    });
  });
});
