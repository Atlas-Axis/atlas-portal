import { NotionDatabasePage } from '../../database/notion-database-page';
import { ATLAS_DATABASE_ID_MAP, AtlasDatabaseID, AtlasDatabaseName } from '../atlas/constants';
import { deletePagesFromSupabase } from '../supabase/delete-pages-from-supabase';
import { insertPagesInBatches } from '../supabase/insert-pages-in-batches';
import { loadNotionDatabasePagesFromSupabase } from '../supabase/load-notion-database-pages-from-supabase';
import { compareDatabasePages } from './compare-database-pages';
import { convertNotionPagesToDatabaseFormat } from './convert-notion-pages-to-supabase-format';
import { fetchNotionDatabasePagesWithRelationships } from './fetch-database-pages';
import { acquireSyncLock, releaseSyncLock, verifySyncLock } from './sync-lock';

/**
 * Sync all pages from a Notion database to Supabase
 */
export async function importDatabasePagesFromNotionToSupabase({
  atlasDatabaseName,
}: {
  atlasDatabaseName: AtlasDatabaseName;
}) {
  const startTime = performance.now();
  let blocksSyncedCount = 0;
  console.log(`🚀 Starting database import from Notion to Supabase`);

  const notionDatabaseId: AtlasDatabaseID = ATLAS_DATABASE_ID_MAP[atlasDatabaseName];
  console.log(`📊 Database: ${atlasDatabaseName}`);

  // Verify that the sync is not already in progress
  console.log(`🔒 Verifying sync lock for database ${notionDatabaseId}...`);
  await verifySyncLock(notionDatabaseId);

  try {
    // Update sync status in database
    console.log(`Acquiring sync lock for database ${notionDatabaseId}...`);
    await acquireSyncLock(notionDatabaseId);
    console.log(`Sync lock acquired successfully`);

    // Load existing database pages from Supabase
    console.log(`📥 Loading existing database pages from Supabase to detect changes...`);
    const existingPages = await loadNotionDatabasePagesFromSupabase({ atlasDatabaseName });
    console.log(`✅ Loaded ${existingPages.length} existing pages from Supabase`);

    // Fetch all pages with relationships via Notion API
    console.log(`📡 Fetching all pages with relationships from Notion database "${atlasDatabaseName}"...`);
    const notionPagesWithRelationships = await fetchNotionDatabasePagesWithRelationships({ atlasDatabaseName });

    console.log(`✅ Fetched ${notionPagesWithRelationships.length} pages with relationships from Notion database`);

    // Process and sync the pages to Supabase
    console.log(`🔄 Syncing changed pages to Supabase...`);

    if (existingPages.length > 0) {
      const changes = compareDatabasePages({
        supabasePages: existingPages,
        notionPages: notionPagesWithRelationships,
        atlasDatabaseName,
      });

      console.log(
        `📊 Detected changes: ${changes.newPages.length} new, ${changes.deletedPages.length} deleted, ${changes.changedProperties.length} with property changes, ${changes.changedRelationships.length} with relationship changes`,
      );

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
        const notionPagesToProcess = notionPagesWithRelationships.filter((page) => pagesToProcess.includes(page.id));

        const pagesInDatabaseFormat = await convertNotionPagesToDatabaseFormat({
          notionPages: notionPagesToProcess,
          atlasDatabaseName,
        });

        // Insert new pages
        if (pagesToInsert.length > 0) {
          const newPages = pagesInDatabaseFormat.filter((page: NotionDatabasePage) =>
            pagesToInsert.includes(page.notion_page_id),
          );
          console.log(`📝 Inserting ${newPages.length} new pages...`);
          await insertPagesInBatches(newPages, false);
          console.log(`✅ Successfully inserted ${newPages.length} new pages`);
        }

        // Upsert changed pages
        if (pagesToUpsert.length > 0) {
          const changedPages = pagesInDatabaseFormat.filter((page: NotionDatabasePage) =>
            pagesToUpsert.includes(page.notion_page_id),
          );
          console.log(`🔄 Upserting ${changedPages.length} changed pages...`);
          await insertPagesInBatches(changedPages, true);
          console.log(`✅ Successfully upserted ${changedPages.length} changed pages`);
        }
      } else {
        console.log(`✅ No changes detected - all pages are up to date`);
      }

      blocksSyncedCount = changes.deletedPages.length + pagesToInsert.length + pagesToUpsert.length;
    } else {
      // First time import - insert all pages
      console.log(`📝 First time import - inserting all ${notionPagesWithRelationships.length} pages...`);
      const databasePages = await convertNotionPagesToDatabaseFormat({
        notionPages: notionPagesWithRelationships,
        atlasDatabaseName,
      });
      await insertPagesInBatches(databasePages, false);
      console.log(`✅ Successfully inserted all ${databasePages.length} pages`);

      blocksSyncedCount = databasePages.length;
    }

    await releaseSyncLock({
      notionDatabaseId,
      syncStatus: 'completed',
      syncErrorMessage: null,
      blocksSyncedCount,
    });
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Import failed after ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(2)}s):`, error);

    await releaseSyncLock({
      notionDatabaseId,
      syncStatus: 'failed',
      syncErrorMessage: errorMessage,
      blocksSyncedCount: null,
    });

    throw error;
  }
}
