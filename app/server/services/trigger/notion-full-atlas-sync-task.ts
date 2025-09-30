import { metadata, task } from '@trigger.dev/sdk/v3';
import { IMPORT_DATABASES } from '@/app/server/atlas/constants';
import { notion } from '@/app/server/services/notion/notion-client';
import { revalidatePage } from '../../revalidate-page';
import { importDatabasePagesFromNotionToSupabase } from '../notion/import-database-to-supabase';

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
  run: async () => {
    // Initialize API call count metadata
    setApiCallCountTriggerMetadata(0);

    // Set up periodic stats logging every 5 seconds
    const statsInterval = setInterval(() => {
      const stats = notion().getNotionProxyStats();
      console.log(`- ${stats.totalApiCalls} Notion API calls`);
      setApiCallCountTriggerMetadata(stats.totalApiCalls);
    }, 5000);

    try {
      // Start the sync process - import all databases
      const results = [];
      for (const atlasDatabaseName of IMPORT_DATABASES) {
        console.log(`📋 Starting sync for database: ${atlasDatabaseName}`);
        const result = await importDatabasePagesFromNotionToSupabase({
          atlasDatabaseName,
        });
        results.push({ atlasDatabaseName, result });
        console.log(`✅ Completed sync for database: ${atlasDatabaseName}`);
      }

      // Log final Notion API call stats before flushing metadata
      const finalStats = notion().getNotionProxyStats();
      console.log(`➡️ Total Notion API calls: ${finalStats.totalApiCalls}`);
      setApiCallCountTriggerMetadata(finalStats.totalApiCalls);
      flushTriggerMetadata();

      // Revalidate /atlas page to reflect the newly imported data
      await revalidatePage('/atlas');

      return {
        databases: results,
        totalApiCalls: finalStats.totalApiCalls,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`❌ Notion full Atlas sync failed: ${errorMessage}`);
      // TODO: Log to Sentry
      throw error;
    } finally {
      // Clear the interval to prevent it from running after task completion
      clearInterval(statsInterval);
    }
  },
  // Automatically clean up the sync status in Supabase when the task fails or is cancelled
  onFailure: async () => {
    // TODO: Optionally log failure reason to Sentry
  },
  onCancel: async () => {
    // TODO: Optionally log cancellation to Sentry
  },
});
