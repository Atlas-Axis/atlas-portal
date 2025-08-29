'use server';

import { NOTION_PAGE_ID } from '@/app/server/services/notion/_demo-data';
import { importBlocksFromNotionToSupabase } from '@/app/server/services/notion/import-page-to-supabase';

export async function importNotionPageAction() {
  try {
    await importBlocksFromNotionToSupabase({ notionPageId: NOTION_PAGE_ID, taskRunId: '' });

    return {
      success: true,
      message: 'Notion page imported successfully',
    };
  } catch (error) {
    console.error('Failed to import Notion page:', error);
    return {
      success: false,
      message: 'Failed to import Notion page',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
