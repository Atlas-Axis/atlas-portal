import { supabase } from '@/app/server/services/supabase/supabase-client';
import { NotionDatabasePage } from '../../database/notion-database-page';
import { AtlasDatabaseName } from '../atlas/constants';

// Map of Atlas database names to their custom sort criteria (as an ordered list)
// null means use default sorting criteria
const ATLAS_DATABASE_SORT_CRITERIA_OVERRIDES: Partial<Record<AtlasDatabaseName, (keyof NotionDatabasePage)[] | null>> =
  {
    'Sections & Primary Docs': ['sort_order', 'canonical_document_title'],
    'Agent Scope Database': ['atlas_document_number_sortable'], // Use computed column for natural sorting
  };

// Default sorting criteria (as an ordered list)
// Use atlas_document_number_sortable for proper natural sorting (A.1.2 before A.1.11)
const DEFAULT_SORT_CRITERIA: (keyof NotionDatabasePage)[] = [
  'sort_order',
  'atlas_document_number_sortable',
  'canonical_document_title',
];

function getSortCriteria(atlasDatabaseName: AtlasDatabaseName): (keyof NotionDatabasePage)[] {
  return ATLAS_DATABASE_SORT_CRITERIA_OVERRIDES[atlasDatabaseName] ?? DEFAULT_SORT_CRITERIA;
}

export async function loadNotionDatabasePagesFromSupabase({
  atlasDatabaseName,
}: {
  atlasDatabaseName: AtlasDatabaseName;
}): Promise<NotionDatabasePage[]> {
  const allPages: NotionDatabasePage[] = [];
  let page = 0;
  const pageSize = 1000;

  // Get custom sort criteria based on database name
  const sortCriteria = getSortCriteria(atlasDatabaseName);

  // Load all pages from Supabase with pagination
  while (true) {
    let query = supabase()
      .from('notion_database_pages')
      .select('*')
      .is('date_valid_to', null)
      .eq('archived', false)
      .eq('in_trash', false)
      .eq('atlas_database_name', atlasDatabaseName)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    // Apply ordering as chained .order calls
    for (const col of sortCriteria) {
      query = query.order(col as keyof NotionDatabasePage);
    }

    const { data, error } = await query;

    // Check for errors
    if (error) {
      console.error({ error });
      throw new Error(`Failed to load pages (page ${page}): ${error.message}`, { cause: error });
    }
    if (!data || data.length === 0) break;

    // Add the loaded pages to the allPages array
    allPages.push(...(data as NotionDatabasePage[]));

    // If we got less than pageSize, we've reached the end
    if (data.length < pageSize) break;

    page++;
  }

  console.log(`Loaded ${allPages.length} "${atlasDatabaseName}" pages from Supabase`);
  return allPages;
}

/**
 * Usage:
 *   const rows = await loadNotionDatabasePagesAtTimeFromSupabase({
 *    atlasDatabaseName: 'Articles',
 *    validAt: '2025-01-01T00:00:00Z', // or new Date()
 *   });
 */
export async function loadNotionDatabasePagesAtTimeFromSupabase({
  atlasDatabaseName,
  validAt,
}: {
  atlasDatabaseName: AtlasDatabaseName;
  validAt: string | Date;
}): Promise<NotionDatabasePage[]> {
  const allPages: NotionDatabasePage[] = [];
  let page = 0;
  const pageSize = 1000;

  const sortCriteria = getSortCriteria(atlasDatabaseName);

  const validAtIso = (validAt instanceof Date ? validAt : new Date(validAt)).toISOString();

  while (true) {
    let query = supabase()
      .from('notion_database_pages')
      .select('*')
      .lte('date_valid_from', validAtIso)
      .or(`date_valid_to.is.null,date_valid_to.gt.${validAtIso}`)
      .eq('archived', false)
      .eq('in_trash', false)
      .eq('atlas_database_name', atlasDatabaseName)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    for (const col of sortCriteria) {
      query = query.order(col as keyof NotionDatabasePage);
    }

    const { data, error } = await query;

    if (error) {
      console.error({ error });
      throw new Error(`Failed to load pages at time (page ${page}): ${error.message}`, { cause: error });
    }
    if (!data || data.length === 0) break;

    allPages.push(...(data as NotionDatabasePage[]));

    if (data.length < pageSize) break;
    page++;
  }

  console.log(
    `Loaded ${allPages.length} "${atlasDatabaseName}" pages from Supabase at ${validAtIso} (valid at time query)`,
  );
  return allPages;
}
