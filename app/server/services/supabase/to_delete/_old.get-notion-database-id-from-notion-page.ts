import { supabase } from '@/app/server/services/supabase/supabase-client';

export async function _delete_getNotionDatabaseIdFromNotionPage(notionPageId: string): Promise<string | null> {
  const { data, error } = await supabase()
    .from('notion_database_pages')
    .select('root_notion_database_id')
    .eq('notion_page_id', notionPageId)
    .single();

  if (error) {
    console.error({ error });
    throw new Error(`Failed to get database ID for page ${notionPageId}: ${error.message}`, { cause: error });
  }

  return null;

  // return data?.root_notion_database_id || null;
}
