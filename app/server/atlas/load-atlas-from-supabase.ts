import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import {
  loadNotionDatabasePagesAtTimeFromSupabase,
  loadNotionDatabasePagesFromSupabase,
} from '../services/supabase/load-notion-database-pages-from-supabase';
import { getAllButLastTitlePart } from './atlas-tree-helpers';
import { compareDocNumbers } from './atlas-utils';
import { ATLAS_DATABASES, ATLAS_DATABASE_NAMES, AtlasDatabaseName } from './constants';
import { nestRootAgentDocumentsUnderAgentSection } from './nest-root-agent-documents-under-agent-section';

/**
 * Sorts Atlas documents to ensure documents with null/undefined sort_order values come first,
 * followed by documents with defined sort_order values.
 * Maintains the original relative order within each group.
 */
function sortAtlasDocumentsBySortOrderExistence(pages: NotionDatabasePage[]): NotionDatabasePage[] {
  // Separate documents into two groups: those with defined sort_order and those without
  const withSortOrder: NotionDatabasePage[] = [];
  const withoutSortOrder: NotionDatabasePage[] = [];

  for (const page of pages) {
    if (page.sort_order !== null && page.sort_order !== undefined) {
      withSortOrder.push(page);
    } else {
      withoutSortOrder.push(page);
    }
  }

  // Return documents with empty sort_order first, then those with a defined sort_order
  return [...withoutSortOrder, ...withSortOrder];
}

function sortAtlasDocumentsByDocumentNumber<T extends { atlas_document_number: string }>(documents: T[]): T[] {
  return [...documents].sort((a, b) =>
    compareDocNumbers(getAllButLastTitlePart(a.atlas_document_number), getAllButLastTitlePart(b.atlas_document_number)),
  );
}

type LoadAtlasOptions = {
  excludeAgents?: boolean;
  validAt?: string;
};

/**
 * Agent Scope Database documents that are at the root level (no parent_notion_page_id) need to be nested under a specific Agent section
 */

/**
 * Generic helper function to load Atlas pages from Supabase with various options
 * Automatically sorts documents in each database to ensure those with defined sort_order come first
 */
async function loadNotionDatabasePages(options: LoadAtlasOptions = {}) {
  const { excludeAgents = false, validAt } = options;

  const atlasPagesPerDatabase: Record<AtlasDatabaseName, NotionDatabasePage[]> = {} as Record<
    AtlasDatabaseName,
    NotionDatabasePage[]
  >;

  for (const databaseName of ATLAS_DATABASE_NAMES) {
    let pages: NotionDatabasePage[];

    if (excludeAgents && databaseName === ATLAS_DATABASES.AGENTS) {
      pages = [];
    } else if (validAt) {
      pages = await loadNotionDatabasePagesAtTimeFromSupabase({
        atlasDatabaseName: databaseName,
        validAt,
      });
    } else {
      pages = await loadNotionDatabasePagesFromSupabase({
        atlasDatabaseName: databaseName,
      });
    }

    atlasPagesPerDatabase[databaseName] = pages;

    // Sort documents to ensure those with defined sort_order come first
    // atlasPagesPerDatabase[databaseName] = sortAtlasDocumentsBySortOrderExistence(pages);

    // Sort documents by document number within each database. When document number is missing, those documents will appear last in the order.
    // atlasPagesPerDatabase[databaseName] = sortAtlasDocumentsBySortOrderExistence(
    // sortAtlasDocumentsByDocumentNumber(pages),
    // pages,
    // );
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
  // Load the base Atlas data (already sorted by loadNotionDatabasePages)
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

  // Return the updated data with nesting applied, re-sorting only the modified SECTIONS_AND_PRIMARY_DOCS
  return {
    ...atlasPagesPerDatabase,
    // [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: sortAtlasDocumentsBySortOrderExistence(updatedSectionsAndPrimaryDocsPages),
    // [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: sortAtlasDocumentsByDocumentNumber(updatedSectionsAndPrimaryDocsPages),
    // [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: sortAtlasDocumentsBySortOrderExistence(
    [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: updatedSectionsAndPrimaryDocsPages,
  };
}
