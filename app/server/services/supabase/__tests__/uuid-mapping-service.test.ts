import { beforeEach, describe, expect, it, vi } from 'vitest';
import { storeUuidMapping } from '../uuid-mapping-service';

// Mock the supabase client
vi.mock('../supabase-client', () => ({
  supabase: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(),
    })),
  })),
}));

describe('UUID Mapping Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('storeUuidMapping', () => {
    it('should store a UUID mapping successfully', async () => {
      const { supabase } = await import('../supabase-client');
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      (supabase as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          insert: mockInsert,
        }),
      });

      const result = await storeUuidMapping('notion-id-1', 'atlas-uuid-1');

      expect(mockInsert).toHaveBeenCalledWith({
        notion_page_id: 'notion-id-1',
        atlas_document_uuid: 'atlas-uuid-1',
      });
      expect(result.success).toBe(true);
      expect(result.skippedReason).toBeUndefined();
    });

    it('should return skippedReason when notion_page_id already exists', async () => {
      const { supabase } = await import('../supabase-client');
      const mockInsert = vi.fn().mockResolvedValue({
        error: { code: '23505', message: 'duplicate key value violates unique constraint on notion_page_id' },
      });

      (supabase as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          insert: mockInsert,
        }),
      });

      const result = await storeUuidMapping('notion-id-1', 'atlas-uuid-1');

      expect(result.success).toBe(false);
      expect(result.skippedReason).toBe('notion_page_id_exists');
    });

    it('should return skippedReason and warning when atlas_document_uuid already exists', async () => {
      const { supabase } = await import('../supabase-client');
      const mockInsert = vi.fn().mockResolvedValue({
        error: { code: '23505', message: 'duplicate key value violates unique constraint on atlas_document_uuid' },
      });

      (supabase as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          insert: mockInsert,
        }),
      });

      const result = await storeUuidMapping('notion-id-1', 'atlas-uuid-1');

      expect(result.success).toBe(false);
      expect(result.skippedReason).toBe('atlas_uuid_exists');
      expect(result.warning).toContain('already mapped to a DIFFERENT Notion page');
    });

    it('should handle generic duplicate key error gracefully', async () => {
      const { supabase } = await import('../supabase-client');
      const mockInsert = vi.fn().mockResolvedValue({
        error: { code: '23505', message: 'duplicate key' },
      });

      (supabase as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          insert: mockInsert,
        }),
      });

      const result = await storeUuidMapping('notion-id-1', 'atlas-uuid-1');

      // Should default to notion_page_id_exists when we can't determine which constraint was violated
      expect(result.success).toBe(false);
      expect(result.skippedReason).toBe('notion_page_id_exists');
    });

    it('should throw on other errors', async () => {
      const { supabase } = await import('../supabase-client');
      const mockInsert = vi.fn().mockResolvedValue({
        error: { code: 'OTHER', message: 'some error' },
      });

      (supabase as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          insert: mockInsert,
        }),
      });

      await expect(storeUuidMapping('notion-id-1', 'atlas-uuid-1')).rejects.toThrow('Failed to store UUID mapping');
    });
  });
});
