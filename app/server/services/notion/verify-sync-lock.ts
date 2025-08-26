import { supabase } from '@/app/server/services/supabase/supabase-client';

export async function verifySyncLock(notionPageId: string) {
  const { data } = await supabase
    .from('notion_sync_status')
    .select('is_sync_locked')
    .eq('notion_page_id', notionPageId)
    .maybeSingle()
    .throwOnError();

  const isSyncLocked = data?.is_sync_locked ?? false;

  if (isSyncLocked) {
    throw new Error('Sync is already running');
  }
}
