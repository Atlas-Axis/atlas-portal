import { describe, expect, it } from 'vitest';
import { STANDARDIZED_DOCUMENT_NUMBER, STANDARDIZED_DOCUMENT_TITLE } from '@/app/server/atlas/constants';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { Json } from '@/app/server/services/supabase/database.types';
import { compareDatabasePages } from '../compare-database-pages';
import { EnhancedPageObjectResponse } from '../fetch-database-pages';

// Helper to create a minimal Notion page for testing
function createMockNotionPage(
  id: string,
  plainTextContent: string,
  richTextContent: Json[],
  nameRichText?: Json[],
): EnhancedPageObjectResponse {
  const defaultName = [{ type: 'text', text: { content: 'Test Page', link: null }, plain_text: 'Test Page' }];
  return {
    id,
    object: 'page',
    created_time: '2024-01-01T00:00:00.000Z',
    last_edited_time: '2024-01-01T00:00:00.000Z',
    created_by: { object: 'user', id: 'user-1' },
    last_edited_by: { object: 'user', id: 'user-1' },
    cover: null,
    icon: null,
    parent: { type: 'database_id', database_id: 'db-1' },
    archived: false,
    in_trash: false,
    properties: {
      'Doc No (or Temp Name)': {
        id: 'title',
        type: 'title',
        title: (nameRichText || defaultName) as never[],
      },
      'Doc No': {
        id: 'doc-no',
        type: 'rich_text',
        rich_text: [{ type: 'text', text: { content: 'A.1', link: null }, plain_text: 'A.1' }] as never[],
      },
      Type: {
        id: 'type',
        type: 'select',
        select: { id: 'type-1', name: 'Section', color: 'default' },
      },
      Content: {
        id: 'content',
        type: 'rich_text',
        rich_text: richTextContent as never[],
      },
      'No.': {
        id: 'sort-order',
        type: 'number',
        number: 0,
      },
      // Standardized properties - must match Supabase values for "unchanged" tests
      [STANDARDIZED_DOCUMENT_NUMBER]: {
        id: 'doc-number',
        type: 'rich_text',
        rich_text: [{ type: 'text', text: { content: 'A.1', link: null }, plain_text: 'A.1' }] as never[],
      },
      [STANDARDIZED_DOCUMENT_TITLE]: {
        id: 'doc-title',
        type: 'rich_text',
        rich_text: (nameRichText || defaultName) as never[],
      },
    },
    url: `https://www.notion.so/${id}`,
    public_url: null,
    enhancedRelations: new Map(),
  } as EnhancedPageObjectResponse;
}

// Helper to create a minimal Supabase page for testing
function createMockSupabasePage(
  id: string,
  plainTextContent: string,
  jsonContent: Json,
  jsonName: Json,
): NotionDatabasePage {
  return {
    notion_page_id: id,
    atlas_document_type: 'Section',
    atlas_document_number: 'A.1',
    atlas_database_name: 'Sections & Primary Docs',
    has_children: false,
    archived: false,
    in_trash: false,
    plain_text_content: plainTextContent,
    json_content: jsonContent,
    plain_text_name: 'Test Page',
    json_name: jsonName,
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
    sort_order: 0, // Match Notion's default of 0
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
    last_edited_by_user_id: 'user-1',
  };
}

describe('compareDatabasePages - Rich Text Change Detection', () => {
  describe('Mention target changes', () => {
    it('should detect when mention page ID changes but label text stays the same', () => {
      const pageId = 'page-1';
      const plainText = 'See A.1.3 - General Provisions for details';

      // Original mention with page ID 'target-123'
      const originalRichText: Json[] = [
        { type: 'text', text: { content: 'See ', link: null }, plain_text: 'See ' },
        {
          type: 'mention',
          mention: { type: 'page', page: { id: 'target-123' } },
          plain_text: 'A.1.3 - General Provisions',
        },
        { type: 'text', text: { content: ' for details', link: null }, plain_text: ' for details' },
      ];

      // Updated mention with different page ID 'target-456' but same label
      const updatedRichText: Json[] = [
        { type: 'text', text: { content: 'See ', link: null }, plain_text: 'See ' },
        {
          type: 'mention',
          mention: { type: 'page', page: { id: 'target-456' } }, // Different page ID
          plain_text: 'A.1.3 - General Provisions', // Same label
        },
        { type: 'text', text: { content: ' for details', link: null }, plain_text: ' for details' },
      ];

      const notionPages = [createMockNotionPage(pageId, plainText, updatedRichText)];
      const supabasePages = [
        createMockSupabasePage(pageId, plainText, originalRichText, [
          { type: 'text', text: { content: 'Test Page', link: null }, plain_text: 'Test Page' },
        ]),
      ];

      const changes = compareDatabasePages({
        supabasePages,
        notionPages,
        atlasDatabaseName: 'Sections & Primary Docs',
      });

      // Should detect the change even though plain text is identical
      expect(changes.changedProperties).toContain(pageId);
      expect(changes.unchangedPages).not.toContain(pageId);
    });

    it('should not flag unchanged mention references', () => {
      const pageId = 'page-1';
      const plainText = 'See A.1.3 - General Provisions for details';

      const richText: Json[] = [
        { type: 'text', text: { content: 'See ', link: null }, plain_text: 'See ' },
        {
          type: 'mention',
          mention: { type: 'page', page: { id: 'target-123' } },
          plain_text: 'A.1.3 - General Provisions',
        },
        { type: 'text', text: { content: ' for details', link: null }, plain_text: ' for details' },
      ];

      const notionPages = [createMockNotionPage(pageId, plainText, richText)];
      const supabasePages = [
        createMockSupabasePage(pageId, plainText, richText, [
          { type: 'text', text: { content: 'Test Page', link: null }, plain_text: 'Test Page' },
        ]),
      ];

      const changes = compareDatabasePages({
        supabasePages,
        notionPages,
        atlasDatabaseName: 'Sections & Primary Docs',
      });

      // Should not detect any changes
      expect(changes.changedProperties).not.toContain(pageId);
      expect(changes.unchangedPages).toContain(pageId);
    });
  });

  describe('Formatting changes', () => {
    it('should detect when text formatting changes (bold added)', () => {
      const pageId = 'page-1';
      const plainText = 'This is important text';

      // Original: no formatting
      const originalRichText: Json[] = [
        { type: 'text', text: { content: 'This is important text', link: null }, plain_text: 'This is important text' },
      ];

      // Updated: bold added
      const updatedRichText: Json[] = [
        {
          type: 'text',
          text: { content: 'This is important text', link: null },
          annotations: { bold: true },
          plain_text: 'This is important text',
        },
      ];

      const notionPages = [createMockNotionPage(pageId, plainText, updatedRichText)];
      const supabasePages = [
        createMockSupabasePage(pageId, plainText, originalRichText, [
          { type: 'text', text: { content: 'Test Page', link: null }, plain_text: 'Test Page' },
        ]),
      ];

      const changes = compareDatabasePages({
        supabasePages,
        notionPages,
        atlasDatabaseName: 'Sections & Primary Docs',
      });

      // Should detect the formatting change
      expect(changes.changedProperties).toContain(pageId);
    });

    it('should detect when code formatting is added', () => {
      const pageId = 'page-1';
      const plainText = 'const x = 42;';

      // Original: plain text
      const originalRichText: Json[] = [
        { type: 'text', text: { content: 'const x = 42;', link: null }, plain_text: 'const x = 42;' },
      ];

      // Updated: code formatting
      const updatedRichText: Json[] = [
        {
          type: 'text',
          text: { content: 'const x = 42;', link: null },
          annotations: { code: true },
          plain_text: 'const x = 42;',
        },
      ];

      const notionPages = [createMockNotionPage(pageId, plainText, updatedRichText)];
      const supabasePages = [
        createMockSupabasePage(pageId, plainText, originalRichText, [
          { type: 'text', text: { content: 'Test Page', link: null }, plain_text: 'Test Page' },
        ]),
      ];

      const changes = compareDatabasePages({
        supabasePages,
        notionPages,
        atlasDatabaseName: 'Sections & Primary Docs',
      });

      // Should detect the code formatting change
      expect(changes.changedProperties).toContain(pageId);
    });
  });

  describe('Plain text changes still detected', () => {
    it('should detect plain text content changes', () => {
      const pageId = 'page-1';

      const originalRichText: Json[] = [
        { type: 'text', text: { content: 'Original text', link: null }, plain_text: 'Original text' },
      ];

      const updatedRichText: Json[] = [
        { type: 'text', text: { content: 'Updated text', link: null }, plain_text: 'Updated text' },
      ];

      const notionPages = [createMockNotionPage(pageId, 'Updated text', updatedRichText)];
      const supabasePages = [
        createMockSupabasePage(pageId, 'Original text', originalRichText, [
          { type: 'text', text: { content: 'Test Page', link: null }, plain_text: 'Test Page' },
        ]),
      ];

      const changes = compareDatabasePages({
        supabasePages,
        notionPages,
        atlasDatabaseName: 'Sections & Primary Docs',
      });

      // Should detect the text change
      expect(changes.changedProperties).toContain(pageId);
    });
  });

  describe('Title/Name rich text changes', () => {
    it('should detect when title formatting changes', () => {
      const pageId = 'page-1';
      const plainText = 'Test content';

      const richText: Json[] = [
        { type: 'text', text: { content: 'Test content', link: null }, plain_text: 'Test content' },
      ];

      // Original name: plain
      const originalName: Json[] = [
        { type: 'text', text: { content: 'Test Page', link: null }, plain_text: 'Test Page' },
      ];

      // Updated name: with bold
      const updatedName: Json[] = [
        {
          type: 'text',
          text: { content: 'Test Page', link: null },
          annotations: { bold: true },
          plain_text: 'Test Page',
        },
      ];

      const notionPages = [createMockNotionPage(pageId, plainText, richText, updatedName)];
      const supabasePages = [createMockSupabasePage(pageId, plainText, richText, originalName)];

      const changes = compareDatabasePages({
        supabasePages,
        notionPages,
        atlasDatabaseName: 'Sections & Primary Docs',
      });

      // Should detect the name/title formatting change
      expect(changes.changedProperties).toContain(pageId);
    });
  });

  describe('New and deleted pages', () => {
    it('should detect new pages', () => {
      const pageId = 'new-page';
      const plainText = 'New content';
      const richText: Json[] = [
        { type: 'text', text: { content: 'New content', link: null }, plain_text: 'New content' },
      ];

      const notionPages = [createMockNotionPage(pageId, plainText, richText)];
      const supabasePages: NotionDatabasePage[] = []; // Empty - no existing pages

      const changes = compareDatabasePages({
        supabasePages,
        notionPages,
        atlasDatabaseName: 'Sections & Primary Docs',
      });

      expect(changes.newPages).toContain(pageId);
    });

    it('should detect deleted pages', () => {
      const pageId = 'deleted-page';
      const plainText = 'Old content';
      const richText: Json[] = [
        { type: 'text', text: { content: 'Old content', link: null }, plain_text: 'Old content' },
      ];

      const notionPages: EnhancedPageObjectResponse[] = []; // Empty - page deleted
      const supabasePages = [
        createMockSupabasePage(pageId, plainText, richText, [
          { type: 'text', text: { content: 'Test Page', link: null }, plain_text: 'Test Page' },
        ]),
      ];

      const changes = compareDatabasePages({
        supabasePages,
        notionPages,
        atlasDatabaseName: 'Sections & Primary Docs',
      });

      expect(changes.deletedPages).toContain(pageId);
    });
  });

  describe('Complex scenarios', () => {
    it('should detect multiple mention changes in single content block', () => {
      const pageId = 'page-1';
      const plainText = 'See Doc A and Doc B for details';

      // Original: two mentions
      const originalRichText: Json[] = [
        { type: 'text', text: { content: 'See ', link: null }, plain_text: 'See ' },
        {
          type: 'mention',
          mention: { type: 'page', page: { id: 'doc-a-v1' } },
          plain_text: 'Doc A',
        },
        { type: 'text', text: { content: ' and ', link: null }, plain_text: ' and ' },
        {
          type: 'mention',
          mention: { type: 'page', page: { id: 'doc-b-v1' } },
          plain_text: 'Doc B',
        },
        { type: 'text', text: { content: ' for details', link: null }, plain_text: ' for details' },
      ];

      // Updated: second mention changed
      const updatedRichText: Json[] = [
        { type: 'text', text: { content: 'See ', link: null }, plain_text: 'See ' },
        {
          type: 'mention',
          mention: { type: 'page', page: { id: 'doc-a-v1' } }, // Same
          plain_text: 'Doc A',
        },
        { type: 'text', text: { content: ' and ', link: null }, plain_text: ' and ' },
        {
          type: 'mention',
          mention: { type: 'page', page: { id: 'doc-b-v2' } }, // Changed
          plain_text: 'Doc B',
        },
        { type: 'text', text: { content: ' for details', link: null }, plain_text: ' for details' },
      ];

      const notionPages = [createMockNotionPage(pageId, plainText, updatedRichText)];
      const supabasePages = [
        createMockSupabasePage(pageId, plainText, originalRichText, [
          { type: 'text', text: { content: 'Test Page', link: null }, plain_text: 'Test Page' },
        ]),
      ];

      const changes = compareDatabasePages({
        supabasePages,
        notionPages,
        atlasDatabaseName: 'Sections & Primary Docs',
      });

      expect(changes.changedProperties).toContain(pageId);
    });
  });
});
