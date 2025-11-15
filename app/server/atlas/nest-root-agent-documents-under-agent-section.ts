import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { AGENT_ROOT_SECTION_UUID_FOR_NESTING } from './constants';

// This function nests root Agent documents under the designated Agent section by updating its child_agent_scope_ids.
// The Notion relationships do not define this, but this is how the Atlas Explorer UI shows the hierarchy, agent documents are nested under a specific parent section.
export async function nestRootAgentDocumentsUnderAgentSection({
  allPages,
  rootAgentDocumentIds,
}: {
  allPages: NotionDatabasePage[];
  rootAgentDocumentIds: string[];
}): Promise<NotionDatabasePage[]> {
  console.log(`📝 Nesting ${rootAgentDocumentIds.length} root Agent documents under the Agent section...`);

  // Create a Set for O(1) lookup
  const rootAgentIdsSet = new Set(rootAgentDocumentIds);

  // Update pages:
  // 1. Remove root agents from any existing parent's child_agent_scope_ids
  // 2. Add root agents to the Agent Section's child_agent_scope_ids
  const updatedPages = allPages.map((page) => {
    // Add root agents to the designated Agent Section
    if (AGENT_ROOT_SECTION_UUID_FOR_NESTING === page.notion_page_id) {
      const existingChildIds = Array.isArray(page.child_agent_scope_ids)
        ? (page.child_agent_scope_ids as string[])
        : [];
      const mergedChildIds = Array.from(new Set([...existingChildIds, ...rootAgentDocumentIds]));

      return {
        ...page,
        child_agent_scope_ids: mergedChildIds,
      };
    }

    // Remove root agents from any other parent's child_agent_scope_ids
    // (they should only appear under the designated Agent Section)
    if (Array.isArray(page.child_agent_scope_ids) && page.child_agent_scope_ids.length > 0) {
      // TODO: Optimize this
      const filteredChildIds = page.child_agent_scope_ids.filter((childId) => !rootAgentIdsSet.has(childId));

      // Only update if we actually removed any children
      if (filteredChildIds.length !== page.child_agent_scope_ids.length) {
        console.log(
          `Removed root agent ${page.notion_page_id} from parent ${page.parent_notion_page_id}'s child_agent_scope_ids`,
        );
        return {
          ...page,
          child_agent_scope_ids: filteredChildIds,
        };
      }
    }

    return page;
  });

  return updatedPages;
}
