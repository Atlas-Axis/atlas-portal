import { supabase } from '@/app/server/services/supabase/supabase-client';

// TODO: Rename the file to reflect the method name, or update the method name if needed
export async function getOriginalRootNotionPageIdForEditPage(editPageId: string): Promise<string> {
  const { data, error } = await supabase()
    .from('notion_blocks')
    .select('edit_page_original_notion_page_id')
    .eq('notion_page_id', editPageId)
    .single();

  if (error) {
    console.error({ error });
    throw new Error(`Failed to get original Notion page ID for edit page ${editPageId}: ${error.message}`, {
      cause: error,
    });
  }

  if (!data || !data.edit_page_original_notion_page_id) {
    throw new Error(`No original Notion page ID found for edit page ${editPageId}`);
  }

  return data.edit_page_original_notion_page_id;
}
