import {
  SupabasePageForComparison,
  SupabaseTree,
  buildSupabaseTree,
} from '@/app/server/services/notion/compare-database-trees';
import { supabase } from '@/app/server/services/supabase/supabase-client';

/**
 * Load database tree structure from Supabase for comparison
 * Only loads the minimal fields needed for tree comparison to optimize performance
 */
export async function loadDatabaseTreeFromSupabase(rootNotionDatabaseId: string): Promise<SupabaseTree> {
  const pages: SupabasePageForComparison[] = [];
  let page = 0;
  const pageSize = 1000;

  // Load only the fields needed for tree comparison
  while (true) {
    const { data, error } = await supabase
      .from('notion_database_pages')
      .select('notion_page_id, parent_notion_page_id, sort_order, updated_at')
      .eq('root_notion_database_id', rootNotionDatabaseId)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    // Check for errors
    if (error) {
      console.error({ error });
      throw new Error(`Failed to load database tree (Notion page ${page}): ${error.message}`, { cause: error });
    }
    if (!data || data.length === 0) break;

    // Add the loaded pages to the array
    pages.push(...data);

    // If we got less than pageSize, we've reached the end
    if (data.length < pageSize) break;

    page++;
  }

  console.log(`Loaded ${pages.length} Notion pages from Supabase for database tree ${rootNotionDatabaseId}`);

  // Build tree structure
  return buildSupabaseTree(pages);
}
