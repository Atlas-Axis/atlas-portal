'use server';

import { importDatabasePagesFromNotionToSupabase } from '@/app/server/services/notion/import-database-to-supabase';
import { isValidUUID } from '@/app/shared/utils/utils';

export async function importNotionDatabaseAction(notionDatabaseId: string) {
  // Validate that notionDatabaseId is a valid UUID
  if (!isValidUUID(notionDatabaseId)) {
    return {
      success: false,
      message: 'Invalid UUID format',
    };
  }

  try {
    await importDatabasePagesFromNotionToSupabase({ notionDatabaseId, taskRunId: '' });

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
