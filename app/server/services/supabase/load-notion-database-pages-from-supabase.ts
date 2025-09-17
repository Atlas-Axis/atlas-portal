import { supabase } from '@/app/server/services/supabase/supabase-client';
import { NotionDatabasePage } from '../../database/notion-database-page';
import { AtlasDatabaseName } from '../atlas/constants';

export async function loadNotionDatabasePagesFromSupabase({
  atlasDatabaseName,
}: {
  atlasDatabaseName: AtlasDatabaseName;
}): Promise<NotionDatabasePage[]> {
  const allPages: NotionDatabasePage[] = [];
  let page = 0;
  const pageSize = 1000;

  // Load all pages from Supabase with pagination
  while (true) {
    const { data, error } = await supabase()
      .from('notion_database_pages')
      .select('*')
      .eq('archived', false)
      .eq('in_trash', false)
      .eq('atlas_database_name', atlasDatabaseName)
      .order('sort_order, atlas_document_number, canonical_document_title')
      .range(page * pageSize, (page + 1) * pageSize - 1);

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
