'use server';

import {
  ATLAS_DATABASES,
  ATLAS_DATABASE_ID_MAP_REVERSED,
  AtlasDatabaseName,
} from '@/app/server/services/atlas/constants';
import { importDatabasePagesFromNotionToSupabase } from '@/app/server/services/notion/to_delete/_old.import-database-to-supabase';
import { isValidUUID } from '@/app/shared/utils/utils';

export async function importNotionDatabaseAction(notionDatabaseId: string) {
  // Validate that notionDatabaseId is a valid UUID
  if (!isValidUUID(notionDatabaseId)) {
    return {
      success: false,
      message: 'Invalid UUID format',
    };
  }

  // Find the database name from the ID by looking it up in the ATLAS_DATABASE_ID_MAP (need to reverse the map)
  const atlasDatabaseName: AtlasDatabaseName | undefined = ATLAS_DATABASE_ID_MAP_REVERSED[notionDatabaseId];

  // If the database name is not found or not in the known Atlas databases, return an error
  if (!atlasDatabaseName || !(atlasDatabaseName in ATLAS_DATABASES)) {
    return {
      success: false,
      message: 'Notion database ID does not correspond to a known Atlas database',
    };
  }

  try {
    await importDatabasePagesFromNotionToSupabase({ atlasDatabaseName });

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
