import { AtlasDatabaseID, AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import { ATLAS_DATABASE_ID_MAP, IMPORT_DATABASES } from '@/app/server/atlas/constants';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { DEBUG_LOGGING } from '@/app/shared/utils/is-debug-logging-enabled';
import { deletePagesFromSupabase } from '../supabase/delete-pages-from-supabase';
import { upsertPagesInBatches } from '../supabase/insert-pages-in-batches';
import { loadNotionDatabasePagesFromSupabase } from '../supabase/load-notion-database-pages-from-supabase';
import { logImportOperation } from '../supabase/log-import';
import { DatabasePageChanges, compareDatabasePages } from './compare-database-pages';
import { convertNotionPagesToDatabaseFormat } from './convert-notion-pages-to-supabase-format';
import { displayImportSummary } from './display-import-summary';
import { fetchNotionDatabasePagesWithRelationships } from './fetch-database-pages';
import { acquireSyncLock, releaseSyncLock, verifySyncLock } from './sync-lock';

export interface ImportResult {
  atlasDatabaseName: string;
  hasChanges: boolean;
  durationMinutes: number;
  summary: {
    newPages: number;
    deletedPages: number;
    changedProperties: number;
    changedRelationships: number;
  };
  changedDocumentIds: string[];
  changes: DatabasePageChanges | null;
}

/**
 * Sync all pages from a Notion database to Supabase
 */
export async function importDatabasePagesFromNotionToSupabase({
  atlasDatabaseName,
  useLocalCache = false,
}: {
  atlasDatabaseName: AtlasDatabaseName;
  useLocalCache?: boolean;
}): Promise<ImportResult> {
  const notionDatabaseId: AtlasDatabaseID = ATLAS_DATABASE_ID_MAP[atlasDatabaseName];
  const startTime = performance.now();
  let syncedCount = 0;

  console.log(`--------------------------------------------------------------------------------`);
  console.log(`📊 Database: 👉👉👉👉👉👉👉👉👉👉 ${atlasDatabaseName} 👈👈👈👈👈👈👈👈👈👈`);
  console.log(`--------------------------------------------------------------------------------`);
  console.log(`Starting database import from Notion to Supabase`);
  console.log(`Sync started at: ${new Date().toUTCString()}`);

  // Verify that the sync is not already in progress
  if (DEBUG_LOGGING()) {
    console.log(`Verifying sync lock for database ${notionDatabaseId}...`);
  }
  await verifySyncLock(notionDatabaseId);

  try {
    // Update sync status in database
    await acquireSyncLock(notionDatabaseId);

    // Load existing database pages from Supabase to detect changes
    if (DEBUG_LOGGING()) {
      console.log(`Loading existing database pages from Supabase to detect changes...`);
    }
    const existingPages = await loadNotionDatabasePagesFromSupabase({ atlasDatabaseName });

    // Fetch all pages with relationships via Notion API
    console.log(`Fetching all pages with relationships from Notion database "${atlasDatabaseName}"...`);
    const notionPagesWithRelationships = await fetchNotionDatabasePagesWithRelationships({
      atlasDatabaseName,
      useLocalCache,
    });

    console.log(`Fetched ${notionPagesWithRelationships.length} pages with relationships from Notion database`);

    // Store changes for later use in return value
    let changes: DatabasePageChanges | null = null;

    // Not first time import - compare and update only changed pages
    if (existingPages.length > 0) {
      changes = compareDatabasePages({
        supabasePages: existingPages,
        notionPages: notionPagesWithRelationships,
        atlasDatabaseName,
      });

      // Only log if there are any changes
      const hasChanges =
        changes.newPages.length > 0 ||
        changes.deletedPages.length > 0 ||
        changes.changedProperties.length > 0 ||
        changes.changedRelationships.length > 0;

      if (hasChanges) {
        console.log(`🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥`);
        console.log(
          `‼️‼️‼️‼️ Detected changes: ${changes.newPages.length} new, ${changes.deletedPages.length} deleted, ${changes.changedProperties.length} with property changes, ${changes.changedRelationships.length} with relationship changes`,
        );
        console.log(`🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥`);
      } else {
        console.log(`✅ No changes detected - all pages are up to date`);
      }

      // Process deletions
      if (changes.deletedPages.length > 0) {
        console.log(`🗑️ Deleting ${changes.deletedPages.length} removed pages from Supabase...`);
        await deletePagesFromSupabase(changes.deletedPages);
        console.log(`✅ Successfully deleted ${changes.deletedPages.length} pages from Supabase`);
      }

      // Process insertions and upserts
      const pagesToInsert = changes.newPages;
      const pagesToUpsert = [...changes.changedProperties, ...changes.changedRelationships];

      if (pagesToInsert.length > 0 || pagesToUpsert.length > 0) {
        console.log(`📝 Processing ${pagesToInsert.length} new pages and ${pagesToUpsert.length} changed pages...`);

        // Convert Notion pages to database format
        const pagesToProcess = [...pagesToInsert, ...pagesToUpsert];
        const notionPagesToInsertOrUpsert = notionPagesWithRelationships.filter((page) =>
          pagesToProcess.includes(page.id),
        );

        const pagesInDatabaseFormat = await convertNotionPagesToDatabaseFormat({
          notionPages: notionPagesToInsertOrUpsert,
          atlasDatabaseName,
        });

        // Insert new pages
        if (pagesToInsert.length > 0) {
          const newPages = pagesInDatabaseFormat.filter((page: NotionDatabasePage) =>
            pagesToInsert.includes(page.notion_page_id),
          );
          console.log(`📝 Inserting ${newPages.length} new pages...`);
          await upsertPagesInBatches(newPages, 'insert');
          console.log(`✅ Successfully inserted ${newPages.length} new pages`);
        }

        // Upsert changed pages
        if (pagesToUpsert.length > 0) {
          const changedPages = pagesInDatabaseFormat.filter((page: NotionDatabasePage) =>
            pagesToUpsert.includes(page.notion_page_id),
          );
          console.log(`🔄 Upserting ${changedPages.length} changed pages...`);
          await upsertPagesInBatches(changedPages, 'update');
          console.log(`✅ Successfully upserted ${changedPages.length} changed pages`);
        }
      }

      syncedCount = changes.deletedPages.length + pagesToInsert.length + pagesToUpsert.length;
    } else {
      // First time import - insert all pages
      console.log(`📝 First time import - inserting all ${notionPagesWithRelationships.length} pages...`);
      const databasePages = await convertNotionPagesToDatabaseFormat({
        notionPages: notionPagesWithRelationships,
        atlasDatabaseName,
      });
      await upsertPagesInBatches(databasePages, 'insert');
      console.log(`✅ Successfully inserted all ${databasePages.length} pages`);

      syncedCount = databasePages.length;
    }

    await releaseSyncLock({
      notionDatabaseId,
      syncStatus: 'completed',
      syncErrorMessage: null,
      syncedCount,
    });

    console.log(`✅ Completed importing: ${atlasDatabaseName}`);

    // Log how many minutes the import took
    const endTime = performance.now();
    const durationMs = endTime - startTime;
    const durationSeconds = durationMs / 1000;
    const durationMinutes = durationSeconds / 60;

    console.log(`⏱️  Import duration: ${durationMinutes.toFixed(2)} minutes (${durationSeconds.toFixed(2)}s)`);

    // Prepare result data
    const hasChanges = changes
      ? changes.newPages.length > 0 ||
        changes.deletedPages.length > 0 ||
        changes.changedProperties.length > 0 ||
        changes.changedRelationships.length > 0
      : true; // First time import always has changes

    const changedDocumentIds = changes
      ? [...changes.newPages, ...changes.deletedPages, ...changes.changedProperties, ...changes.changedRelationships]
      : [];

    const result: ImportResult = {
      atlasDatabaseName,
      hasChanges,
      durationMinutes,
      // TODO: Remove summary, use changes instead
      summary: changes
        ? {
            newPages: changes.newPages.length,
            deletedPages: changes.deletedPages.length,
            changedProperties: changes.changedProperties.length,
            changedRelationships: changes.changedRelationships.length,
          }
        : {
            newPages: syncedCount,
            deletedPages: 0,
            changedProperties: 0,
            changedRelationships: 0,
          },
      changes,
      changedDocumentIds,
    };

    return result;
  } catch (error) {
    const endTime = performance.now();
    const durationMs = endTime - startTime;
    const durationSeconds = durationMs / 1000;
    const durationMinutes = durationSeconds / 60;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `❌ Import failed after ${durationMinutes.toFixed(2)} minutes (${durationSeconds.toFixed(2)}s):`,
      error,
    );

    await releaseSyncLock({
      notionDatabaseId,
      syncStatus: 'failed',
      syncErrorMessage: errorMessage,
      syncedCount: null,
    });

    throw error;
  }
}

/**
 * Unified function to import multiple Atlas databases from Notion to Supabase
 * This function handles the common logic of looping over databases, logging progress,
 * and displaying summary.
 */
export async function importDatabasesFromNotionToSupabase({
  databasesToImport = IMPORT_DATABASES,
  useLocalCache = false,
  triggerDevRunId = null,
  importType = 'full_sync',
}: {
  databasesToImport?: AtlasDatabaseName[];
  useLocalCache?: boolean;
  triggerDevRunId?: string | null;
  importType?: 'full_sync' | 'partial';
} = {}): Promise<ImportResult[]> {
  const startTime = Date.now();
  const results: ImportResult[] = [];

  console.log(`Starting Notion database import for ${databasesToImport.length} databases...`);

  try {
    // Import all Atlas databases and collect results
    for (const atlasDatabaseName of databasesToImport) {
      console.log('\n\n');
      const result = await importDatabasePagesFromNotionToSupabase({
        atlasDatabaseName,
        useLocalCache,
      });
      results.push(result);
      console.log('\n\n');
    }

    const endTime = Date.now();
    const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
    const durationMinutes = Number(durationSeconds) / 60;

    // Aggregate results for logging
    const totalNewPages = results.reduce((sum, r) => sum + r.summary.newPages, 0);
    const totalDeletedPages = results.reduce((sum, r) => sum + r.summary.deletedPages, 0);
    const totalChangedProperties = results.reduce((sum, r) => sum + r.summary.changedProperties, 0);
    const totalChangedRelationships = results.reduce((sum, r) => sum + r.summary.changedRelationships, 0);
    const hasAnyChanges = results.some((r) => r.hasChanges);
    const allChangedDocumentIds = results.flatMap((r) => r.changedDocumentIds);

    // Log the overall import operation
    await logImportOperation({
      success: true,
      has_changes: hasAnyChanges,
      duration_minutes: durationMinutes,
      finished_at: new Date(endTime).toISOString(),
      started_at: new Date(startTime).toISOString(),
      changed_notion_page_ids: allChangedDocumentIds,
      trigger_dev_run_id: triggerDevRunId,
      import_type: importType,
      error_message: null,
      new_pages_count: totalNewPages,
      deleted_pages_count: totalDeletedPages,
      changed_properties_count: totalChangedProperties,
      changed_relationships_count: totalChangedRelationships,
    });

    // Display summary of all changes
    displayImportSummary(results);

    console.log(`🎉 All databases imported successfully!`);
    // Show in minutes if over 120 seconds
    if (Number(durationSeconds) > 120) {
      const durationMinutesDisplay = (Number(durationSeconds) / 60).toFixed(2);
      console.log(`⏰ Total processing time: ${durationMinutesDisplay} minutes`);
    } else {
      console.log(`⏰ Total processing time: ${durationSeconds} seconds`);
    }

    return results;
  } catch (error) {
    const endTime = Date.now();
    const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
    const durationMinutes = Number(durationSeconds) / 60;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`Error importing Notion databases:`, error);

    // Log the failed import operation
    await logImportOperation({
      success: false,
      has_changes: false,
      duration_minutes: durationMinutes,
      finished_at: new Date(endTime).toISOString(),
      started_at: new Date(startTime).toISOString(),
      changed_notion_page_ids: [],
      trigger_dev_run_id: triggerDevRunId,
      import_type: importType,
      error_message: errorMessage,
      new_pages_count: 0,
      deleted_pages_count: 0,
      changed_properties_count: 0,
      changed_relationships_count: 0,
    });

    throw error;
  }
}
