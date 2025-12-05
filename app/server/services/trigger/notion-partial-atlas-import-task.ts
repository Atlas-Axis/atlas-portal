import { metadata, task } from '@trigger.dev/sdk/v3';
import type { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import { notion } from '@/app/server/services/notion/notion-client';
import { revalidatePage } from '../../revalidate-page';
import { type ImportResult, importDatabasesFromNotionToSupabase } from '../notion/import-database-to-supabase';
import { notionImportQueue } from './notion-import-queue';

const metadataKey = 'notion_api_call_count';
const setApiCallCountTriggerMetadata = (count: number) => metadata.set(metadataKey, count);
const flushTriggerMetadata = () => metadata.flush();

export interface NotionPartialImportPayload {
  databases: AtlasDatabaseName[];
}

export interface NotionPartialImportResult {
  databases: ImportResult[];
  totalApiCalls: number;
  changesSummary: {
    totalDatabases: number;
    databasesWithChanges: number;
    changedDatabases: Array<{
      name: string;
      summary: ImportResult['summary'];
    }>;
  };
}

/**
 * Partial Atlas import task - imports only specified databases from Notion to Supabase.
 *
 * This task is used after the Markdown-to-Notion sync to import only the databases
 * that were affected by the sync operation, rather than doing a full import of all 10 databases.
 *
 * Uses a shared queue with concurrencyLimit: 1 to prevent race conditions with the
 * hourly scheduled full import task.
 */
export const notionPartialAtlasImportTask = task({
  id: 'notion-partial-atlas-import',
  queue: notionImportQueue, // Shared queue ensures only one import runs at a time
  maxDuration: 60 * 60, // Stop executing after 60 mins of compute
  retry: {
    maxAttempts: 1,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
  },
  machine: 'small-1x',
  run: async (payload: NotionPartialImportPayload, { ctx }): Promise<NotionPartialImportResult> => {
    const runId = ctx.run.id;
    const { databases } = payload;

    if (databases.length === 0) {
      console.log(`[Notion Partial Import] No databases to import, skipping`);
      return {
        databases: [],
        totalApiCalls: 0,
        changesSummary: {
          totalDatabases: 0,
          databasesWithChanges: 0,
          changedDatabases: [],
        },
      };
    }

    console.log(`[Notion Partial Import] Starting import for ${databases.length} databases: ${databases.join(', ')}`);

    // Initialize API call count metadata
    setApiCallCountTriggerMetadata(0);

    // Set up periodic stats logging every 5 seconds
    const statsInterval = setInterval(() => {
      const stats = notion().getNotionProxyStats();
      setApiCallCountTriggerMetadata(stats.totalApiCalls);
    }, 5000);

    try {
      // Import only the specified databases
      const results = await importDatabasesFromNotionToSupabase({
        databasesToImport: databases,
        triggerDevRunId: runId,
        importType: 'partial',
      });

      // Log final Notion API call stats before flushing metadata
      const finalStats = notion().getNotionProxyStats();
      console.log(`➡️ Total Notion API calls: ${finalStats.totalApiCalls}`);
      setApiCallCountTriggerMetadata(finalStats.totalApiCalls);
      flushTriggerMetadata();

      // Revalidate atlas page to reflect the newly imported data
      await revalidatePage('/');
      await revalidatePage('/atlas');

      const changedDatabases = results.filter((result) => result.hasChanges);

      console.log(
        `[Notion Partial Import] Complete: ${changedDatabases.length}/${results.length} databases had changes`,
      );

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
      console.error(`❌ Notion partial Atlas import failed: ${errorMessage}`);
      throw error;
    } finally {
      // Clear the interval to prevent it from running after task completion
      clearInterval(statsInterval);
    }
  },
});
