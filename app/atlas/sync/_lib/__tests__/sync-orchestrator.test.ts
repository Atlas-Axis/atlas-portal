// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AtlasDiffResult, GroupedAtlasChanges } from '@/app/server/atlas/diff/atlas-diff';
import { BaseAtlasDocument } from '@/app/server/atlas/json-export/types';
import { UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import { mockNotionClient } from '@/app/server/services/notion/__tests__/notion-client.mock';
import { SyncPhase, syncChangesToNotion } from '../sync-orchestrator';

// Mock the notion client
vi.mock('@/app/server/services/notion/notion-client', () => ({
  notion: vi.fn(() => mockNotionClient as unknown),
}));

describe('sync-orchestrator', () => {
  beforeEach(() => {
    mockNotionClient.reset();
  });

  // Helper to create mock UUID mappings
  function createMockUuidMappings(): UuidMappings {
    return {
      notionPageIDsToAtlasUUIDs: new Map<string, string>(),
      atlasUUIDsToNotionPageIds: new Map<string, string>(),
    };
  }

  // Helper to create AtlasDiffResult from GroupedAtlasChanges
  function createDiffResult(changes: GroupedAtlasChanges): AtlasDiffResult {
    const originalIdsToDocuments = new Map<string, BaseAtlasDocument>();
    const newIdsToDocuments = new Map<string, BaseAtlasDocument>();

    // Collect documents from changes
    for (const change of changes.changed) {
      if (change.oldValues) originalIdsToDocuments.set(change.uuid, change.oldValues);
      if (change.newValues) newIdsToDocuments.set(change.uuid, change.newValues);
    }
    for (const change of changes.added) {
      if (change.newValues) newIdsToDocuments.set(change.uuid, change.newValues);
    }
    for (const change of changes.deleted) {
      if (change.oldValues) originalIdsToDocuments.set(change.uuid, change.oldValues);
    }
    for (const change of changes.parent_changed) {
      if (change.oldValues) originalIdsToDocuments.set(change.uuid, change.oldValues);
      if (change.newValues) newIdsToDocuments.set(change.uuid, change.newValues);
    }
    for (const change of changes.sibling_order_changed) {
      if (change.oldValues) originalIdsToDocuments.set(change.uuid, change.oldValues);
      if (change.newValues) newIdsToDocuments.set(change.uuid, change.newValues);
    }

    return { changes, originalIdsToDocuments, newIdsToDocuments };
  }

  it('processes changes in correct order: content -> additions -> deletions', async () => {
    // Setup mock data
    mockNotionClient.addMockPage('page-1', {
      properties: {
        Name: { title: [{ text: { content: 'Old Name' } }] },
        Subdocs: { type: 'relation', relation: [] },
      },
    });
    mockNotionClient.addMockPage('page-2', {});
    mockNotionClient.addMockPage('page-to-delete', {
      properties: {
        Subdocs: { type: 'relation', relation: [] },
      },
    });
    const dbId = '06d1d4fa1cc44e88a06559d4082163a8';
    mockNotionClient.addMockDatabase(dbId, {});

    const changes: GroupedAtlasChanges = {
      changed: [
        {
          uuid: 'page-1',
          changeType: 'changed',
          oldValues: {
            type: 'Section',
            doc_no: 'A.1.2',
            name: 'Old Name',
            uuid: 'page-1',
            content: 'Old content',
            last_modified: '',
          },
          newValues: {
            type: 'Section',
            doc_no: 'A.1.2',
            name: 'Updated Name',
            uuid: 'page-1',
            content: 'New content',
            last_modified: '',
          },
          oldAncestry: [],
        },
      ],
      added: [
        {
          uuid: 'new-page',
          changeType: 'added',
          newValues: {
            type: 'Section',
            doc_no: 'A.1.3',
            name: 'New Section',
            uuid: 'new-page',
            content: 'Content',
            last_modified: '',
          },
          newAncestry: [],
        },
      ],
      deleted: [
        {
          uuid: 'page-to-delete',
          changeType: 'deleted',
          oldValues: {
            type: 'Section',
            doc_no: 'A.1.4',
            name: 'Old Section',
            uuid: 'page-to-delete',
            content: 'Content',
            last_modified: '',
          },
          oldAncestry: [],
        },
      ],
      parent_changed: [],
      sibling_order_changed: [],
    };

    const diffResult = createDiffResult(changes);
    const mockMappings = createMockUuidMappings();
    const result = await syncChangesToNotion(diffResult, { stopRequested: false }, mockMappings);

    expect(result.succeeded.length).toBe(3);
    expect(result.failed.length).toBe(0);

    // Verify order by checking phases
    const phases = result.succeeded.map((s) => s.phase);
    expect(phases[0]).toBe('content');
    expect(phases[1]).toBe('additions');
    expect(phases[2]).toBe('deletions');

    // Verify call order in mock
    const callLog = mockNotionClient.callLog;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateIdx = callLog.findIndex((c) => c.method === 'pages.update' && (c.args as any).properties);
    const createIdx = callLog.findIndex((c) => c.method === 'pages.create');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const archiveIdx = callLog.findIndex((c) => c.method === 'pages.update' && (c.args as any).archived === true);

    expect(updateIdx).toBeLessThan(createIdx);
    expect(createIdx).toBeLessThan(archiveIdx);
  });

  it('stops gracefully when stopRequested is true', async () => {
    mockNotionClient.addMockPage('page-1', {
      properties: { Name: { title: [{ text: { content: 'Name 1' } }] } },
    });
    mockNotionClient.addMockPage('page-2', {
      properties: { Name: { title: [{ text: { content: 'Name 2' } }] } },
    });
    mockNotionClient.addMockPage('page-3', {
      properties: { Name: { title: [{ text: { content: 'Name 3' } }] } },
    });

    const changes: GroupedAtlasChanges = {
      changed: [
        {
          uuid: 'page-1',
          changeType: 'changed',
          oldValues: {
            type: 'Section',
            doc_no: 'A.1',
            name: 'Old 1',
            uuid: 'page-1',
            content: '',
            last_modified: '',
          },
          newValues: {
            type: 'Section',
            doc_no: 'A.1',
            name: 'New 1',
            uuid: 'page-1',
            content: '',
            last_modified: '',
          },
          oldAncestry: [],
        },
        {
          uuid: 'page-2',
          changeType: 'changed',
          oldValues: {
            type: 'Section',
            doc_no: 'A.2',
            name: 'Old 2',
            uuid: 'page-2',
            content: '',
            last_modified: '',
          },
          newValues: {
            type: 'Section',
            doc_no: 'A.2',
            name: 'New 2',
            uuid: 'page-2',
            content: '',
            last_modified: '',
          },
          oldAncestry: [],
        },
        {
          uuid: 'page-3',
          changeType: 'changed',
          oldValues: {
            type: 'Section',
            doc_no: 'A.3',
            name: 'Old 3',
            uuid: 'page-3',
            content: '',
            last_modified: '',
          },
          newValues: {
            type: 'Section',
            doc_no: 'A.3',
            name: 'New 3',
            uuid: 'page-3',
            content: '',
            last_modified: '',
          },
          oldAncestry: [],
        },
      ],
      added: [],
      deleted: [],
      parent_changed: [],
      sibling_order_changed: [],
    };

    // Stop after first change
    const options = { stopRequested: false };
    let callCount = 0;

    // Use spy to trigger stop after first update
    const originalUpdate = mockNotionClient.pages.update;
    mockNotionClient.pages.update = vi.fn(async (...args: unknown[]) => {
      callCount++;
      if (callCount === 1) {
        options.stopRequested = true;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (originalUpdate.bind(mockNotionClient.pages) as any)(...args);
    }) as unknown as typeof mockNotionClient.pages.update;

    const diffResult = createDiffResult(changes);
    const mockMappings = createMockUuidMappings();
    const result = await syncChangesToNotion(diffResult, options, mockMappings);

    expect(result.stopRequested).toBe(true);
    expect(result.totalProcessed).toBe(1);
    expect(result.succeeded.length).toBe(1);
  });

  it('continues processing on individual failures', async () => {
    mockNotionClient.addMockPage('page-1', {
      properties: { Name: { title: [{ text: { content: 'Name' } }] } },
    });
    // page-2 does not exist (will fail)
    mockNotionClient.addMockPage('page-3', {
      properties: { Name: { title: [{ text: { content: 'Name' } }] } },
    });

    const changes: GroupedAtlasChanges = {
      changed: [
        {
          uuid: 'page-1',
          changeType: 'changed',
          oldValues: {
            type: 'Section',
            doc_no: 'A.1',
            name: 'Old 1',
            uuid: 'page-1',
            content: '',
            last_modified: '',
          },
          newValues: {
            type: 'Section',
            doc_no: 'A.1',
            name: 'New 1',
            uuid: 'page-1',
            content: '',
            last_modified: '',
          },
          oldAncestry: [],
        },
        {
          uuid: 'page-2',
          changeType: 'changed',
          oldValues: {
            type: 'Section',
            doc_no: 'A.2',
            name: 'Old 2',
            uuid: 'page-2',
            content: '',
            last_modified: '',
          },
          newValues: {
            type: 'Section',
            doc_no: 'A.2',
            name: 'New 2',
            uuid: 'page-2',
            content: '',
            last_modified: '',
          },
          oldAncestry: [],
        },
        {
          uuid: 'page-3',
          changeType: 'changed',
          oldValues: {
            type: 'Section',
            doc_no: 'A.3',
            name: 'Old 3',
            uuid: 'page-3',
            content: '',
            last_modified: '',
          },
          newValues: {
            type: 'Section',
            doc_no: 'A.3',
            name: 'New 3',
            uuid: 'page-3',
            content: '',
            last_modified: '',
          },
          oldAncestry: [],
        },
      ],
      added: [],
      deleted: [],
      parent_changed: [],
      sibling_order_changed: [],
    };

    const diffResult = createDiffResult(changes);
    const mockMappings = createMockUuidMappings();
    const result = await syncChangesToNotion(diffResult, { stopRequested: false }, mockMappings);

    expect(result.succeeded.length).toBe(2); // page-1 and page-3
    expect(result.failed.length).toBe(1); // page-2
    expect(result.totalProcessed).toBe(3);
  });

  it('skips additions when parent does not exist', async () => {
    const dbId = '06d1d4fa1cc44e88a06559d4082163a8';
    mockNotionClient.addMockDatabase(dbId, {});
    // parent page does not exist

    const changes: GroupedAtlasChanges = {
      changed: [],
      added: [
        {
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
        },
      ],
      deleted: [],
      parent_changed: [],
      sibling_order_changed: [],
    };

    // Add parent document to map but not to Notion (simulates parent existing in Markdown but not in Notion)
    const diffResult = createDiffResult(changes);
    diffResult.newIdsToDocuments.set('nonexistent-parent', {
      type: 'Section',
      doc_no: 'A.1.2',
      name: 'Parent Section',
      uuid: 'nonexistent-parent',
      content: '',
      last_modified: '',
    });

    const mockMappings = createMockUuidMappings();
    const result = await syncChangesToNotion(diffResult, { stopRequested: false }, mockMappings);

    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0].result.reason).toBe('parent_not_found');
    expect(mockNotionClient.getCallCount('pages.create')).toBe(0);
  });

  it('skips deletions when page has children', async () => {
    mockNotionClient.addMockPage('page-with-children', {
      properties: {
        Subdocs: { type: 'relation', relation: [{ id: 'child-1' }] },
        Annotations: { type: 'relation', relation: [] },
        Tenets: { type: 'relation', relation: [] },
        'Active Data': { type: 'relation', relation: [] },
        'Needed Research': { type: 'relation', relation: [] },
      },
    });

    const changes: GroupedAtlasChanges = {
      changed: [],
      added: [],
      deleted: [
        {
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
        },
      ],
      parent_changed: [],
      sibling_order_changed: [],
    };

    const diffResult = createDiffResult(changes);
    const mockMappings = createMockUuidMappings();
    const result = await syncChangesToNotion(diffResult, { stopRequested: false }, mockMappings);

    expect(result.skipped.length).toBe(1);
    expect(result.skipped[0].result.reason).toBe('has_children');
    expect(mockNotionClient.getCallCount('pages.retrieve')).toBe(1); // Only for checking children
  });

  it('calls onProgress callback with correct phase and progress', async () => {
    mockNotionClient.addMockPage('page-1', {
      properties: { Name: { title: [{ text: { content: 'Name' } }] } },
    });

    const changes: GroupedAtlasChanges = {
      changed: [
        {
          uuid: 'page-1',
          changeType: 'changed',
          oldValues: {
            type: 'Section',
            doc_no: 'A.1',
            name: 'Old Name',
            uuid: 'page-1',
            content: '',
            last_modified: '',
          },
          newValues: {
            type: 'Section',
            doc_no: 'A.1',
            name: 'New Name',
            uuid: 'page-1',
            content: '',
            last_modified: '',
          },
        },
      ],
      added: [],
      deleted: [],
      parent_changed: [],
      sibling_order_changed: [],
    };

    const progressCalls: Array<{ phase: SyncPhase; completed: number; total: number }> = [];

    const diffResult = createDiffResult(changes);
    const mockMappings = createMockUuidMappings();
    await syncChangesToNotion(diffResult, { stopRequested: false }, mockMappings, (progress) => {
      progressCalls.push({
        phase: progress.phase,
        completed: progress.completedCount,
        total: progress.totalCount,
      });
    });

    expect(progressCalls.length).toBeGreaterThan(0);
    expect(progressCalls[0].phase).toBe('content');
    expect(progressCalls[0].total).toBe(1);
    expect(progressCalls[progressCalls.length - 1].phase).toBe('idle');
  });

  it('generates comprehensive logs', async () => {
    mockNotionClient.addMockPage('page-1', {
      properties: { Name: { title: [{ text: { content: 'Name' } }] } },
    });

    const changes: GroupedAtlasChanges = {
      changed: [
        {
          uuid: 'page-1',
          changeType: 'changed',
          oldValues: {
            type: 'Section',
            doc_no: 'A.1.2',
            name: 'Old Section Name',
            uuid: 'page-1',
            content: 'Old Content',
            last_modified: '',
          },
          newValues: {
            type: 'Section',
            doc_no: 'A.1.2',
            name: 'Section Name',
            uuid: 'page-1',
            content: 'Content',
            last_modified: '',
          },
          oldAncestry: [],
        },
      ],
      added: [],
      deleted: [],
      parent_changed: [],
      sibling_order_changed: [],
    };

    const diffResult = createDiffResult(changes);
    const mockMappings = createMockUuidMappings();
    const result = await syncChangesToNotion(diffResult, { stopRequested: false }, mockMappings);

    expect(result.logs.length).toBeGreaterThan(0);
    expect(result.logs.some((log) => log.message.includes('Starting sync'))).toBe(true);
    expect(result.logs.some((log) => log.message.includes('Phase 1'))).toBe(true);
    expect(result.logs.some((log) => log.message.includes('Sync completed'))).toBe(true);
  });
});
