/**
 * Trigger.dev task for Markdown-to-Notion sync
 *
 * This task orchestrates the sync process by:
 * - Acquiring/releasing sync lock
 * - Loading diff and UUID mappings
 * - Managing real-time progress metadata
 * - Delegating sync operations to the sync service
 * - Chaining the Notion-to-Supabase import task for affected databases
 */
import { metadata, task } from '@trigger.dev/sdk/v3';
import { diffAtlasScopeTreeLists } from '@/app/server/atlas/diff/markdown-supabase-diff';
import { loadUuidMappings } from '@/app/server/atlas/load-uuid-mapping';
// Import from the new sync service module
import {
  type FieldFilters,
  type MarkdownNotionSyncPayload,
  type MarkdownNotionSyncResult,
  type SyncFilters,
  type SyncMetadata,
  acquireSyncLock,
  isStopRequested,
  processChanges,
  releaseSyncLock,
} from '@/app/server/services/markdown-notion-sync';
import { createSyncBatch } from '@/app/server/services/supabase/audit-log-service';
import { notionPartialAtlasImportTask } from './notion-partial-atlas-import-task';

// Re-export types for external use
export type { MarkdownNotionSyncPayload, MarkdownNotionSyncResult, SyncFilters, FieldFilters };

/**
 * Helper to update Trigger.dev metadata for real-time progress tracking
 */
const updateMetadata = (data: Partial<SyncMetadata>) => {
  const current = (metadata.get('sync') as unknown as SyncMetadata) || {
    phase: 'initializing',
    completed: 0,
    total: 0,
    currentDoc: null,
    succeeded: 0,
    failed: 0,
    skipped: 0,
  };
  metadata.set('sync', { ...current, ...data });
};

/**
 * Markdown-to-Notion sync task
 *
 * Syncs Atlas documents from Markdown format back to Notion databases.
 * Processes changes in 5 phases: content updates, additions, mention updates, deletions, parent changes.
 */
export const markdownNotionSyncTask = task({
  id: 'markdown-notion-sync',
  maxDuration: 12 * 60 * 60, // 6 hours max
  retry: {
    maxAttempts: 1, // No automatic retries - sync should be manually triggered
  },
  machine: 'small-1x',
  run: async (payload: MarkdownNotionSyncPayload, { ctx }) => {
    const runId = ctx.run.id;
    let lockAcquired = false;

    try {
      // Initialize metadata
      updateMetadata({ phase: 'initializing', completed: 0, total: 0, currentDoc: 'Acquiring lock...' });

      // Acquire sync lock
      lockAcquired = await acquireSyncLock(runId);

      if (!lockAcquired) {
        throw new Error('Another sync is already in progress. Please wait for it to complete.');
      }

      console.log(`[Markdown-Notion Sync] Lock acquired, starting sync...`);
      updateMetadata({ currentDoc: 'Loading data...' });

      // Load diff result and UUID mappings
      // Pass useDynamicValues from filters to ensure consistent diff calculation with what the UI showed
      const [diffResult, uuidMappings] = await Promise.all([diffAtlasScopeTreeLists(), loadUuidMappings()]);

      // Calculate total changes
      const filteredChanges = {
        added: payload.filters.added ? diffResult.changes.added : [],
        deleted: payload.filters.deleted ? diffResult.changes.deleted : [],
        changed: payload.filters.contentChanges ? diffResult.changes.changed : [],
        parent_changed: payload.filters.parentChanges ? diffResult.changes.parent_changed : [],
      };

      const total =
        filteredChanges.changed.length +
        filteredChanges.added.length +
        filteredChanges.deleted.length +
        filteredChanges.parent_changed.length;

      if (total === 0) {
        updateMetadata({ phase: 'completed', total: 0, completed: 0, currentDoc: null });
        return { succeeded: 0, failed: 0, skipped: 0, stoppedEarly: false, affectedDatabases: [] };
      }

      // Create sync batch ID for audit logging
      const syncBatchId = createSyncBatch();
      console.log(`[Markdown-Notion Sync] Processing ${total} changes (batch: ${syncBatchId})`);

      updateMetadata({ total, currentDoc: 'Starting sync...' });

      // Process all changes using the orchestrator
      const result = await processChanges(
        diffResult,
        uuidMappings,
        payload.filters,
        syncBatchId,
        // Progress callback
        (progressData) => {
          updateMetadata(progressData);
        },
        // Stop check callback
        async () => {
          const stopRequested = await isStopRequested();
          if (stopRequested) {
            updateMetadata({ phase: 'stopped', currentDoc: 'Stop requested, finishing...' });
          }
          return stopRequested;
        },
      );

      console.log(
        `[Markdown-Notion Sync] Sync phase complete: ${result.succeeded} succeeded, ${result.failed} failed, ${result.skipped} skipped`,
      );

      // Phase 6: Chain Notion-to-Supabase import for affected databases
      // This ensures the changes we just made to Notion are imported back to Supabase
      if (result.affectedDatabases.length > 0 && !result.stoppedEarly) {
        console.log(
          `[Markdown-Notion Sync] Starting Notion-to-Supabase import for ${result.affectedDatabases.length} databases: ${result.affectedDatabases.join(', ')}`,
        );

        updateMetadata({
          phase: 'notion_import',
          currentDoc: `Importing ${result.affectedDatabases.length} databases...`,
          succeeded: result.succeeded,
          failed: result.failed,
          skipped: result.skipped,
        });

        // Keep sync lock held during import to prevent another Markdown-to-Notion sync
        // from starting before the complete round-trip (Markdown → Notion → Supabase) finishes.
        // This ensures data consistency across the entire pipeline.
        // The import task uses a shared queue with concurrencyLimit: 1, so if the hourly
        // import is running, this will automatically wait in queue.
        const importResult = await notionPartialAtlasImportTask.triggerAndWait({
          databases: result.affectedDatabases,
        });

        if (importResult.ok) {
          console.log(
            `[Markdown-Notion Sync] Import complete: ${importResult.output.changesSummary.databasesWithChanges}/${importResult.output.changesSummary.totalDatabases} databases had changes`,
          );
        } else {
          console.error(`[Markdown-Notion Sync] Import failed:`, importResult.error);
          // Don't fail the whole task - the sync part succeeded
        }
      } else if (result.affectedDatabases.length === 0) {
        console.log(`[Markdown-Notion Sync] No databases affected, skipping import`);
      } else {
        console.log(`[Markdown-Notion Sync] Sync stopped early, skipping import`);
      }

      // Update final metadata
      updateMetadata({
        phase: result.stoppedEarly ? 'stopped' : 'completed',
        completed: result.succeeded + result.failed + result.skipped,
        currentDoc: null,
        succeeded: result.succeeded,
        failed: result.failed,
        skipped: result.skipped,
      });

      console.log(
        `[Markdown-Notion Sync] Complete: ${result.succeeded} succeeded, ${result.failed} failed, ${result.skipped} skipped`,
      );

      return {
        succeeded: result.succeeded,
        failed: result.failed,
        skipped: result.skipped,
        stoppedEarly: result.stoppedEarly,
        affectedDatabases: result.affectedDatabases,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Markdown-Notion Sync] Task failed:`, errorMessage);
      updateMetadata({ phase: 'stopped', currentDoc: `Error: ${errorMessage}` });
      throw error;
    } finally {
      // Always release lock
      if (lockAcquired) {
        await releaseSyncLock(runId);
        console.log(`[Markdown-Notion Sync] Lock released`);
      }
    }
  },
});
