import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import {
  loadNotionDatabasePagesAtTimeFromSupabase,
  loadNotionDatabasePagesFromSupabase,
} from './load-notion-database-pages-from-supabase';

type LoadAtlasOptions = {
  validAt?: string;
};

/**
 * Load all Atlas pages from Supabase in a single query.
 * Returns a flat array of all pages across all Atlas databases.
 *
 * Note: Agent nesting logic (previously handled here) is now performed in buildNotionAtlasTree
 * for better ordering and consistency.
 */
export async function loadAtlasFromSupabase(options: LoadAtlasOptions = {}): Promise<NotionDatabasePage[]> {
  const { validAt } = options;

  if (validAt) {
    // Load all pages at a specific time
    return await loadNotionDatabasePagesAtTimeFromSupabase({ validAt });
  } else {
    // Load all current pages
    return await loadNotionDatabasePagesFromSupabase({});
  }
}

/**
 * Load Atlas pages from Supabase as of a specific past date/time.
 * @param atDateTime - ISO 8601 timestamp string
 */
export async function loadAtlasFromSupabasePastVersion(atDateTime: string): Promise<NotionDatabasePage[]> {
  return loadAtlasFromSupabase({ validAt: atDateTime });
}
