'use server';

import { NOTION_EDIT_PAGES_CONTAINING_DATABASE_ID } from '@/app/server/services/notion/_demo-data';
// import type { CreatePageParameters } from '@notionhq/client';
import { _delete_createNotionPageWithToggleBlocks } from '@/app/server/services/notion/to_delete/_old.create-toggle-page';
import { _delete_getNotionDatabaseIdFromNotionPage } from '@/app/server/services/supabase/to_delete/_old.get-notion-database-id-from-notion-page';
import { isValidUUID } from '@/app/shared/utils/utils';

export interface CreateEditPageResult {
  success: boolean;
  data?: {
    newNotionPageId: string;
    blocksCreatedCount: number;
    duration: number;
  };
  error?: string;
  errorDetails?: string;
}

export async function createEditPageAction(rootNotionPageId: string): Promise<CreateEditPageResult> {
  try {
    if (!rootNotionPageId) {
      return {
        success: false,
        error: 'rootNotionPageId is required',
      };
    }
    if (!isValidUUID(rootNotionPageId)) {
      return {
        success: false,
        error: 'Invalid UUID format for rootNotionPageId',
      };
    }

    const startTime = performance.now();

    // Fetch the database ID for the given page ID
    const notionDatabaseId = await _delete_getNotionDatabaseIdFromNotionPage(rootNotionPageId);
    if (!notionDatabaseId) {
      return {
        success: false,
        error: `No database ID found for page ${rootNotionPageId}`,
      };
    }

    // Call the main function
    const result = await _delete_createNotionPageWithToggleBlocks({
      originalNotionDatabaseId: notionDatabaseId,
      rootNotionPageId,
      parent: {
        type: 'database_id',
        database_id: NOTION_EDIT_PAGES_CONTAINING_DATABASE_ID, // TODO: Make dynamic
      },
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    return {
      success: true,
      data: {
        ...result,
        duration,
      },
    };
  } catch (error) {
    console.error('Server Action Error:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      errorDetails: error instanceof Error ? error.stack : undefined,
    };
  }
}
