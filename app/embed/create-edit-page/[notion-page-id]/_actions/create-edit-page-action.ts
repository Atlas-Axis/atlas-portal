'use server';

import { NOTION_DATABASE_ID, NOTION_EDIT_PAGES_CONTAINING_DATABASE_ID } from '@/app/server/services/notion/_demo-data';
// import type { CreatePageParameters } from '@notionhq/client/build/src/api-endpoints';
import { createNotionPageWithToggleBlocks } from '@/app/server/services/notion/create-toggle-page';
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

    // Call the main function
    const result = await createNotionPageWithToggleBlocks({
      originalNotionDatabaseId: NOTION_DATABASE_ID, // TODO: Don't require this. Look it up from the rootNotionPageId.
      rootNotionPageId,
      taskRunId: '', // Will be filled by Trigger.dev
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
