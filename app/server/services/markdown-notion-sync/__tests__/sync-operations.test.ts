/**
 * Unit tests for sync-operations.ts
 *
 * Note: These tests focus on validation logic and error handling.
 * Full integration tests with mocked Notion client would be more extensive.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import { AtlasDocumentChange } from '@/app/server/atlas/diff/atlas-diff';
import { UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import {
  createNotionDatabasePage,
  deleteNotionPage,
  updateNotionPageContent,
  updateNotionPageParent,
  updatePageMentions,
} from '../sync-operations';

// Mock the dependencies
vi.mock('@/app/server/services/notion/notion-client', () => ({
  notion: vi.fn(),
}));

vi.mock('@/app/server/services/supabase/audit-log-service', () => ({
  logNotionApiOperation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/app/server/services/supabase/uuid-mapping-service', () => ({
  storeUuidMapping: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/app/atlas/sync/_lib/atlas-database-mapper', () => ({
  getDatabaseNameFromDocument: vi.fn().mockReturnValue('Sections & Primary Docs'),
  getNotionDatabaseIdForDatabaseName: vi.fn().mockReturnValue('mock-database-id'),
  databaseSupportsInternalNesting: vi.fn().mockReturnValue(true),
  getInternalParentPageIdFromAncestry: vi.fn().mockReturnValue(null),
}));

vi.mock('@/app/atlas/sync/_lib/notion-property-builder', () => ({
  buildNotionProperties: vi.fn().mockReturnValue({}),
  addParentPageRelationshipProperty: vi.fn().mockReturnValue({}),
  addInterDatabaseRelationshipProperties: vi.fn().mockReturnValue({}),
}));

vi.mock('@/app/server/atlas/notion-mapping/notion-database-properties-and-relationships', () => ({
  NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS: {
    'Sections & Primary Docs': {
      parentPropertyName: 'Parent Doc',
      childRelationships: {},
    },
  },
}));

vi.mock('../sync-helpers', () => ({
  validatePageExists: vi.fn().mockResolvedValue(true),
  pageHasChildren: vi.fn().mockResolvedValue(false),
}));

describe('sync-operations', () => {
  let mockUuidMappings: UuidMappings;
  let mockOriginalIdsToDatabase: Map<string, AtlasDatabaseName>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockUuidMappings = {
      atlasUUIDsToNotionPageIds: new Map([['test-uuid', 'notion-page-id']]),
      notionPageIDsToAtlasUUIDs: new Map([['notion-page-id', 'test-uuid']]),
    };

    mockOriginalIdsToDatabase = new Map([['test-uuid', 'Sections & Primary Docs']]);
  });

  describe('updateNotionPageContent', () => {
    it('returns error when change is missing uuid', async () => {
      const baseDoc = { last_modified: '2024-01-01T00:00:00Z', content: '' };
      const change: AtlasDocumentChange = {
        changeType: 'changed',
        uuid: '',
        newValues: { uuid: '', doc_no: 'A.1.1', name: 'Test', type: 'Section', ...baseDoc },
        oldValues: { uuid: '', doc_no: 'A.1.1', name: 'Test', type: 'Section', ...baseDoc },
        newAncestry: [],
        oldAncestry: [],
      };

      const result = await updateNotionPageContent(change, mockOriginalIdsToDatabase, mockUuidMappings, 'batch-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required data');
    });

    it('returns error when change is missing newValues', async () => {
      const baseDoc = { last_modified: '2024-01-01T00:00:00Z', content: '' };
      const change: AtlasDocumentChange = {
        changeType: 'changed',
        uuid: 'test-uuid',
        newValues: undefined,
        oldValues: { uuid: 'test-uuid', doc_no: 'A.1.1', name: 'Test', type: 'Section', ...baseDoc },
        newAncestry: [],
        oldAncestry: [],
      };

      const result = await updateNotionPageContent(change, mockOriginalIdsToDatabase, mockUuidMappings, 'batch-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required data');
    });

    it('returns error with reason when Notion page ID mapping not found', async () => {
      const baseDoc = { last_modified: '2024-01-01T00:00:00Z', content: '' };
      const change: AtlasDocumentChange = {
        changeType: 'changed',
        uuid: 'unmapped-uuid',
        newValues: { uuid: 'unmapped-uuid', doc_no: 'A.1.1', name: 'Test', type: 'Section', ...baseDoc },
        oldValues: { uuid: 'unmapped-uuid', doc_no: 'A.1.1', name: 'Test', type: 'Section', ...baseDoc },
        newAncestry: [],
        oldAncestry: [],
      };

      const result = await updateNotionPageContent(change, mockOriginalIdsToDatabase, mockUuidMappings, 'batch-id');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('mapping_not_found');
      expect(result.error).toBe('No Notion page ID mapping found');
    });
  });

  describe('deleteNotionPage', () => {
    it('returns error when change is missing uuid', async () => {
      const baseDoc = { last_modified: '2024-01-01T00:00:00Z', content: '' };
      const change: AtlasDocumentChange = {
        changeType: 'deleted',
        uuid: '',
        newValues: undefined,
        oldValues: { uuid: '', doc_no: 'A.1.1', name: 'Test', type: 'Section', ...baseDoc },
        newAncestry: [],
        oldAncestry: [],
      };

      const result = await deleteNotionPage(change, mockOriginalIdsToDatabase, mockUuidMappings, 'batch-id');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required data');
    });

    it('returns error when Notion page ID mapping not found', async () => {
      const baseDoc = { last_modified: '2024-01-01T00:00:00Z', content: '' };
      const change: AtlasDocumentChange = {
        changeType: 'deleted',
        uuid: 'unmapped-uuid',
        newValues: undefined,
        oldValues: { uuid: 'unmapped-uuid', doc_no: 'A.1.1', name: 'Test', type: 'Section', ...baseDoc },
        newAncestry: [],
        oldAncestry: [],
      };

      const result = await deleteNotionPage(change, mockOriginalIdsToDatabase, mockUuidMappings, 'batch-id');

      expect(result.success).toBe(false);
      expect(result.reason).toBe('mapping_not_found');
    });
  });

  describe('createNotionDatabasePage', () => {
    it('returns error when newValues is missing uuid', async () => {
      const baseDoc = { last_modified: '2024-01-01T00:00:00Z', content: '' };
      const change: AtlasDocumentChange = {
        changeType: 'added',
        uuid: 'test-uuid',
        newValues: { uuid: '', doc_no: 'A.1.1', name: 'Test', type: 'Section', ...baseDoc },
        oldValues: undefined,
        newAncestry: [],
        oldAncestry: [],
      };

      const result = await createNotionDatabasePage(
        change,
        new Map(),
        new Map(),
        mockUuidMappings,
        'batch-id',
        new Set(),
        new Map(),
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing document UUID');
    });
  });

  describe('updateNotionPageParent', () => {
    it('returns error when change is missing required data', async () => {
      const change: AtlasDocumentChange = {
        changeType: 'parent_changed',
        uuid: '',
        newValues: undefined,
        oldValues: undefined,
        newAncestry: [],
        oldAncestry: [],
      };

      const result = await updateNotionPageParent(
        change,
        new Map(),
        new Map(),
        mockOriginalIdsToDatabase,
        mockUuidMappings,
        'batch-id',
        new Map(),
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Missing required data');
    });

    it('returns error when Notion page ID mapping not found', async () => {
      const baseDoc = { last_modified: '2024-01-01T00:00:00Z', content: '' };
      const change: AtlasDocumentChange = {
        changeType: 'parent_changed',
        uuid: 'unmapped-uuid',
        newValues: { uuid: 'unmapped-uuid', doc_no: 'A.1.1', name: 'Test', type: 'Section', ...baseDoc },
        oldValues: { uuid: 'unmapped-uuid', doc_no: 'A.1.1', name: 'Test', type: 'Section', ...baseDoc },
        newAncestry: ['parent-uuid'],
        oldAncestry: [],
      };

      const result = await updateNotionPageParent(
        change,
        new Map(),
        new Map(),
        mockOriginalIdsToDatabase,
        mockUuidMappings,
        'batch-id',
        new Map(),
      );

      expect(result.success).toBe(false);
      expect(result.reason).toBe('mapping_not_found');
    });

    it('returns success with no changes when properties object is empty', async () => {
      const baseDoc = { last_modified: '2024-01-01T00:00:00Z', content: '' };
      const change: AtlasDocumentChange = {
        changeType: 'parent_changed',
        uuid: 'test-uuid',
        newValues: { uuid: 'test-uuid', doc_no: 'A.1.1', name: 'Test', type: 'Section', ...baseDoc },
        oldValues: { uuid: 'test-uuid', doc_no: 'A.1.1', name: 'Test', type: 'Section', ...baseDoc },
        newAncestry: [], // No parent change
        oldAncestry: [],
      };

      const result = await updateNotionPageParent(
        change,
        new Map(),
        new Map(),
        mockOriginalIdsToDatabase,
        mockUuidMappings,
        'batch-id',
        new Map(),
      );

      expect(result.success).toBe(true);
      expect(result.pageId).toBe('notion-page-id');
    });
  });

  describe('updatePageMentions', () => {
    it('returns success when updating mentions with valid document', async () => {
      // Mock the Notion client to return a successful response
      const mockNotionClient = {
        pages: {
          update: vi.fn().mockResolvedValue({ id: 'notion-page-123' }),
        },
      };
      const { notion } = await import('@/app/server/services/notion/notion-client');
      vi.mocked(notion).mockReturnValue(mockNotionClient as unknown as ReturnType<typeof notion>);

      const baseDoc = { last_modified: '2024-01-01T00:00:00Z', content: 'Test content' };
      const document = {
        uuid: 'test-uuid',
        doc_no: 'A.1.1',
        name: 'Test',
        type: 'Section' as const,
        ...baseDoc,
      };

      const result = await updatePageMentions(
        'notion-page-123',
        document,
        'Sections & Primary Docs',
        mockUuidMappings,
        'batch-id',
      );

      expect(result.success).toBe(true);
      expect(result.pageId).toBe('notion-page-123');
    });

    it('returns error when Notion API call fails', async () => {
      // Mock the Notion client to throw an error
      const mockNotionClient = {
        pages: {
          update: vi.fn().mockRejectedValue(new Error('Notion API error')),
        },
      };
      const { notion } = await import('@/app/server/services/notion/notion-client');
      vi.mocked(notion).mockReturnValue(mockNotionClient as unknown as ReturnType<typeof notion>);

      const baseDoc = { last_modified: '2024-01-01T00:00:00Z', content: 'Test content' };
      const document = {
        uuid: 'test-uuid',
        doc_no: 'A.1.1',
        name: 'Test',
        type: 'Section' as const,
        ...baseDoc,
      };

      const result = await updatePageMentions(
        'notion-page-123',
        document,
        'Sections & Primary Docs',
        mockUuidMappings,
        'batch-id',
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Notion API error');
    });
  });
});
