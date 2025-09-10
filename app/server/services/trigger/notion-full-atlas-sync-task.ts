import { metadata, task } from '@trigger.dev/sdk/v3';
import { notion } from '@/app/server/services/notion/notion-client';
import { isValidUUID } from '@/app/shared/utils/utils';
import { ATLAS_DATABASES } from '../atlas/constants';
import { releaseSyncLock, verifySyncLock } from '../notion/sync-lock';
import { importDatabasePagesFromNotionToSupabase } from '../notion/to_delete/_old.import-database-to-supabase';

const metadataKey = 'notion_api_call_count';
const setApiCallCountTriggerMetadata = (count: number) => metadata.set(metadataKey, count);
const flushTriggerMetadata = () => metadata.flush();

export const notionFullAtlasSyncTask = task({
  id: 'notion-database-sync',
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 20 * 60, // Stop executing after 20 mins of compute
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
  },
  run: async (
    {
      notionDatabaseId,
    }: {
      notionDatabaseId: string;
    },
    // { ctx },
  ) => {
    // Validate that notionDatabaseId is a valid UUID
    if (!isValidUUID(notionDatabaseId)) {
      throw new Error(`Invalid UUID format for notionDatabaseId: ${notionDatabaseId}`);
    }

    // Verify that the sync is not already in progress
    await verifySyncLock(notionDatabaseId);

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
      // TODO: Import other databases too
      const result = await importDatabasePagesFromNotionToSupabase({
        atlasDatabaseName: ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS,
      });

      // Log final Notion API call stats before flushing metadata
      const finalStats = notion().getNotionProxyStats();
      console.log(`➡️ Total Notion API calls: ${finalStats.totalApiCalls}`);
      setApiCallCountTriggerMetadata(finalStats.totalApiCalls);
      flushTriggerMetadata();

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await releaseSyncLock({
        notionDatabaseId,
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
    // TODO: notionDatabaseId is not available in this context, need to figure out how to pass it
  },
  onCancel: async () => {
    // TODO: notionDatabaseId is not available in this context, need to figure out how to pass it
  },
});
