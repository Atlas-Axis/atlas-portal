import { supabase } from '@/app/server/services/supabase/supabase-client';

/**
 * Load existing Notion database pages from Supabase with their updated_at timestamps
 * Returns a Map keyed by notion_page_id for efficient lookup.
 * Doesn't load content or other large fields to optimize performance.
 */
export async function loadExistingDatabasePagesFromSupabase(
  rootNotionDatabaseId: string,
): Promise<Map<string, { updated_at: string; notion_page_id: string }>> {
  const existingPagesById = new Map<string, { updated_at: string; notion_page_id: string }>();
  let page = 0;
  const pageSize = 1000;

  // Load all existing pages from Supabase with pagination
  while (true) {
    const { data, error } = await supabase
      .from('notion_database_pages')
      .select('notion_page_id, updated_at')
      .eq('root_notion_database_id', rootNotionDatabaseId)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    // Check for errors
    if (error) {
      console.error({ error });
      throw new Error(`Failed to load existing pages (page ${page}): ${error.message}`, { cause: error });
    }
    if (!data || data.length === 0) break;

    // Add the loaded pages to the map
    for (const pageData of data) {
      existingPagesById.set(pageData.notion_page_id, {
        updated_at: pageData.updated_at,
        notion_page_id: pageData.notion_page_id,
      });
    }

    // If we got less than pageSize, we've reached the end
    if (data.length < pageSize) break;

    page++;
  }

  console.log(`Loaded ${existingPagesById.size} existing pages from Supabase for database ${rootNotionDatabaseId}`);
  return existingPagesById;
}
