import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSyncBatch, getAuditLogEntriesForBatch, logNotionApiOperation } from '../audit-log-service';
import type { AuditLogEntry } from '../audit-log-service';

// Mock the supabase client
vi.mock('../supabase-client', () => ({
  supabase: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(),
        })),
      })),
    })),
  })),
}));

describe('Audit Log Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSyncBatch', () => {
    it('should return a UUID string', () => {
      const batchId = createSyncBatch();

      expect(typeof batchId).toBe('string');
      expect(batchId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should return unique IDs for each call', () => {
      const batchId1 = createSyncBatch();
      const batchId2 = createSyncBatch();

      expect(batchId1).not.toBe(batchId2);
    });
  });

  describe('logNotionApiOperation', () => {
    it('should log a successful operation', async () => {
      const { supabase } = await import('../supabase-client');
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      (supabase as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          insert: mockInsert,
        }),
      });

      const entry: AuditLogEntry = {
        operationType: 'create',
        notionPageId: 'page-1',
        atlasDocumentUuid: 'uuid-1',
        databaseName: 'Sections & Primary Docs',
        requestPayload: { test: 'data' },
        responsePayload: { result: 'ok' },
        success: true,
        syncBatchId: 'batch-1',
      };

      await logNotionApiOperation(entry);

      expect(mockInsert).toHaveBeenCalledWith({
        operation_type: 'create',
        notion_page_id: 'page-1',
        atlas_document_uuid: 'uuid-1',
        database_name: 'Sections & Primary Docs',
        request_payload: { test: 'data' },
        response_payload: { result: 'ok' },
        success: true,
        error_message: null,
        sync_batch_id: 'batch-1',
      });
    });

    it('should log a failed operation with error message', async () => {
      const { supabase } = await import('../supabase-client');
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      (supabase as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          insert: mockInsert,
        }),
      });

      const entry: AuditLogEntry = {
        operationType: 'update',
        notionPageId: 'page-1',
        atlasDocumentUuid: 'uuid-1',
        databaseName: 'Articles',
        requestPayload: { test: 'data' },
        success: false,
        errorMessage: 'Something went wrong',
        syncBatchId: 'batch-1',
      };

      await logNotionApiOperation(entry);

      expect(mockInsert).toHaveBeenCalledWith({
        operation_type: 'update',
        notion_page_id: 'page-1',
        atlas_document_uuid: 'uuid-1',
        database_name: 'Articles',
        request_payload: { test: 'data' },
        response_payload: null,
        success: false,
        error_message: 'Something went wrong',
        sync_batch_id: 'batch-1',
      });
    });

    it('should not throw on database error', async () => {
      const { supabase } = await import('../supabase-client');
      const mockInsert = vi.fn().mockResolvedValue({
        error: { message: 'database error' },
      });

      (supabase as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          insert: mockInsert,
        }),
      });

      const entry: AuditLogEntry = {
        operationType: 'delete',
        notionPageId: 'page-1',
        atlasDocumentUuid: null,
        databaseName: 'Scopes',
        requestPayload: {},
        success: true,
      };

      // Should not throw
      await expect(logNotionApiOperation(entry)).resolves.toBeUndefined();
    });
  });

  describe('getAuditLogEntriesForBatch', () => {
    it('should retrieve entries for a batch', async () => {
      const { supabase } = await import('../supabase-client');
      const mockOrder = vi.fn().mockResolvedValue({
        data: [
          {
            operation_type: 'create',
            notion_page_id: 'page-1',
            atlas_document_uuid: 'uuid-1',
            database_name: 'Articles',
            request_payload: {},
            response_payload: {},
            success: true,
            error_message: null,
            sync_batch_id: 'batch-1',
          },
        ],
        error: null,
      });

      (supabase as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: mockOrder,
            }),
          }),
        }),
      });

      const entries = await getAuditLogEntriesForBatch('batch-1');

      expect(entries).toHaveLength(1);
      expect(entries[0].operationType).toBe('create');
      expect(entries[0].notionPageId).toBe('page-1');
    });

    it('should return empty array when no entries found', async () => {
      const { supabase } = await import('../supabase-client');
      const mockOrder = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      (supabase as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: mockOrder,
            }),
          }),
        }),
      });

      const entries = await getAuditLogEntriesForBatch('non-existent-batch');

      expect(entries).toEqual([]);
    });

    it('should throw on database error', async () => {
      const { supabase } = await import('../supabase-client');
      const mockOrder = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'database error' },
      });

      (supabase as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: mockOrder,
            }),
          }),
        }),
      });

      await expect(getAuditLogEntriesForBatch('batch-1')).rejects.toThrow('Failed to get audit log entries for batch');
    });
  });
});
