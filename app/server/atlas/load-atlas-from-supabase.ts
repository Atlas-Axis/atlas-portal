import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import {
  loadNotionDatabasePagesAtTimeFromSupabase,
  loadNotionDatabasePagesFromSupabase,
} from '../services/supabase/load-notion-database-pages-from-supabase';
import { ATLAS_DATABASES, ATLAS_DATABASE_NAMES, AtlasDatabaseName } from './constants';
import { nestRootAgentDocumentsUnderAgentSection } from './nest-root-agent-documents-under-agent-section';

type LoadAtlasOptions = {
  excludeAgents?: boolean;
  validAt?: string;
};

/**
 * Agent Scope Database documents that are at the root level (no parent_notion_page_id) need to be nested under a specific Agent section
 */

/**
 * Generic helper function to load Atlas pages from Supabase with various options
 */
async function loadNotionDatabasePages(options: LoadAtlasOptions = {}) {
  const { excludeAgents = false, validAt } = options;

  const atlasPagesPerDatabase: Record<AtlasDatabaseName, NotionDatabasePage[]> = {} as Record<
    AtlasDatabaseName,
    NotionDatabasePage[]
  >;

  for (const databaseName of ATLAS_DATABASE_NAMES) {
    if (excludeAgents && databaseName === ATLAS_DATABASES.AGENTS) {
      atlasPagesPerDatabase[databaseName] = [];
    } else if (validAt) {
      atlasPagesPerDatabase[databaseName] = await loadNotionDatabasePagesAtTimeFromSupabase({
        atlasDatabaseName: databaseName,
        validAt,
      });
    } else {
      atlasPagesPerDatabase[databaseName] = await loadNotionDatabasePagesFromSupabase({
        atlasDatabaseName: databaseName,
      });
    }
  }

  return atlasPagesPerDatabase;
}

export async function loadAtlasFromSupabaseWithoutNestingAgentsUnderSection(options: LoadAtlasOptions = {}) {
  return loadNotionDatabasePages(options);
}

// Load Atlas pages from Supabase, as of a specific past date/time
export async function loadAtlasFromSupabasePastVersion(atDateTime: string) {
  return loadNotionDatabasePages({ validAt: atDateTime });
}

// Load Atlas pages from Supabase, with additional nesting logic applied
// This is needed for the Agents database, where root-level Agent documents need to be nested under a specific Agent section to match the Atlas Explorer UI
export async function loadAtlasFromSupabaseWithNestingAgentsUnderSection(options: LoadAtlasOptions = {}) {
  // Load the base Atlas data
  const atlasPagesPerDatabase = await loadNotionDatabasePages(options);

  const agentPages = atlasPagesPerDatabase[ATLAS_DATABASES.AGENTS];
  const sectionsAndPrimaryDocsPages = atlasPagesPerDatabase[ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS];

  const rootAgentDocumentIds = agentPages
    .filter((page: NotionDatabasePage) => page.parent_notion_page_id === null)
    .map((page: NotionDatabasePage) => page.notion_page_id);

  // Nest root Agent documents under a specific Agent section below Agent Scope - the relationship is not set in Notion, so we do it here. This is how the Atlas Explorer UI does it.
  const updatedSectionsAndPrimaryDocsPages = await nestRootAgentDocumentsUnderAgentSection({
    sectionsAndPrimaryDocsPages,
    rootAgentDocumentIds,
  });

  // Return the updated data with nesting applied
  return {
    ...atlasPagesPerDatabase,
    [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: updatedSectionsAndPrimaryDocsPages,
  };
}
