import { describe, expect, it } from 'vitest';
import { ATLAS_DATABASES, AtlasDocumentType } from '@/app/server/atlas/constants';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { sortAtlasDocumentsBySortOrder } from '../load-atlas-from-supabase';

// Helper function to create a mock NotionDatabasePage
function createMockPage(overrides: Partial<NotionDatabasePage>): NotionDatabasePage {
  return {
    notion_page_id: 'test-id',
    canonical_document_title: 'Test Document',
    atlas_document_type: 'Core' as AtlasDocumentType,
    atlas_document_number: 'A.1.1',
    atlas_database_name: ATLAS_DATABASES.SCOPES,
    has_children: false,
    archived: false,
    in_trash: false,
    plain_text_name: 'Test Name',
    json_name: {},
    plain_text_content: 'Test content',
    json_content: {},
    parent_notion_page_id: null,
    child_scope_ids: [],
    child_article_ids: [],
    child_section_and_primary_doc_ids: [],
    child_annotation_ids: [],
    child_tenet_ids: [],
    child_scenario_ids: [],
    child_scenario_variation_ids: [],
    child_active_data_ids: [],
    child_agent_scope_ids: [],
    child_needed_research_ids: [],
    extra_fields: {},
    sort_order: null,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z',
    last_edited_by_user_id: 'test-user',
    ...overrides,
  };
}

describe('sortAtlasDocumentsBySortOrder', () => {
  it('should keep documents with defined sort_order first, then null sort_order documents', () => {
    const pages: NotionDatabasePage[] = [
      createMockPage({ notion_page_id: 'page1', sort_order: null, canonical_document_title: 'Page 1 (null)' }),
      createMockPage({ notion_page_id: 'page2', sort_order: 1, canonical_document_title: 'Page 2 (order 1)' }),
      createMockPage({ notion_page_id: 'page3', sort_order: null, canonical_document_title: 'Page 3 (null)' }),
      createMockPage({ notion_page_id: 'page4', sort_order: 2, canonical_document_title: 'Page 4 (order 2)' }),
      createMockPage({
        notion_page_id: 'page5',
        sort_order: undefined,
        canonical_document_title: 'Page 5 (undefined)',
      }),
    ];

    const result = sortAtlasDocumentsBySortOrder(pages);

    // Check the order: documents with sort_order should come first, then null/undefined
    expect(result[0].canonical_document_title).toBe('Page 2 (order 1)');
    expect(result[1].canonical_document_title).toBe('Page 4 (order 2)');
    expect(result[2].canonical_document_title).toBe('Page 1 (null)');
    expect(result[3].canonical_document_title).toBe('Page 3 (null)');
    expect(result[4].canonical_document_title).toBe('Page 5 (undefined)');
  });

  it('should maintain relative order within each group', () => {
    const pages: NotionDatabasePage[] = [
      createMockPage({ notion_page_id: 'page1', sort_order: null, canonical_document_title: 'First null' }),
      createMockPage({ notion_page_id: 'page2', sort_order: null, canonical_document_title: 'Second null' }),
      createMockPage({ notion_page_id: 'page3', sort_order: 5, canonical_document_title: 'First with order' }),
      createMockPage({ notion_page_id: 'page4', sort_order: 3, canonical_document_title: 'Second with order' }),
    ];

    const result = sortAtlasDocumentsBySortOrder(pages);

    // Documents with sort_order should come first, maintaining their original relative order
    expect(result[0].canonical_document_title).toBe('First with order');
    expect(result[1].canonical_document_title).toBe('Second with order');

    // Documents without sort_order should come second, maintaining their original relative order
    expect(result[2].canonical_document_title).toBe('First null');
    expect(result[3].canonical_document_title).toBe('Second null');
  });

  it('should handle empty array', () => {
    const pages: NotionDatabasePage[] = [];
    const result = sortAtlasDocumentsBySortOrder(pages);
    expect(result).toEqual([]);
  });

  it('should handle array with only null sort_order documents', () => {
    const pages: NotionDatabasePage[] = [
      createMockPage({ notion_page_id: 'page1', sort_order: null }),
      createMockPage({ notion_page_id: 'page2', sort_order: null }),
    ];

    const result = sortAtlasDocumentsBySortOrder(pages);
    expect(result).toEqual(pages); // Should maintain original order
  });

  it('should handle array with only defined sort_order documents', () => {
    const pages: NotionDatabasePage[] = [
      createMockPage({ notion_page_id: 'page1', sort_order: 1 }),
      createMockPage({ notion_page_id: 'page2', sort_order: 2 }),
    ];

    const result = sortAtlasDocumentsBySortOrder(pages);
    expect(result).toEqual(pages); // Should maintain original order
  });
});
