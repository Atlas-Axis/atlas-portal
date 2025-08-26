import { supabase } from '@/app/server/services/supabase/supabase-client';

type SyncStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export async function startSyncStatus(notionPageId: string) {
  return supabase
    .from('notion_sync_status')
    .upsert(
      {
        notion_page_id: notionPageId,
        sync_status: 'in_progress',
        last_sync_started_at: new Date().toISOString(),
        last_sync_completed_at: null,
        sync_error_message: null,
        blocks_synced_count: 0,
        is_sync_locked: true,
        sync_lock_acquired_at: new Date().toISOString(),
        sync_lock_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes from now
      },
      { onConflict: 'notion_page_id' },
    )
    .throwOnError();
}

export async function endSyncStatus({
  notionPageId,
  syncStatus,
  syncErrorMessage = null,
  blocksSyncedCount = null,
}: {
  notionPageId: string;
  syncStatus: SyncStatus;
  syncErrorMessage: string | null;
  blocksSyncedCount: number | null;
}) {
  return supabase
    .from('notion_sync_status')
    .upsert(
      {
        notion_page_id: notionPageId,
        sync_status: syncStatus,
        last_sync_completed_at: new Date().toISOString(),
        sync_error_message: syncErrorMessage,
        blocks_synced_count: blocksSyncedCount,
        is_sync_locked: false,
        sync_lock_acquired_at: null,
        sync_lock_expires_at: null,
      },
      { onConflict: 'notion_page_id' },
    )
    .throwOnError();
}
