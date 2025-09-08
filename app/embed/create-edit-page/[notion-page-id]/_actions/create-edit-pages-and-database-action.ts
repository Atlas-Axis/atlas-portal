'use server';

import { NOTION_EDIT_PAGES_CONTAINING_PAGE_ID } from '@/app/server/services/notion/_demo-data';
import { createNotionEditPagesAndDatabase } from '@/app/server/services/notion/create-edit-pages-and-edit-database';
import type { CreateEditPagesAndDatabaseResult } from '@/app/server/services/notion/create-edit-pages-and-edit-database';
import { getNotionDatabaseIdFromNotionPage } from '@/app/server/services/supabase/get-notion-database-id-from-notion-page';
import { isValidUUID } from '@/app/shared/utils/utils';

export type CreateEditPagesAndDatabaseActionResult = {
  success: boolean;
  message: string;
  result: CreateEditPagesAndDatabaseResult | null;
};

// TODO: Delete this file and related test page
export async function createEditPagesAndDatabaseAction(
  notionPageId: string,
): Promise<CreateEditPagesAndDatabaseActionResult> {
  // Validate that notionPageId is a valid UUID
  if (!isValidUUID(notionPageId)) {
    return {
      success: false,
      message: 'Invalid UUID format',
      result: null,
    };
  }

  try {
    // Fetch the database ID for the given page ID
    const notionDatabaseId = await getNotionDatabaseIdFromNotionPage(notionPageId);
    if (!notionDatabaseId) {
      return {
        success: false,
        message: `No database ID found for page ${notionPageId}`,
        result: null,
      };
    }

    const result = await createNotionEditPagesAndDatabase({
      originalNotionDatabaseId: notionDatabaseId,
      rootNotionPageId: notionPageId,
      taskRunId: '',
      propertyWhitelist: ['Name', 'Content', 'Doc No (or Temp Name)'], // TODO: Make dynamic
      parent: {
        type: 'page_id',
        page_id: NOTION_EDIT_PAGES_CONTAINING_PAGE_ID,
      },
    });

    return {
      success: true,
      message: 'Editable page created successfully!',
      result,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'An unknown error occurred',
      result: null,
    };
  }
}
