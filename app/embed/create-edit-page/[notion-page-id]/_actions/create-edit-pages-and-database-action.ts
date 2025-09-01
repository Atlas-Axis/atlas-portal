'use server';

import { NOTION_DATABASE_ID, NOTION_EDIT_PAGES_CONTAINING_PAGE_ID } from '@/app/server/services/notion/_demo-data';
import { createNotionEditPagesAndDatabase } from '@/app/server/services/notion/create-edit-pages-and-edit-database';
import type { CreateEditPagesAndDatabaseResult } from '@/app/server/services/notion/create-edit-pages-and-edit-database';
import { isValidUUID } from '@/app/shared/utils/utils';

export type CreateEditPagesAndDatabaseActionResult = {
  success: boolean;
  message: string;
  result: CreateEditPagesAndDatabaseResult | null;
};

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
    const result = await createNotionEditPagesAndDatabase({
      originalNotionDatabaseId: NOTION_DATABASE_ID, // TODO: Make dynamic
      rootNotionPageId: notionPageId,
      taskRunId: '',
      propertyWhitelist: ['Name', 'Content', 'Doc No (or Temp Name)'], // TODO: Make dynamic
      parent: {
        type: 'page_id',
        page_id: NOTION_EDIT_PAGES_CONTAINING_PAGE_ID, // TODO: Make dynamic
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
