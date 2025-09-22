import { Database } from './database.types';
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

    // Soft-delete via RPC (invalidate current versions)
    await supabase()
      .rpc('versioned_delete_notion_database_pages', {
        p_ids: batch as Database['public']['Functions']['versioned_delete_notion_database_pages']['Args']['p_ids'],
      })
      .throwOnError();

    // Log all page IDs that were deleted as a list
    const deletedPageIds = batch;
    console.log(`  ✓ Deleted page IDs: ${deletedPageIds.join(', ')}`);

    deletedCount += batch.length;
  }

  console.log(`✅ Successfully deleted ${deletedCount} pages from Supabase`);
}
