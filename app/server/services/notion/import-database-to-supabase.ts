import { ATLAS_DATABASE_ID_MAP, AtlasDatabaseID, AtlasDatabaseName } from '@/app/server/atlas/constants';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { DEBUG_LOGGING } from '@/app/shared/utils/is-debug-logging-enabled';
import { deletePagesFromSupabase } from '../supabase/delete-pages-from-supabase';
import { insertPagesInBatches } from '../supabase/insert-pages-in-batches';
import { loadNotionDatabasePagesFromSupabase } from '../supabase/load-notion-database-pages-from-supabase';
import { DatabasePageChanges, compareDatabasePages } from './compare-database-pages';
import { convertNotionPagesToDatabaseFormat } from './convert-notion-pages-to-supabase-format';
import { fetchNotionDatabasePagesWithRelationships } from './fetch-database-pages';
import { acquireSyncLock, releaseSyncLock, verifySyncLock } from './sync-lock';

/**
 * Sync all pages from a Notion database to Supabase
 */
export async function importDatabasePagesFromNotionToSupabase({
  atlasDatabaseName,
  useLocalCache = false,
}: {
  atlasDatabaseName: AtlasDatabaseName;
  useLocalCache?: boolean;
}) {
  const notionDatabaseId: AtlasDatabaseID = ATLAS_DATABASE_ID_MAP[atlasDatabaseName];
  const startTime = performance.now();
  let syncedCount = 0;

  console.log(`--------------------------------------------------------------------------------`);
  console.log(`📊 Database: 👉👉👉👉👉👉👉👉👉👉 ${atlasDatabaseName} 👈👈👈👈👈👈👈👈👈👈`);
  console.log(`--------------------------------------------------------------------------------`);
  console.log(`Starting database import from Notion to Supabase`);
  console.log(`Sync started at: ${new Date().toUTCString()}`);

  // Verify that the sync is not already in progress
  if (DEBUG_LOGGING) {
    console.log(`Verifying sync lock for database ${notionDatabaseId}...`);
  }
  await verifySyncLock(notionDatabaseId);

  try {
    // Update sync status in database
    await acquireSyncLock(notionDatabaseId);

    // Load existing database pages from Supabase
    if (DEBUG_LOGGING) {
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
          await insertPagesInBatches(newPages);
          console.log(`✅ Successfully inserted ${newPages.length} new pages`);
        }

        // Upsert changed pages
        if (pagesToUpsert.length > 0) {
          const changedPages = pagesInDatabaseFormat.filter((page: NotionDatabasePage) =>
            pagesToUpsert.includes(page.notion_page_id),
          );
          console.log(`🔄 Upserting ${changedPages.length} changed pages...`);
          await insertPagesInBatches(changedPages);
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
      await insertPagesInBatches(databasePages);
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

    // Return summary of changes
    if (changes) {
      return {
        atlasDatabaseName,
        hasChanges:
          changes.newPages.length > 0 ||
          changes.deletedPages.length > 0 ||
          changes.changedProperties.length > 0 ||
          changes.changedRelationships.length > 0,
        summary: {
          newPages: changes.newPages.length,
          deletedPages: changes.deletedPages.length,
          changedProperties: changes.changedProperties.length,
          changedRelationships: changes.changedRelationships.length,
        },
      };
    } else {
      // First time import
      return {
        atlasDatabaseName,
        hasChanges: true,
        summary: {
          newPages: syncedCount,
          deletedPages: 0,
          changedProperties: 0,
          changedRelationships: 0,
        },
      };
    }
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Import failed after ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(2)}s):`, error);

    await releaseSyncLock({
      notionDatabaseId,
      syncStatus: 'failed',
      syncErrorMessage: errorMessage,
      syncedCount: null,
    });

    throw error;
  }
}
