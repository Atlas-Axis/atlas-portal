import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { AGENT_ROOT_SECTION_UUID_FOR_NESTING } from './constants';

// This function nests root Agent documents under the designated Agent section by updating its child_agent_scope_ids.
// The Notion relationships do not define this, but this is how the Atlas Explorer UI shows the hierarchy, agent documents are nested under a specific parent section.
export async function nestRootAgentDocumentsUnderAgentSection({
  sectionsAndPrimaryDocsPages,
  rootAgentDocumentIds,
}: {
  sectionsAndPrimaryDocsPages: NotionDatabasePage[];
  rootAgentDocumentIds: string[];
}): Promise<NotionDatabasePage[]> {
  console.log(`📝 Nesting ${rootAgentDocumentIds.length} root Agent documents under the Agent section...`);

  const updatedSectionsAndPrimaryDocsPages = sectionsAndPrimaryDocsPages.map((page) => {
    if (AGENT_ROOT_SECTION_UUID_FOR_NESTING === page.notion_page_id) {
      // Merge existing child_agent_scope_ids with new ones, ensuring uniqueness
      const existingChildIds = Array.isArray(page.child_agent_scope_ids)
        ? (page.child_agent_scope_ids as string[])
        : [];
      const mergedChildIds = Array.from(new Set([...existingChildIds, ...rootAgentDocumentIds]));

      return {
        ...page,
        child_agent_scope_ids: mergedChildIds,
      };
    }
    return page;
  });

  return updatedSectionsAndPrimaryDocsPages;
}
