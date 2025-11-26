import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAtlasUuidForNotionPageId, getNotionPageIdForAtlasUuid, storeUuidMapping } from '../uuid-mapping-service';

// Mock the supabase client
vi.mock('../supabase-client', () => ({
  supabase: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
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

  describe('getNotionPageIdForAtlasUuid', () => {
    it('should return Notion page ID when mapping exists', async () => {
      const { supabase } = await import('../supabase-client');
      const mockSingle = vi.fn().mockResolvedValue({
        data: { notion_page_id: 'notion-id-1' },
        error: null,
      });

      (supabase as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: mockSingle,
            }),
          }),
        }),
      });

      const result = await getNotionPageIdForAtlasUuid('atlas-uuid-1');

      expect(result).toBe('notion-id-1');
    });

    it('should return null when mapping does not exist', async () => {
      const { supabase } = await import('../supabase-client');
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      (supabase as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: mockSingle,
            }),
          }),
        }),
      });

      const result = await getNotionPageIdForAtlasUuid('non-existent-uuid');

      expect(result).toBeNull();
    });
  });

  describe('getAtlasUuidForNotionPageId', () => {
    it('should return Atlas UUID when mapping exists', async () => {
      const { supabase } = await import('../supabase-client');
      const mockSingle = vi.fn().mockResolvedValue({
        data: { atlas_document_uuid: 'atlas-uuid-1' },
        error: null,
      });

      (supabase as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: mockSingle,
            }),
          }),
        }),
      });

      const result = await getAtlasUuidForNotionPageId('notion-id-1');

      expect(result).toBe('atlas-uuid-1');
    });

    it('should return null when mapping does not exist', async () => {
      const { supabase } = await import('../supabase-client');
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      (supabase as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: mockSingle,
            }),
          }),
        }),
      });

      const result = await getAtlasUuidForNotionPageId('non-existent-id');

      expect(result).toBeNull();
    });
  });
});
