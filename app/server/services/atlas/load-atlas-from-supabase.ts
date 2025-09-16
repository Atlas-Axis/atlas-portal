import { loadNotionDatabasePagesFromSupabase } from '../supabase/load-notion-database-pages-from-supabase';
import { ATLAS_DATABASES } from './constants';
import { nestRootAgentDocumentsUnderAgentSection } from './nest-root-agent-documents-under-agent-section';

export async function loadAtlasFromSupabase() {
  const agentPages = await loadNotionDatabasePagesFromSupabase({ atlasDatabaseName: ATLAS_DATABASES.AGENTS });
  const sectionsAndPrimaryDocsPages = await loadNotionDatabasePagesFromSupabase({
    atlasDatabaseName: ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS,
  });
  const rootAgentDocumentIds = agentPages
    .filter((page) => page.parent_notion_page_id === null)
    .map((page) => page.notion_page_id);

  // Nest root Agent documents under a specific Agent section - the relationship is not set in Notion, so we do it here. This is how the Atlas Explorer UI does it.
  const updatedSectionsAndPrimaryDocsPages = await nestRootAgentDocumentsUnderAgentSection({
    sectionsAndPrimaryDocsPages,
    rootAgentDocumentIds,
  });

  // Load Atlas pages from Supabase
  const atlasPagesPerDatabase = {
    [ATLAS_DATABASES.SCOPES]: await loadNotionDatabasePagesFromSupabase({ atlasDatabaseName: ATLAS_DATABASES.SCOPES }),
    [ATLAS_DATABASES.ARTICLES]: await loadNotionDatabasePagesFromSupabase({
      atlasDatabaseName: ATLAS_DATABASES.ARTICLES,
    }),
    [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: updatedSectionsAndPrimaryDocsPages,
    [ATLAS_DATABASES.AGENTS]: agentPages,
    [ATLAS_DATABASES.ANNOTATIONS]: await loadNotionDatabasePagesFromSupabase({
      atlasDatabaseName: ATLAS_DATABASES.ANNOTATIONS,
    }),
    [ATLAS_DATABASES.TENETS]: await loadNotionDatabasePagesFromSupabase({ atlasDatabaseName: ATLAS_DATABASES.TENETS }),
    [ATLAS_DATABASES.ACTIVE_DATA]: await loadNotionDatabasePagesFromSupabase({
      atlasDatabaseName: ATLAS_DATABASES.ACTIVE_DATA,
    }),
    // [ATLAS_DATABASES.SCENARIOS]: await loadNotionDatabasePagesFromSupabase({
    //   atlasDatabaseName: ATLAS_DATABASES.SCENARIOS,
    // }),
    // [ATLAS_DATABASES.SCENARIO_VARIATIONS]: await loadNotionDatabasePagesFromSupabase({
    //   atlasDatabaseName: ATLAS_DATABASES.SCENARIO_VARIATIONS,
    // }),
    // [ATLAS_DATABASES.NEEDED_RESEARCH]: await loadNotionDatabasePagesFromSupabase({
    //   atlasDatabaseName: ATLAS_DATABASES.NEEDED_RESEARCH,
    // }),
  };

  return atlasPagesPerDatabase;
}
