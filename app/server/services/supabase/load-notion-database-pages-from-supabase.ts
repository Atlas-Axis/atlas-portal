import { supabase } from '@/app/server/services/supabase/supabase-client';
import { NotionDatabasePage } from '../../database/notion-database-page';

export async function loadNotionDatabasePagesFromSupabase(rootNotionDatabaseId: string) {
  const allPages: NotionDatabasePage[] = [];
  let page = 0;
  const pageSize = 1000;

  // Load all pages from Supabase with pagination
  while (true) {
    const { data, error } = await supabase
      .from('notion_database_pages')
      .select('*')
      .eq('root_notion_database_id', rootNotionDatabaseId)
      .eq('archived', false)
      .order('canonical_document_title, sort_order')
      // .order('sort_order') // Sort by sort_order
      .range(page * pageSize, (page + 1) * pageSize - 1);

    // Check for errors
    if (error) {
      console.error({ error });
      throw new Error(`Failed to load pages (page ${page}): ${error.message}`, { cause: error });
    }
    if (!data || data.length === 0) break;

    // Add the loaded pages to the allPages array
    allPages.push(...data);

    // If we got less than pageSize, we've reached the end
    if (data.length < pageSize) break;

    page++;
  }

  console.log(`Loaded ${allPages.length} pages from Supabase`);
  return allPages;
}
