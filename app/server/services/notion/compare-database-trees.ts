import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { _delete_DatabaseSubItemTree } from './to_delete/_old.fetch-database-sub-items';

// Lightweight interface for tree comparison - only includes fields needed for comparison
export interface SupabasePageForComparison {
  notion_page_id: string;
  parent_notion_page_id: string | null;
  sort_order: number;
  updated_at: string;
}

export interface TreeComparisonResult {
  pagesToInsert: NotionDatabasePage[];
  pagesToUpdate: NotionDatabasePage[];
  pagesToDelete: string[]; // notion_page_ids
  unchangedPages: string[]; // notion_page_ids
}

export interface SupabaseTree {
  pagesById: Map<string, SupabasePageForComparison>;
  pageIdToParentId: Map<string, string | null>;
  pageIdToSubPageIds: Map<string, string[]>;
}

/**
 * Compare Notion tree with Supabase tree to determine what changes need to be made
 */
export function compareDatabaseTrees(
  notionTree: _delete_DatabaseSubItemTree,
  supabaseTree: SupabaseTree,
  notionPages: NotionDatabasePage[],
): TreeComparisonResult {
  const result: TreeComparisonResult = {
    pagesToInsert: [],
    pagesToUpdate: [],
    pagesToDelete: [],
    unchangedPages: [],
  };

  const notionPageIds = new Set(notionTree.pagesById.keys());
  const supabasePageIds = new Set(supabaseTree.pagesById.keys());

  // 1. Find pages that exist in Notion but not in Supabase (new pages)
  for (const notionPageId of notionPageIds) {
    if (!supabaseTree.pagesById.has(notionPageId)) {
      const notionPage = notionPages.find((p) => p.notion_page_id === notionPageId);
      if (notionPage) {
        result.pagesToInsert.push(notionPage);
      }
    }
  }

  // 2. Find pages that exist in Supabase but not in Notion (deleted pages)
  for (const supabasePageId of supabasePageIds) {
    if (!notionTree.pagesById.has(supabasePageId)) {
      result.pagesToDelete.push(supabasePageId);
    }
  }

  // 3. Find pages that exist in both but may need updates
  for (const notionPageId of notionPageIds) {
    if (supabaseTree.pagesById.has(notionPageId)) {
      const notionPage = notionPages.find((p) => p.notion_page_id === notionPageId);
      const supabasePage = supabaseTree.pagesById.get(notionPageId);

      if (notionPage && supabasePage) {
        if (pageNeedsUpdate(notionPage, supabasePage, notionTree, supabaseTree)) {
          result.pagesToUpdate.push(notionPage);
        } else {
          result.unchangedPages.push(notionPageId);
        }
      }
    }
  }

  return result;
}

/**
 * Check if a page needs to be updated by comparing content and tree structure
 */
function pageNeedsUpdate(
  notionPage: NotionDatabasePage,
  supabasePage: SupabasePageForComparison,
  notionTree: _delete_DatabaseSubItemTree,
  supabaseTree: SupabaseTree,
): boolean {
  // 1. Check if content has changed (last_edited_time vs updated_at)
  const notionLastEdited = new Date(notionPage.updated_at);
  const supabaseUpdated = new Date(supabasePage.updated_at);
  if (notionLastEdited > supabaseUpdated) {
    return true;
  }

  // 2. Check if parent-child relationships have changed
  const notionParentId = notionTree.pageIdToParentId.get(notionPage.notion_page_id) || null;
  const supabaseParentId = supabaseTree.pageIdToParentId.get(notionPage.notion_page_id) || null;
  if (notionParentId !== supabaseParentId) {
    return true;
  }

  // 3. Check if sort order has changed
  if (notionPage.sort_order !== supabasePage.sort_order) {
    return true;
  }

  // 4. Check if children have changed (number or order)
  const notionChildren = notionTree.pageIdToSubPageIds.get(notionPage.notion_page_id) || [];
  const supabaseChildren = supabaseTree.pageIdToSubPageIds.get(notionPage.notion_page_id) || [];

  if (notionChildren.length !== supabaseChildren.length) {
    return true;
  }

  // Check if children order has changed
  for (let i = 0; i < notionChildren.length; i++) {
    if (notionChildren[i] !== supabaseChildren[i]) {
      return true;
    }
  }

  return false;
}

/**
 * Convert Supabase pages to tree structure for comparison
 */
export function buildSupabaseTree(pages: SupabasePageForComparison[]): SupabaseTree {
  const pagesById = new Map<string, SupabasePageForComparison>();
  const pageIdToParentId = new Map<string, string | null>();
  const pageIdToSubPageIds = new Map<string, string[]>();

  // Build maps from Supabase pages
  for (const page of pages) {
    pagesById.set(page.notion_page_id, page);
    pageIdToParentId.set(page.notion_page_id, page.parent_notion_page_id || null);
  }

  // Build children relationships
  for (const page of pages) {
    if (page.parent_notion_page_id) {
      if (!pageIdToSubPageIds.has(page.parent_notion_page_id)) {
        pageIdToSubPageIds.set(page.parent_notion_page_id, []);
      }
      pageIdToSubPageIds.get(page.parent_notion_page_id)!.push(page.notion_page_id);
    }
  }

  // Sort children by sort_order
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for (const [parentId, children] of pageIdToSubPageIds.entries()) {
    children.sort((a, b) => {
      const pageA = pagesById.get(a);
      const pageB = pagesById.get(b);
      return (pageA?.sort_order || 0) - (pageB?.sort_order || 0);
    });
  }

  return { pagesById, pageIdToParentId, pageIdToSubPageIds };
}
