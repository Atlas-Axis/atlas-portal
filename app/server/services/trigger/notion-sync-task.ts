import { metadata, task } from '@trigger.dev/sdk/v3';
import { importFromNotionToSupabase as importNotionToSupabase } from '@/app/server/services/notion/import-to-supabase';
import { notion } from '@/app/server/services/notion/notion-client';
import { NOTION_PAGE_ID } from '../notion/_demo-data';
import { endSyncStatus, startSyncStatus } from '../notion/reset-sync-status';
import { verifySyncLock } from '../notion/verify-sync-lock';

const metadataKey = 'notion_api_calls';
const setApiCallCountTriggerMetadata = (count: number) => metadata.set(metadataKey, count);
const flushTriggerMetadata = () => metadata.flush();

export const notionFullPageSyncTask = task({
  id: 'notion-full-page-sync',
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 20 * 60, // Stop executing after 20 mins of compute
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
  },
  run: async (payload: object, { ctx }) => {
    // Verify that the sync is not already in progress
    await verifySyncLock(NOTION_PAGE_ID);

    const taskRunId = ctx.run.id;

    // Initialize API call count metadata
    setApiCallCountTriggerMetadata(0);

    // Set up periodic stats logging every 5 seconds
    const statsInterval = setInterval(() => {
      const stats = notion().getNotionProxyStats();
      console.log(`- ${stats.totalApiCalls} Notion API calls`);
      setApiCallCountTriggerMetadata(stats.totalApiCalls);
    }, 5000);

    try {
      // Start the sync process
      const result = await importNotionToSupabase({
        taskRunId,
      });

      // Log final stats before flushing metadata
      const finalStats = notion().getNotionProxyStats();
      console.log(`➡️ Total Notion API calls: ${finalStats.totalApiCalls}`);
      setApiCallCountTriggerMetadata(finalStats.totalApiCalls);
      flushTriggerMetadata();

      return result;
    } finally {
      // Clear the interval to prevent it from running after task completion
      clearInterval(statsInterval);
    }
  },
  // Automatically clean up the sync status in Supabase when the task fails or is cancelled
  onFailure: async (error) => {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    await endSyncStatus({
      notionPageId: NOTION_PAGE_ID,
      syncStatus: 'failed',
      syncErrorMessage: errorMessage,
      blocksSyncedCount: null,
    });
  },
  onCancel: async () => {
    await endSyncStatus({
      notionPageId: NOTION_PAGE_ID,
      syncStatus: 'cancelled',
      syncErrorMessage: 'Cancelled',
      blocksSyncedCount: null,
    });
  },
});
