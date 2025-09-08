import { metadata, task } from '@trigger.dev/sdk/v3';
import { importBlocksFromNotionToSupabase } from '@/app/server/services/notion/import-page-to-supabase';
import { notion } from '@/app/server/services/notion/notion-client';
import { isValidUUID } from '@/app/shared/utils/utils';
import { endSyncStatus } from '../notion/reset-sync-status';
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
  run: async (
    {
      notionPageId,
    }: {
      notionPageId: string;
    },
    { ctx },
  ) => {
    // Validate that notionPageId is a valid UUID
    if (!isValidUUID(notionPageId)) {
      throw new Error(`Invalid UUID format for notionPageId: ${notionPageId}`);
    }

    // Verify that the sync is not already in progress
    await verifySyncLock(notionPageId);

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
      const result = await importBlocksFromNotionToSupabase({
        notionPageId,
        taskRunId,
      });

      // Log final stats before flushing metadata
      const finalStats = notion().getNotionProxyStats();
      console.log(`➡️ Total Notion API calls: ${finalStats.totalApiCalls}`);
      setApiCallCountTriggerMetadata(finalStats.totalApiCalls);
      flushTriggerMetadata();

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await endSyncStatus({
        notionPageId,
        syncStatus: 'failed',
        syncErrorMessage: errorMessage,
        blocksSyncedCount: null,
      });
      throw error;
    } finally {
      // Clear the interval to prevent it from running after task completion
      clearInterval(statsInterval);
    }
  },
  // Automatically clean up the sync status in Supabase when the task fails or is cancelled
  onFailure: async () => {
    // TODO: notionPageId is not available in this context, need to figure out how to pass it
  },
  onCancel: async () => {
    // TODO: notionPageId is not available in this context, need to figure out how to pass it
  },
});
