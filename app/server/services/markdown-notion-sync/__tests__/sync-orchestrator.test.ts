/**
 * Unit tests for sync-orchestrator.ts
 *
 * Tests the main orchestration logic for processing changes in correct phase order.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AtlasDiffResult, AtlasDocumentChange } from '@/app/server/atlas/diff/atlas-diff';
import { UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import { buildNestingBugAffectedUuidsSet } from '@/app/server/services/supabase/notion-nesting-bug-mappings';
// Import mocked functions
import {
  createNotionDatabasePage,
  deleteNotionPage,
  updateNotionPageContent,
  updateNotionPageParent,
} from '../sync-operations';
import { ProgressCallback, StopCheckCallback, processChanges } from '../sync-orchestrator';
import { SyncFilters } from '../types';

// Mock dependencies
vi.mock('@/app/server/services/supabase/notion-nesting-bug-mappings', () => ({
  loadNotionNestingFixMappings: vi.fn().mockResolvedValue([]),
  buildNestingBugAffectedUuidsSet: vi.fn().mockReturnValue(new Set()),
}));

vi.mock('../sync-helpers', () => ({
  getDocumentLabel: vi.fn((change: AtlasDocumentChange) => {
    const doc = change.newValues || change.oldValues;
    return doc?.doc_no || 'unknown';
  }),
  sortAdditionsByDepthFirst: vi.fn((additions: AtlasDocumentChange[]) => additions),
}));

vi.mock('../sync-operations', () => ({
  updateNotionPageContent: vi.fn(),
  createNotionDatabasePage: vi.fn(),
  deleteNotionPage: vi.fn(),
  updateNotionPageParent: vi.fn(),
}));

describe('sync-orchestrator', () => {
  let mockDiffResult: AtlasDiffResult;
  let mockUuidMappings: UuidMappings;
  let mockFilters: SyncFilters;
  let mockProgressCallback: ProgressCallback;
  let mockStopCheckCallback: StopCheckCallback;

  // Helper to create mock documents with required fields
  const createMockDoc = (doc_no: string, name: string, uuid: string, type = 'Core' as const) => ({
    doc_no,
    name,
    type,
    uuid,
    last_modified: '2024-01-01T00:00:00Z',
    content: '',
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup basic mocks
    mockDiffResult = {
      changes: {
        added: [],
        deleted: [],
        changed: [],
        parent_changed: [],
      },
      originalIdsToDocuments: new Map(),
      newIdsToDocuments: new Map(),
      originalIdsToDatabase: new Map(),
      newIdsToDatabase: new Map(),
    };

    mockUuidMappings = {
      atlasUUIDsToNotionPageIds: new Map(),
      notionPageIDsToAtlasUUIDs: new Map(),
    };

    mockFilters = {
      contentChanges: true,
      added: true,
      deleted: true,
      parentChanges: true,
    };

    mockProgressCallback = vi.fn();
    mockStopCheckCallback = vi.fn().mockResolvedValue(false);

    // Setup default successful responses
    vi.mocked(updateNotionPageContent).mockResolvedValue({ success: true });
    vi.mocked(createNotionDatabasePage).mockResolvedValue({ success: true, pageId: 'new-page-id' });
    vi.mocked(deleteNotionPage).mockResolvedValue({ success: true });
    vi.mocked(updateNotionPageParent).mockResolvedValue({ success: true });
  });

  describe('empty changes', () => {
    it('returns zero counts when no changes', async () => {
      const result = await processChanges(
        mockDiffResult,
        mockUuidMappings,
        mockFilters,
        'batch-id',
        mockProgressCallback,
        mockStopCheckCallback,
      );

      expect(result).toEqual({
        succeeded: 0,
        failed: 0,
        skipped: 0,
        stoppedEarly: false,
      });
      expect(mockProgressCallback).not.toHaveBeenCalled();
    });
  });

  describe('phase ordering', () => {
    it('processes changes in correct order: content → additions → deletions → parent', async () => {
      const mockChanged: AtlasDocumentChange = {
        uuid: 'uuid-1',
        changeType: 'changed',
        oldValues: createMockDoc('A.1', 'Old', 'uuid-1'),
        newValues: createMockDoc('A.1', 'New', 'uuid-1'),
        oldAncestry: [],
        newAncestry: [],
      };

      const mockAdded: AtlasDocumentChange = {
        uuid: 'uuid-2',
        changeType: 'added',
        newValues: createMockDoc('A.2', 'Added', 'uuid-2'),
        newAncestry: [],
      };

      const mockDeleted: AtlasDocumentChange = {
        uuid: 'uuid-3',
        changeType: 'deleted',
        oldValues: createMockDoc('A.3', 'Deleted', 'uuid-3'),
        oldAncestry: [],
      };

      const mockParentChanged: AtlasDocumentChange = {
        uuid: 'uuid-4',
        changeType: 'parent_changed',
        oldValues: createMockDoc('A.4', 'Moved', 'uuid-4'),
        newValues: createMockDoc('A.4', 'Moved', 'uuid-4'),
        oldAncestry: ['parent-1'],
        newAncestry: ['parent-2'],
      };

      mockDiffResult.changes = {
        changed: [mockChanged],
        added: [mockAdded],
        deleted: [mockDeleted],
        parent_changed: [mockParentChanged],
      };

      const callOrder: string[] = [];
      vi.mocked(updateNotionPageContent).mockImplementation(async () => {
        callOrder.push('content');
        return { success: true };
      });
      vi.mocked(createNotionDatabasePage).mockImplementation(async () => {
        callOrder.push('addition');
        return { success: true, pageId: 'new-id' };
      });
      vi.mocked(deleteNotionPage).mockImplementation(async () => {
        callOrder.push('deletion');
        return { success: true };
      });
      vi.mocked(updateNotionPageParent).mockImplementation(async () => {
        callOrder.push('parent');
        return { success: true };
      });

      await processChanges(
        mockDiffResult,
        mockUuidMappings,
        mockFilters,
        'batch-id',
        mockProgressCallback,
        mockStopCheckCallback,
      );

      expect(callOrder).toEqual(['content', 'addition', 'deletion', 'parent']);
    });
  });

  describe('stop request handling', () => {
    it('stops during content phase when stop requested', async () => {
      mockDiffResult.changes.changed = [
        {
          uuid: 'uuid-1',
          changeType: 'changed',
          oldValues: createMockDoc('A.1', 'Old', 'uuid-1'),
          newValues: createMockDoc('A.1', 'New', 'uuid-1'),
          oldAncestry: [],
          newAncestry: [],
        },
        {
          uuid: 'uuid-2',
          changeType: 'changed',
          oldValues: createMockDoc('A.2', 'Old2', 'uuid-2'),
          newValues: createMockDoc('A.2', 'New2', 'uuid-2'),
          oldAncestry: [],
          newAncestry: [],
        },
      ];

      // Stop after first change - the check happens before each item, so first item processes
      let callCount = 0;
      vi.mocked(mockStopCheckCallback).mockImplementation(async () => {
        callCount++;
        return callCount > 1; // Stop after first item is processed
      });

      const result = await processChanges(
        mockDiffResult,
        mockUuidMappings,
        mockFilters,
        'batch-id',
        mockProgressCallback,
        mockStopCheckCallback,
      );

      expect(result.stoppedEarly).toBe(true);
      expect(result.succeeded).toBe(1); // First operation completed successfully before stop
      expect(updateNotionPageContent).toHaveBeenCalledTimes(1); // Only first change processed
    });

    it('stops between phases', async () => {
      mockDiffResult.changes.changed = [
        {
          uuid: 'uuid-1',
          changeType: 'changed',
          oldValues: createMockDoc('A.1', 'Old', 'uuid-1'),
          newValues: createMockDoc('A.1', 'New', 'uuid-1'),
          oldAncestry: [],
          newAncestry: [],
        },
      ];
      mockDiffResult.changes.added = [
        {
          uuid: 'uuid-2',
          changeType: 'added',
          newValues: createMockDoc('A.2', 'Added', 'uuid-2'),
          newAncestry: [],
        },
      ];

      // Stop after content phase
      let callCount = 0;
      vi.mocked(mockStopCheckCallback).mockImplementation(async () => {
        callCount++;
        return callCount > 1; // Stop before additions phase
      });

      const result = await processChanges(
        mockDiffResult,
        mockUuidMappings,
        mockFilters,
        'batch-id',
        mockProgressCallback,
        mockStopCheckCallback,
      );

      expect(result.stoppedEarly).toBe(true);
      expect(updateNotionPageContent).toHaveBeenCalled();
      expect(createNotionDatabasePage).not.toHaveBeenCalled(); // Stopped before additions
    });
  });

  describe('progress callback', () => {
    it('invokes progress callback with correct phase and counts', async () => {
      mockDiffResult.changes.changed = [
        {
          uuid: 'uuid-1',
          changeType: 'changed',
          oldValues: createMockDoc('A.1', 'Old', 'uuid-1'),
          newValues: createMockDoc('A.1', 'New', 'uuid-1'),
          oldAncestry: [],
          newAncestry: [],
        },
      ];

      await processChanges(
        mockDiffResult,
        mockUuidMappings,
        mockFilters,
        'batch-id',
        mockProgressCallback,
        mockStopCheckCallback,
      );

      expect(mockProgressCallback).toHaveBeenCalledWith({
        phase: 'content',
        completed: 0,
        currentDoc: 'A.1',
        succeeded: 0,
        failed: 0,
        skipped: 0,
      });
    });

    it('tracks succeeded/failed/skipped counts correctly', async () => {
      mockDiffResult.changes.changed = [
        {
          uuid: 'uuid-1',
          changeType: 'changed',
          oldValues: createMockDoc('A.1', 'Old', 'uuid-1'),
          newValues: createMockDoc('A.1', 'New', 'uuid-1'),
          oldAncestry: [],
          newAncestry: [],
        },
        {
          uuid: 'uuid-2',
          changeType: 'changed',
          oldValues: createMockDoc('A.2', 'Old2', 'uuid-2'),
          newValues: createMockDoc('A.2', 'New2', 'uuid-2'),
          oldAncestry: [],
          newAncestry: [],
        },
        {
          uuid: 'uuid-3',
          changeType: 'changed',
          oldValues: createMockDoc('A.3', 'Old3', 'uuid-3'),
          newValues: createMockDoc('A.3', 'New3', 'uuid-3'),
          oldAncestry: [],
          newAncestry: [],
        },
      ];

      // First succeeds, second skipped, third fails
      vi.mocked(updateNotionPageContent)
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false, reason: 'validation_failed', error: 'test' })
        .mockRejectedValueOnce(new Error('test error'));

      const result = await processChanges(
        mockDiffResult,
        mockUuidMappings,
        mockFilters,
        'batch-id',
        mockProgressCallback,
        mockStopCheckCallback,
      );

      expect(result).toEqual({
        succeeded: 1,
        failed: 1,
        skipped: 1,
        stoppedEarly: false,
      });
    });
  });

  describe('nesting bug filtering', () => {
    it('skips parent changes for nesting bug affected documents', async () => {
      const affectedUuid = 'nesting-bug-uuid';
      vi.mocked(buildNestingBugAffectedUuidsSet).mockReturnValue(new Set([affectedUuid]));

      mockDiffResult.changes.parent_changed = [
        {
          uuid: affectedUuid,
          changeType: 'parent_changed',
          oldValues: createMockDoc('A.1', 'Test', affectedUuid),
          newValues: createMockDoc('A.1', 'Test', affectedUuid),
          oldAncestry: ['parent-1'],
          newAncestry: ['parent-2'],
        },
        {
          uuid: 'normal-uuid',
          changeType: 'parent_changed',
          oldValues: createMockDoc('A.2', 'Normal', 'normal-uuid'),
          newValues: createMockDoc('A.2', 'Normal', 'normal-uuid'),
          oldAncestry: ['parent-1'],
          newAncestry: ['parent-2'],
        },
      ];

      const result = await processChanges(
        mockDiffResult,
        mockUuidMappings,
        mockFilters,
        'batch-id',
        mockProgressCallback,
        mockStopCheckCallback,
      );

      expect(result.skipped).toBe(1); // One skipped for nesting bug
      expect(result.succeeded).toBe(1); // One normal parent change succeeded
      expect(updateNotionPageParent).toHaveBeenCalledTimes(1); // Only called for non-affected document
    });
  });

  describe('filter handling', () => {
    it('respects content changes filter', async () => {
      mockDiffResult.changes.changed = [
        {
          uuid: 'uuid-1',
          changeType: 'changed',
          oldValues: createMockDoc('A.1', 'Old', 'uuid-1'),
          newValues: createMockDoc('A.1', 'New', 'uuid-1'),
          oldAncestry: [],
          newAncestry: [],
        },
      ];

      mockFilters.contentChanges = false;

      await processChanges(
        mockDiffResult,
        mockUuidMappings,
        mockFilters,
        'batch-id',
        mockProgressCallback,
        mockStopCheckCallback,
      );

      expect(updateNotionPageContent).not.toHaveBeenCalled();
    });

    it('respects additions filter', async () => {
      mockDiffResult.changes.added = [
        {
          uuid: 'uuid-1',
          changeType: 'added',
          newValues: createMockDoc('A.1', 'Added', 'uuid-1'),
          newAncestry: [],
        },
      ];

      mockFilters.added = false;

      await processChanges(
        mockDiffResult,
        mockUuidMappings,
        mockFilters,
        'batch-id',
        mockProgressCallback,
        mockStopCheckCallback,
      );

      expect(createNotionDatabasePage).not.toHaveBeenCalled();
    });

    it('respects deletions filter', async () => {
      mockDiffResult.changes.deleted = [
        {
          uuid: 'uuid-1',
          changeType: 'deleted',
          oldValues: createMockDoc('A.1', 'Deleted', 'uuid-1'),
          oldAncestry: [],
        },
      ];

      mockFilters.deleted = false;

      await processChanges(
        mockDiffResult,
        mockUuidMappings,
        mockFilters,
        'batch-id',
        mockProgressCallback,
        mockStopCheckCallback,
      );

      expect(deleteNotionPage).not.toHaveBeenCalled();
    });

    it('respects parent changes filter', async () => {
      mockDiffResult.changes.parent_changed = [
        {
          uuid: 'uuid-1',
          changeType: 'parent_changed',
          oldValues: createMockDoc('A.1', 'Moved', 'uuid-1'),
          newValues: createMockDoc('A.1', 'Moved', 'uuid-1'),
          oldAncestry: ['parent-1'],
          newAncestry: ['parent-2'],
        },
      ];

      mockFilters.parentChanges = false;

      await processChanges(
        mockDiffResult,
        mockUuidMappings,
        mockFilters,
        'batch-id',
        mockProgressCallback,
        mockStopCheckCallback,
      );

      expect(updateNotionPageParent).not.toHaveBeenCalled();
    });
  });
});
