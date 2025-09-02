import { NotionDatabasePage } from '../database/notion-database-page';
import { TreeNode } from './tree';

// Convert Supabase NotionDatabasePage type to TreeNode type
export function convertSupabaseDatabasePagesToTreeNodes(pages: NotionDatabasePage[]): TreeNode[] {
  return pages.map((page) => ({
    id: page.notion_page_id,
    parentId: page.parent_notion_page_id || null,
    blockType: page.page_type,
    sortOrder: page.sort_order,
    rootNotionPageId: page.root_notion_database_id,
    canonicalDocumentTitle: page.canonical_document_title || '',
  }));
}
