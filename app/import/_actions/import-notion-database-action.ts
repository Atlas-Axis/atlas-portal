'use server';

import { NOTION_DATABASE_ID } from '@/app/server/services/notion/_demo-data';
import { importDatabasePagesFromNotionToSupabase } from '@/app/server/services/notion/import-database-to-supabase';

export async function importNotionDatabaseAction() {
  try {
    await importDatabasePagesFromNotionToSupabase({ notionDatabaseId: NOTION_DATABASE_ID, taskRunId: '' });

    return {
      success: true,
      message: 'Notion database imported successfully',
    };
  } catch (error) {
    console.error('Failed to import Notion database:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
