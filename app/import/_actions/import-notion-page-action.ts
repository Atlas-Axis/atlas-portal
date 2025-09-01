'use server';

import { NOTION_PAGE_ID } from '@/app/server/services/notion/_demo-data';
import { importBlocksFromNotionToSupabase } from '@/app/server/services/notion/import-page-to-supabase';
import { isValidUUID } from '@/app/shared/utils/utils';

export async function importNotionPageAction() {
  // Validate that notionPageId is a valid UUID
  if (!isValidUUID(NOTION_PAGE_ID)) {
    return {
      success: false,
      message: 'Invalid UUID format',
    };
  }

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
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
