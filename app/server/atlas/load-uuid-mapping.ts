import { supabase } from '@/app/server/services/supabase/supabase-client';
import { isValidUUID, uuidToHyphens } from '@/app/shared/utils/utils';

export interface UuidMappings {
  notionPageIDsToAtlasUUIDs: Map<string, string>;
  atlasUUIDsToNotionPageIds: Map<string, string>;
}

/**
 * Normalize a UUID to lowercase hyphenated format for consistent lookups.
 * This is necessary because:
 * - PostgreSQL stores UUIDs in lowercase hyphenated format
 * - The Notion API may return UUIDs with different casing or without hyphens
 * - JavaScript Map lookups are case-sensitive and format-sensitive
 *
 * @param uuid - UUID in any format (with/without hyphens, any case)
 * @returns UUID in lowercase hyphenated format (e.g., "550e8400-e29b-41d4-a716-446655440000")
 */
export function normalizeUuidForLookup(uuid: string): string {
  // If already a valid hyphenated UUID, just lowercase it
  if (isValidUUID(uuid)) {
    return uuid.toLowerCase();
  }

  // If it's a 32-character string (non-hyphenated UUID), convert to hyphenated format
  if (uuid.length === 32 && /^[0-9a-f]+$/i.test(uuid)) {
    return uuidToHyphens(uuid).toLowerCase();
  }

  // Fallback for non-standard strings (e.g., in tests) - just lowercase
  return uuid.toLowerCase();
}

/**
 * Load UUID mappings from the uuid_mapping table and return them as two efficient lookup maps.
 *
 * All UUIDs are normalized to lowercase for consistent lookups, as:
 * - PostgreSQL returns UUIDs in lowercase
 * - The Notion API may return UUIDs with different casing
 * - JavaScript Map lookups are case-sensitive
 *
 * @returns Object containing:
 *   - notionToAtlas: Map from notion_page_id (lowercase) to atlas_document_uuid (lowercase)
 *   - atlasToNotion: Map from atlas_document_uuid (lowercase) to notion_page_id (lowercase)
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

    // Populate both maps with normalized (lowercase) UUIDs for consistent lookups
    for (const row of data) {
      if (row.notion_page_id && row.atlas_document_uuid) {
        const notionPageId = normalizeUuidForLookup(row.notion_page_id);
        const atlasUuid = normalizeUuidForLookup(row.atlas_document_uuid);
        notionPageIDsToAtlasUUIDs.set(notionPageId, atlasUuid);
        atlasUUIDsToNotionPageIds.set(atlasUuid, notionPageId);
      }
    }

    if (data.length < pageSize) {
      break;
    }

    fromIdx += pageSize;
  }

  return { notionPageIDsToAtlasUUIDs, atlasUUIDsToNotionPageIds };
}

/**
 * Serialized version of UuidMappings for embedding in HTML/JSON.
 * Uses plain objects instead of Maps for JSON serialization.
 */
export interface SerializedUuidMappings {
  notionPageIDsToAtlasUUIDs: Record<string, string>;
  atlasUUIDsToNotionPageIds: Record<string, string>;
}

/**
 * Converts UuidMappings (with Maps) to a JSON-serializable format.
 * Useful for embedding in HTML script tags or API responses.
 */
export function serializeUuidMappings(mappings: UuidMappings): SerializedUuidMappings {
  return {
    notionPageIDsToAtlasUUIDs: Object.fromEntries(mappings.notionPageIDsToAtlasUUIDs),
    atlasUUIDsToNotionPageIds: Object.fromEntries(mappings.atlasUUIDsToNotionPageIds),
  };
}

/**
 * Converts serialized UUID mappings back to UuidMappings format with Maps.
 * Used on the client to deserialize embedded UUID mapping data.
 * Normalizes all UUIDs to lowercase for consistent lookups.
 */
export function deserializeUuidMappings(serialized: SerializedUuidMappings): UuidMappings {
  // Normalize all UUIDs to lowercase when deserializing
  const notionPageIDsToAtlasUUIDs = new Map<string, string>();
  const atlasUUIDsToNotionPageIds = new Map<string, string>();

  for (const [notionId, atlasId] of Object.entries(serialized.notionPageIDsToAtlasUUIDs)) {
    notionPageIDsToAtlasUUIDs.set(normalizeUuidForLookup(notionId), normalizeUuidForLookup(atlasId));
  }

  for (const [atlasId, notionId] of Object.entries(serialized.atlasUUIDsToNotionPageIds)) {
    atlasUUIDsToNotionPageIds.set(normalizeUuidForLookup(atlasId), normalizeUuidForLookup(notionId));
  }

  return { notionPageIDsToAtlasUUIDs, atlasUUIDsToNotionPageIds };
}
