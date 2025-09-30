import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { TreeNode } from '../tree';

// Convert Supabase NotionDatabasePage type to TreeNode type
// TODO: Update all tree functions to support the new flexible child ID list mapping, instead of the old parent_notion_page_id field
export function convertSupabaseDatabasePagesToTreeNodes(pages: NotionDatabasePage[]): TreeNode[] {
  // Build a quick lookup for child->parent by scanning all child arrays
  const childToParent = new Map<string, string>();

  for (const parent of pages) {
    const childArrays: string[][] = [
      (parent.child_scope_ids as string[]) || [],
      (parent.child_article_ids as string[]) || [],
      (parent.child_section_and_primary_doc_ids as string[]) || [],
      (parent.child_annotation_ids as string[]) || [],
      (parent.child_tenet_ids as string[]) || [],
      (parent.child_scenario_ids as string[]) || [],
      (parent.child_scenario_variation_ids as string[]) || [],
      (parent.child_active_data_ids as string[]) || [],
      (parent.child_agent_scope_ids as string[]) || [],
      (parent.child_needed_research_ids as string[]) || [],
    ];

    for (const arr of childArrays) {
      for (const childId of arr) {
        if (childToParent.has(childId)) {
          console.warn(
            `⚠️  Child ${childId} already has parent ${childToParent.get(childId)}, but parent ${parent.notion_page_id} also claims it as a child. This may indicate duplicate relationships.`,
          );
        }
        childToParent.set(childId, parent.notion_page_id);
      }
    }
  }

  // TODO: Use child IDs instead of parent IDs for tree building
  return pages.map((page) => ({
    id: page.notion_page_id,
    parentId: childToParent.get(page.notion_page_id) || null,
    type: page.atlas_document_type,
    sortOrder: page.sort_order,
    atlasDocumentType: page.atlas_document_type,
    canonicalDocumentTitle: page.canonical_document_title || '',
  }));
}
