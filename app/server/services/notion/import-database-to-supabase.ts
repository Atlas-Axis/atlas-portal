import { ATLAS_DATABASE_ID_MAP, AtlasDatabaseID, AtlasDatabaseName } from '../atlas/constants';
import { releaseSyncLock, verifySyncLock } from './sync-lock';

/**
 * Sync all pages from a Notion database to Supabase
 */
export async function importDatabasePagesFromNotionToSupabase({
  atlasDatabaseName,
}: {
  atlasDatabaseName: AtlasDatabaseName;
}) {
  const startTime = performance.now();
  console.log(`🚀 Starting database import from Notion to Supabase`);

  const notionDatabaseId: AtlasDatabaseID = ATLAS_DATABASE_ID_MAP[atlasDatabaseName];
  console.log(`📊 Database: ${atlasDatabaseName}`);

  // Verify that the sync is not already in progress
  console.log(`🔒 Verifying sync lock for database ${notionDatabaseId}...`);
  await verifySyncLock(notionDatabaseId);
  console.log(`✅ Sync lock verified - proceeding with import`);

  try {
    //
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
