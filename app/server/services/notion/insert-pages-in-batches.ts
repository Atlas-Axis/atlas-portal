import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { supabase } from '@/app/server/services/supabase/supabase-client';

/**
 * Insert Notion pages into Supabase in batches to handle large datasets efficiently
 */
export async function insertPagesInBatches(
  pages: NotionDatabasePage[],
  useUpsert: boolean = false,
  batchSize: number = 1000,
): Promise<void> {
  const totalPages = pages.length;

  for (let i = 0; i < totalPages; i += batchSize) {
    const batch = pages.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(totalPages / batchSize);

    console.log(
      `  ${useUpsert ? '🔄 Upserting' : '📝 Inserting'} batch ${batchNumber}/${totalBatches} (${batch.length} pages)...`,
    );

    if (useUpsert) {
      await supabase()
        .from('notion_database_pages')
        .upsert(batch, {
          onConflict: 'notion_page_id',
          ignoreDuplicates: false,
        })
        .throwOnError();
    } else {
      await supabase().from('notion_database_pages').insert(batch).throwOnError();
    }

    console.log(`  ✓ Batch ${batchNumber}/${totalBatches} completed successfully`);
  }
}
