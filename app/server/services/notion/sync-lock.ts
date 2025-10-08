import { supabase } from '@/app/server/services/supabase/supabase-client';
import { DEBUG_LOGGING } from '@/app/shared/utils/is-debug-logging-enabled';

type SyncStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

const SYNC_LOCK_TIMEOUT_MINUTES = 30;

export async function acquireSyncLock(notionDatabaseId: string) {
  if (DEBUG_LOGGING) {
    console.log(`Acquiring sync lock for database ${notionDatabaseId}`);
  }

  const result = supabase()
    .from('notion_sync_status')
    .upsert(
      {
        notion_database_id: notionDatabaseId,
        sync_status: 'in_progress',
        last_sync_started_at: new Date().toISOString(),
        last_sync_completed_at: null,
        sync_error_message: null,
        blocks_synced_count: 0,
        is_sync_locked: true,
        sync_lock_acquired_at: new Date().toISOString(),
        sync_lock_expires_at: new Date(Date.now() + SYNC_LOCK_TIMEOUT_MINUTES * 60 * 1000).toISOString(), // 30 minutes from now
      },
      { onConflict: 'notion_database_id' },
    )
    .throwOnError();

  if (DEBUG_LOGGING) {
    console.log(`Sync lock acquired successfully`);
  }

  return result;
}

export async function releaseSyncLock({
  notionDatabaseId,
  syncStatus,
  syncErrorMessage = null,
  syncedCount = null,
}: {
  notionDatabaseId: string;
  syncStatus: SyncStatus;
  syncErrorMessage: string | null;
  syncedCount: number | null;
}) {
  console.log(`Releasing sync lock for database ${notionDatabaseId} with status ${syncStatus}`);
  if (syncErrorMessage) {
    console.error(`Sync error message: ${syncErrorMessage}`);
  }
  console.log(`Synced count: ${syncedCount}`);

  return supabase()
    .from('notion_sync_status')
    .upsert(
      {
        notion_database_id: notionDatabaseId,
        sync_status: syncStatus,
        last_sync_completed_at: new Date().toISOString(),
        sync_error_message: syncErrorMessage,
        blocks_synced_count: syncedCount,
        is_sync_locked: false,
        sync_lock_acquired_at: null,
        sync_lock_expires_at: null,
      },
      { onConflict: 'notion_database_id' },
    )
    .throwOnError();
}

export async function verifySyncLock(notionPageId: string) {
  const { data } = await supabase()
    .from('notion_sync_status')
    .select('is_sync_locked')
    .eq('notion_database_id', notionPageId)
    .maybeSingle()
    .throwOnError();

  const isSyncLocked = data?.is_sync_locked ?? false;

  if (isSyncLocked) {
    throw new Error('🚫 Sync is already running');
  }
}
