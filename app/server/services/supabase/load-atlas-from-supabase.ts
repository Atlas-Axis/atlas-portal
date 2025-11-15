import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import {
  loadNotionDatabasePagesAtTimeFromSupabase,
  loadNotionDatabasePagesFromSupabase,
} from './load-notion-database-pages-from-supabase';

type LoadAtlasOptions = {
  validAt?: string;
};

/**
 * Agent Scope Database documents that are at the root level (no parent_notion_page_id) need to be nested under a specific Agent section
 */

/**
 * Generic helper function to load all Atlas pages from Supabase in a single query
 * Returns a flat array of all pages across all Atlas databases
 */
async function loadNotionDatabasePages(options: LoadAtlasOptions = {}): Promise<NotionDatabasePage[]> {
  const { validAt } = options;

  if (validAt) {
    // Load all pages at a specific time
    return await loadNotionDatabasePagesAtTimeFromSupabase({ validAt });
  } else {
    // Load all current pages
    return await loadNotionDatabasePagesFromSupabase({});
  }
}

export async function loadAtlasFromSupabaseWithoutNestingAgentsUnderSection(options: LoadAtlasOptions = {}) {
  return loadNotionDatabasePages(options);
}

// Load Atlas pages from Supabase, as of a specific past date/time
export async function loadAtlasFromSupabasePastVersion(atDateTime: string) {
  return loadNotionDatabasePages({ validAt: atDateTime });
}

// Load Atlas pages from Supabase (simplified - no agent nesting logic here)
// Agent nesting is now handled in buildNotionAtlasTree for better ordering
export async function loadAtlasFromSupabaseWithNestingAgentsUnderSection(
  options: LoadAtlasOptions = {},
): Promise<NotionDatabasePage[]> {
  return loadNotionDatabasePages(options);
}
