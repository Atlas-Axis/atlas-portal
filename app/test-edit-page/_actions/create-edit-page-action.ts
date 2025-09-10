'use server';

import type { CreatePageParameters } from '@notionhq/client';
import { _delete_createNotionPageWithToggleBlocks } from '@/app/server/services/notion/to_delete/_old.create-toggle-page';

export interface CreateEditPageParams {
  originalNotionDatabaseId: string;
  rootNotionPageId: string;
  parent: CreatePageParameters['parent'];
}

export interface CreateEditPageResult {
  success: boolean;
  data?: {
    newNotionPageId: string;
    blocksCreatedCount: number;
    duration: number;
    details: {
      originalNotionDatabaseId: string;
      rootNotionPageId: string;
      parent: CreatePageParameters['parent'];
    };
  };
  error?: string;
  errorDetails?: string;
}

export async function createEditPageAction(params: CreateEditPageParams): Promise<CreateEditPageResult> {
  try {
    const { originalNotionDatabaseId, rootNotionPageId, parent } = params;

    // Validate required parameters
    if (!originalNotionDatabaseId) {
      return {
        success: false,
        error: 'originalNotionDatabaseId is required',
      };
    }

    if (!rootNotionPageId) {
      return {
        success: false,
        error: 'rootNotionPageId is required',
      };
    }

    if (!parent) {
      return {
        success: false,
        error: 'parent is required',
      };
    }

    const startTime = performance.now();

    // Call the main function
    const result = await _delete_createNotionPageWithToggleBlocks({
      originalNotionDatabaseId,
      rootNotionPageId,
      parent,
    });

    const endTime = performance.now();
    const duration = endTime - startTime;

    return {
      success: true,
      data: {
        ...result,
        duration,
        details: {
          originalNotionDatabaseId,
          rootNotionPageId,
          parent,
        },
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
