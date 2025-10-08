import { metadata, task } from '@trigger.dev/sdk/v3';
import { IMPORT_DATABASES } from '@/app/server/atlas/constants';
import { notion } from '@/app/server/services/notion/notion-client';
import { revalidatePage } from '../../revalidate-page';
import { displayImportSummary } from '../notion/display-import-summary';
import { ImportResult, importDatabasePagesFromNotionToSupabase } from '../notion/import-database-to-supabase';

const metadataKey = 'notion_api_call_count';
const setApiCallCountTriggerMetadata = (count: number) => metadata.set(metadataKey, count);
const flushTriggerMetadata = () => metadata.flush();

export const notionFullAtlasSyncTask = task({
  id: 'notion-database-sync',
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 60 * 60, // Stop executing after 60 mins of compute
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
  },
  machine: 'small-1x',
  run: async () => {
    // Initialize API call count metadata
    setApiCallCountTriggerMetadata(0);

    // Set up periodic stats logging every 5 seconds
    const statsInterval = setInterval(() => {
      const stats = notion().getNotionProxyStats();
      setApiCallCountTriggerMetadata(stats.totalApiCalls);
    }, 5000);

    try {
      // Start the sync process - import all databases
      const results: ImportResult[] = [];
      for (const atlasDatabaseName of IMPORT_DATABASES) {
        const result = await importDatabasePagesFromNotionToSupabase({
          atlasDatabaseName,
        });
        results.push(result);
      }

      // Log final Notion API call stats before flushing metadata
      const finalStats = notion().getNotionProxyStats();
      console.log(`➡️ Total Notion API calls: ${finalStats.totalApiCalls}`);
      setApiCallCountTriggerMetadata(finalStats.totalApiCalls);
      flushTriggerMetadata();

      // Display change summary
      displayImportSummary(results, { showSeparator: false, title: 'SYNC SUMMARY' });

      // Revalidate /atlas page to reflect the newly imported data
      await revalidatePage('/atlas');

      const changedDatabases = results.filter((result) => result.hasChanges);

      return {
        databases: results,
        totalApiCalls: finalStats.totalApiCalls,
        changesSummary: {
          totalDatabases: results.length,
          databasesWithChanges: changedDatabases.length,
          changedDatabases: changedDatabases.map((r) => ({
            name: r.atlasDatabaseName,
            summary: r.summary,
          })),
        },
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
