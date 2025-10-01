import { supabase } from '@/app/server/services/supabase/supabase-client';

export async function loadTextContentForNotionPageIds(notionPageIds: string[]): Promise<Record<string, string>> {
  const { data, error } = await supabase()
    .from('notion_database_pages') // TODO: notion_database_pages_current
    .select('notion_page_id, plain_text_content')
    .in('notion_page_id', notionPageIds);

  if (error) {
    console.error({ error });
    throw new Error(`Failed to load content for Notion page IDs: ${error.message}`, { cause: error });
  }

  // Map the results to a record
  const contentMap: Record<string, string> = {};
  data.forEach((item) => {
    contentMap[item.notion_page_id] = item.plain_text_content || '';
  });

  return contentMap;
}
