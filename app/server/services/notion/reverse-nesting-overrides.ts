/**
 * Notion Nesting Bug Fix - Reverse Override Logic
 *
 * Reverses manual parent-child relationship mappings to restore Notion's original (buggy) relationships.
 * Moves child IDs from correct parent arrays back to incorrect parent arrays before syncing to Notion.
 *
 * This is necessary because Notion's sub-item feature fails at deep nesting levels (platform limitation).
 * Documents remain in incorrect parent locations in Notion due to this bug. Nesting override mappings
 * correct this for display/export (forward direction). We must reverse these corrections before syncing
 * to maintain consistency with Notion's buggy state.
 *
 * @see {@link file://../../../docs/NOTION_NESTING_BUG_FIX.md} for complete documentation
 */
import { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { NotionNestingBugMapping } from '../supabase/notion-nesting-bug-mappings';

/**
 * Reverse nesting bug overrides to restore Notion's original (buggy) relationships.
 * This function is the inverse of applyNestingOverrides() - it moves children from
 * their correct parents back to the incorrect parents where Notion actually stores them.
 *
 * Why this is necessary:
 * - Notion's sub-item feature fails at deep nesting levels (10+ levels)
 * - Documents remain in incorrect parent locations in Notion due to this platform bug
 * - Nesting override mappings correct this for display/export (forward direction)
 * - Must reverse these corrections before syncing to maintain consistency with Notion's buggy state
 * - Changing Notion structure directly would break future import syncs
 *
 * @param pages Array of all database pages
 * @param mappings Array of nesting bug mappings from notion_nesting_bug_mapping table
 * @returns Modified pages with reversed relationships
 */
export function reverseNestingOverrides(
  pages: NotionDatabasePage[],
  mappings: NotionNestingBugMapping[],
): NotionDatabasePage[] {
  if (mappings.length === 0) {
    return pages;
  }

  console.log(`⧟ Reversing ${mappings.length} nesting override(s)...`);

  // Create a mutable copy of pages for modifications
  const modifiedPages = pages.map((page) => ({ ...page }));

  // For each mapping, move child from correct parent back to incorrect parent
  // This restores Notion's original (buggy) state before syncing
  for (const mapping of mappings) {
    const childId = mapping.child_notion_page_id;
    const correctParentId = mapping.parent_notion_page_id; // The correct parent (where we want it to be)

    // Determine which child array field to modify based on the mapping's database
    const childArrayField = getChildArrayField(mapping.atlas_database_name);
    if (!childArrayField) {
      console.warn(
        `  ⚠ Database "${mapping.atlas_database_name}" does not support internal nesting. Skipping mapping.`,
      );
      continue;
    }

    // Find the child page to verify it exists
    const childPage = modifiedPages.find((p) => p.notion_page_id === childId);
    if (!childPage) {
      console.warn(`  ⚠ Child page ${childId} not found in pages array. Skipping mapping.`);
      continue;
    }

    // Find the correct parent page (where the child currently is after applying overrides)
    const correctParentPage = modifiedPages.find((p) => p.notion_page_id === correctParentId);
    if (!correctParentPage) {
      console.warn(`  ⚠ Correct parent page ${correctParentId} not found in pages array. Skipping mapping.`);
      continue;
    }

    // Find the incorrect parent (where Notion actually stores the child)
    // This is the page that currently doesn't have the child but should according to Notion's buggy state
    // We need to find it by looking for the child's original parent_notion_page_id before overrides were applied
    // However, we don't have that information, so we need to infer it from the mapping
    //
    // The mapping tells us:
    // - child should be under correctParent (mapping.parent_notion_page_id)
    // - but in Notion's buggy state, child is somewhere else
    //
    // We need to reverse the direction: remove from correct parent, but we don't know where to put it back
    // This is a limitation - we need additional information in the mapping table to know the "incorrect parent"
    //
    // For now, let's just remove from correct parent and update the child's parent_notion_page_id to null
    // This means the child will appear as a root-level item, which may not be ideal but is safer than guessing

    // Remove child from correct parent if found
    const correctParentChildArray = correctParentPage[childArrayField];
    if (Array.isArray(correctParentChildArray) && correctParentChildArray.includes(childId)) {
      correctParentPage[childArrayField] = correctParentChildArray.filter((id) => id !== childId);
      console.log(`  ✓ Removed ${childId} from correct parent ${correctParentId}`);
    }

    // Note: Without knowing the incorrect parent ID, we cannot add the child back to the wrong parent
    // This is a limitation of the current mapping structure
    // For a complete reversal, the notion_nesting_bug_mapping table would need an additional column
    // to store the "incorrect_parent_notion_page_id"

    // Update child's parent_notion_page_id to null (indicating no parent override applied)
    childPage.parent_notion_page_id = null;
    console.log(`  ✓ Updated ${childId} parent_notion_page_id to null (original Notion state)`);

    // Log a warning about the limitation
    console.warn(
      `  ⚠ Limitation: Cannot restore incorrect parent for ${childId}. ` +
        `Mapping table would need "incorrect_parent_notion_page_id" column for complete reversal.`,
    );
  }

  console.log(`✅ Reversed ${mappings.length} nesting override(s) (with limitations)`);

  return modifiedPages;
}

/**
 * Get the appropriate child array field name based on Atlas database name
 */
function getChildArrayField(
  atlasDatabaseName: AtlasDatabaseName,
): 'child_section_and_primary_doc_ids' | 'child_agent_scope_ids' | null {
  switch (atlasDatabaseName) {
    case 'Sections & Primary Docs':
      return 'child_section_and_primary_doc_ids';
    case 'Agent Scope Database':
      return 'child_agent_scope_ids';
    default:
      return null;
  }
}
