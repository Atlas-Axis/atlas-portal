import { supabase } from '@/app/server/services/supabase/supabase-client';

export interface UuidMappings {
  notionPageIDsToAtlasUUIDs: Map<string, string>;
  atlasUUIDsToNotionPageIds: Map<string, string>;
}

/**
 * Load UUID mappings from the uuid_mapping table and return them as two efficient lookup maps.
 *
 * @returns Object containing:
 *   - notionToAtlas: Map from notion_page_id to atlas_document_uuid
 *   - atlasToNotion: Map from atlas_document_uuid to notion_page_id
 */
export async function loadUuidMappings(): Promise<UuidMappings> {
  const notionPageIDsToAtlasUUIDs = new Map<string, string>();
  const atlasUUIDsToNotionPageIds = new Map<string, string>();

  // Load all mappings in pages to handle large datasets
  let fromIdx = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase()
      .from('uuid_mapping')
      .select('notion_page_id, atlas_document_uuid')
      .range(fromIdx, fromIdx + pageSize - 1);

    if (error) {
      throw new Error(`Failed to load UUID mappings: ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    // Populate both maps
    for (const row of data) {
      if (row.notion_page_id && row.atlas_document_uuid) {
        notionPageIDsToAtlasUUIDs.set(row.notion_page_id, row.atlas_document_uuid);
        atlasUUIDsToNotionPageIds.set(row.atlas_document_uuid, row.notion_page_id);
      }
    }

    if (data.length < pageSize) {
      break;
    }

    fromIdx += pageSize;
  }

  return { notionPageIDsToAtlasUUIDs, atlasUUIDsToNotionPageIds };
}
