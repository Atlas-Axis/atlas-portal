import { NotionDatabasePage } from '../database/notion-database-page';
import { TreeNode } from './tree';

// Convert Supabase NotionDatabasePage type to TreeNode type
export function convertSupabaseDatabasePagesToTreeNodes(pages: NotionDatabasePage[]): TreeNode[] {
  return pages.map((page) => ({
    id: page.notion_page_id,
    parentId: page.parent_notion_page_id || null,
    type: page.atlas_document_type,
    sortOrder: page.sort_order,
    atlasDocumentType: page.atlas_document_type,
    canonicalDocumentTitle: page.canonical_document_title || '',
  }));
}
