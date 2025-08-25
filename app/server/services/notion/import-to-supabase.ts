import { fetchBlocksRecursively } from '@/app/server/services/notion/fetch-blocks-recursively';

const NOTION_PAGE_ID = '21af7584-64c5-8092-bd00-ddfeda596000';

/**
 * Sync all blocks from Notion page to Supabase
 */
export async function importFromNotionToSupabase({ taskRunId }: { taskRunId: string }) {
  const startTime = performance.now();
  console.log(`➡️ Importing blocks from Notion to Supabase...`);

  try {
    // Fetch all blocks from the Notion page recursively
    const blocks = await fetchBlocksRecursively({
      notionBlockId: NOTION_PAGE_ID,
      rootNotionBlockId: NOTION_PAGE_ID,
    });

    console.log(`Fetched ${blocks.length} blocks from Notion page ${NOTION_PAGE_ID}`);

    // TODO: Save blocks to Supabase database

    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(`✅ Import completed successfully in ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(2)}s)`);

    return blocks;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.error(`❌ Import failed after ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(2)}s):`, error);
    throw error;
  }
}
