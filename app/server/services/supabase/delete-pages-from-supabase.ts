import { supabase } from './supabase-client';

/**
 * Delete pages from Supabase by their Notion page IDs
 * TODO: Support temporal table - invalidate row but don't delete it
 */
export async function deletePagesFromSupabase(notionPageIds: string[]): Promise<void> {
  if (notionPageIds.length === 0) {
    return;
  }

  console.log(`🗑️ Deleting ${notionPageIds.length} pages from Supabase...`);

  const pageSize = 100;
  let deletedCount = 0;

  // Process in batches of 100
  for (let i = 0; i < notionPageIds.length; i += pageSize) {
    const batch = notionPageIds.slice(i, i + pageSize);

    console.log(
      `Deleting batch ${Math.floor(i / pageSize) + 1}/${Math.ceil(notionPageIds.length / pageSize)} (${batch.length} pages)...`,
    );

    const { error } = await supabase().from('notion_database_pages').delete().in('notion_page_id', batch);

    if (error) {
      throw new Error(
        `Failed to delete pages batch ${Math.floor(i / pageSize) + 1} from Supabase: ${error.message || 'Unknown error'}`,
      );
    }

    deletedCount += batch.length;
  }

  console.log(`✅ Successfully deleted ${deletedCount} pages from Supabase`);
}
