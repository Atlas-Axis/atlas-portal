/**
 * Notion Nesting Bug Fix - Override Logic
 *
 * Applies manual parent-child relationship mappings to fix incorrect Notion relationships.
 * Moves child IDs from incorrect parent arrays to correct parent arrays during tree building.
 *
 * @see {@link file://../../../docs/NOTION_NESTING_BUG_FIX.md} for complete documentation
 */
import { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { NotionNestingBugMapping } from '../supabase/notion-nesting-bug-mappings';

/**
 * Apply nesting bug overrides to all database pages in one pass
 * This function modifies the child_*_ids arrays to move children from their current parent to the correct parent
 * Works with a flat array of all pages and processes all mappings regardless of database
 */
export function applyNestingOverrides(
  pages: NotionDatabasePage[],
  mappings: NotionNestingBugMapping[],
): NotionDatabasePage[] {
  if (mappings.length === 0) {
    return pages;
  }

  console.log(`⧟ Applying ${mappings.length} nesting override(s)...`);

  // Create a mutable copy of pages for modifications
  const modifiedPages = pages.map((page) => ({ ...page }));

  // Apply each mapping
  for (const mapping of mappings) {
    const childId = mapping.child_notion_page_id;
    const newParentId = mapping.parent_notion_page_id;

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

    // Find the new parent page
    const newParentPage = modifiedPages.find((p) => p.notion_page_id === newParentId);
    if (!newParentPage) {
      console.warn(`  ⚠ Parent page ${newParentId} not found in pages array. Skipping mapping.`);
      continue;
    }

    // Find the current parent (the page that currently has this child in its array)
    // Note: Child may have been orphaned previously (not listed in any parent's children)
    const currentParentPage = modifiedPages.find((p) => {
      const childArray = p[childArrayField];
      return Array.isArray(childArray) && childArray.includes(childId);
    });

    // Remove child from current parent if found
    if (currentParentPage) {
      const childArray = currentParentPage[childArrayField];
      if (Array.isArray(childArray)) {
        currentParentPage[childArrayField] = childArray.filter((id) => id !== childId);
        console.log(`  ✓ Removed ${childId} from current parent ${currentParentPage.notion_page_id}`);
      }
    }

    // Add child to new parent
    const newParentChildArray = newParentPage[childArrayField];
    const existingArray: string[] = Array.isArray(newParentChildArray) ? newParentChildArray : [];
    if (!existingArray.includes(childId)) {
      // Check if we need to place the child after a specific sibling
      if (mapping.place_after_sibling_notion_page_id) {
        const siblingId = mapping.place_after_sibling_notion_page_id;
        const siblingIndex = existingArray.indexOf(siblingId);

        if (siblingIndex !== -1) {
          // Insert after the sibling
          const newArray: string[] = [...existingArray];
          newArray.splice(siblingIndex + 1, 0, childId);
          newParentPage[childArrayField] = newArray as (typeof newParentPage)[typeof childArrayField];
          console.log(
            `  ✓ Added ${childId} to new parent ${newParentId} after sibling ${siblingId} at index ${siblingIndex + 1}`,
          );
        } else {
          // Sibling not found, place at end with warning
          console.warn(`  ⚠ Sibling ${siblingId} not found in parent ${newParentId}, placing child ${childId} at end`);
          newParentPage[childArrayField] = [
            ...existingArray,
            childId,
          ] as (typeof newParentPage)[typeof childArrayField];
          console.log(`  ✓ Added ${childId} to new parent ${newParentId} (at end)`);
        }
      } else {
        // No sibling specified, place at end
        newParentPage[childArrayField] = [...existingArray, childId] as (typeof newParentPage)[typeof childArrayField];
        console.log(`  ✓ Added ${childId} to new parent ${newParentId}`);
      }
    } else {
      console.log(`  ℹ Child ${childId} already in new parent ${newParentId}`);
    }

    // Update the child's parent_notion_page_id to reflect the new parent
    childPage.parent_notion_page_id = newParentId;
    console.log(`  ✓ Updated ${childId} parent_notion_page_id to ${newParentId}`);
  }

  console.log(`✅ Applied ${mappings.length} nesting override(s)`);

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
