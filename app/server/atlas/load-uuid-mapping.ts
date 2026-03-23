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
