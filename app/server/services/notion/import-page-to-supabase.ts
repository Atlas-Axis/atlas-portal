import { NotionBlock } from '@/app/server/database/notion-block';
import { fetchBlocksRecursively } from '@/app/server/services/notion/fetch-blocks-recursively';
import { supabase } from '@/app/server/services/supabase/supabase-client';
import { acquireSyncLock, releaseSyncLock, verifySyncLock } from './sync-lock';

/**
 * Sync all blocks from a Notion page to Supabase
 */
export async function importNotionPageToSupabase({ notionPageId }: { notionPageId: string }): Promise<NotionBlock[]> {
  const startTime = performance.now();
  console.log(`➡️ Importing blocks from Notion to Supabase...`);

  // Verify that the sync is not already in progress
  await verifySyncLock(notionPageId);

  try {
    // Update sync status in database
    await acquireSyncLock(notionPageId);

    // Fetch all blocks from the Notion page recursively
    const blocks = await fetchBlocksRecursively({
      notionBlockId: notionPageId,
      rootNotionBlockId: notionPageId,
      notionBlockType: '',
    });

    // console.log({ blocks: blocks.map((block) => ({ ...block, json_content: JSON.stringify(block.json_content) })) });

    console.log(`Fetched ${blocks.length} blocks from Notion page ${notionPageId}`);

    // Delete existing blocks in Supabase that are not in the fetched blocks. Descendants are cascade deleted automatically
    await supabase().from('notion_blocks').delete().eq('notion_block_id', notionPageId).throwOnError();

    console.log(`Deleted existing blocks in Supabase for Notion page ${notionPageId}`);

    // Save blocks to Supabase database in batches
    await insertBlocksInBatches(blocks);

    console.log(`Inserted ${blocks.length} blocks into Supabase for Notion page ${notionPageId}`);

    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(`✅ Import completed successfully in ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(2)}s)`);

    await releaseSyncLock({
      notionDatabaseId: notionPageId,
      syncStatus: 'completed',
      syncErrorMessage: null,
      blocksSyncedCount: blocks.length,
    });

    return blocks;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.error(`❌ Import failed after ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(2)}s):`, error);

    await releaseSyncLock({
      notionDatabaseId: notionPageId,
      syncStatus: 'failed',
      syncErrorMessage: JSON.stringify(error),
      blocksSyncedCount: null,
    });

    throw error;
  }
}

/**
 * Insert blocks into Supabase in batches to handle large datasets efficiently
 */
async function insertBlocksInBatches(blocks: NotionBlock[], batchSize: number = 1000): Promise<void> {
  const totalBlocks = blocks.length;

  for (let i = 0; i < totalBlocks; i += batchSize) {
    const batch = blocks.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(totalBlocks / batchSize);

    console.log(`Inserting batch ${batchNumber}/${totalBatches} (${batch.length} blocks)...`);

    await supabase().from('notion_blocks').insert(batch).throwOnError();

    console.log(`✓ Batch ${batchNumber}/${totalBatches} inserted successfully`);
  }
}
