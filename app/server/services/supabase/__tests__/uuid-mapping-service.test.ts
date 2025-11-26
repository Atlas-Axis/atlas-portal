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

      await storeUuidMapping('notion-id-1', 'atlas-uuid-1');

      expect(mockInsert).toHaveBeenCalledWith({
        notion_page_id: 'notion-id-1',
        atlas_document_uuid: 'atlas-uuid-1',
      });
    });

    it('should handle duplicate key error gracefully', async () => {
      const { supabase } = await import('../supabase-client');
      const mockInsert = vi.fn().mockResolvedValue({
        error: { code: '23505', message: 'duplicate key' },
      });

      (supabase as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          insert: mockInsert,
        }),
      });

      // Should not throw
      await expect(storeUuidMapping('notion-id-1', 'atlas-uuid-1')).resolves.toBeUndefined();
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
