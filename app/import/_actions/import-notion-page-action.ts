'use server';

import { importFromNotionToSupabase } from '@/app/server/services/notion/import-to-supabase';

export async function importNotionPageAction() {
  try {
    await importFromNotionToSupabase({ taskRunId: '' });

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
