import { NotionBlock } from '@/app/server/database/notion-block';
import { fetchBlocksRecursively } from '@/app/server/services/notion/fetch-blocks-recursively';
import { supabase } from '@/app/server/services/supabase/supabase-client';
import { NOTION_PAGE_ID } from './_demo-data';
import { endSyncStatus, startSyncStatus } from './reset-sync-status';

/**
 * Sync all blocks from Notion page to Supabase
 */
export async function importFromNotionToSupabase({ taskRunId }: { taskRunId: string }) {
  const startTime = performance.now();
  console.log(`➡️ Importing blocks from Notion to Supabase...`);

  try {
    // Update sync status in database
    await startSyncStatus(NOTION_PAGE_ID);

    // Fetch all blocks from the Notion page recursively
    const blocks = await fetchBlocksRecursively({
      notionBlockId: NOTION_PAGE_ID,
      rootNotionBlockId: NOTION_PAGE_ID,
    });

    console.log(`Fetched ${blocks.length} blocks from Notion page ${NOTION_PAGE_ID}`);

    // Delete existing blocks in Supabase that are not in the fetched blocks. Descendants are cascade deleted automatically
    await supabase.from('notion_blocks').delete().eq('notion_block_id', NOTION_PAGE_ID).throwOnError();

    console.log(`Deleted existing blocks in Supabase for Notion page ${NOTION_PAGE_ID}`);

    // Save blocks to Supabase database in batches
    await insertBlocksInBatches(blocks);

    console.log(`Inserted ${blocks.length} blocks into Supabase for Notion page ${NOTION_PAGE_ID}`);

    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(`✅ Import completed successfully in ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(2)}s)`);

    return blocks;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.error(`❌ Import failed after ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(2)}s):`, error);

    await endSyncStatus({
      notionPageId: NOTION_PAGE_ID,
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

    await supabase.from('notion_blocks').insert(batch).throwOnError();

    console.log(`✓ Batch ${batchNumber}/${totalBatches} inserted successfully`);
  }
}
