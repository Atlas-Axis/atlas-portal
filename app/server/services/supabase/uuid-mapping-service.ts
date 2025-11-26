/**
 * UUID Mapping Service
 *
 * Manages bidirectional mappings between Notion page UUIDs and Atlas document UUIDs.
 * Supports storing new mappings for pages created during Markdown→Notion sync.
 *
 * @see {@link file://../../../../docs/UUID_MAPPING.md} for UUID mapping system documentation
 */
import { supabase } from './supabase-client';

/**
 * Store a UUID mapping for a newly created Notion page.
 *
 * This function is called after successfully creating a page in Notion during sync
 * to establish the bidirectional mapping between the Notion page ID and the Atlas document UUID.
 *
 * @param notionPageId The UUID of the Notion page (returned by Notion API)
 * @param atlasDocumentUuid The Atlas document UUID from the markdown file
 * @throws Error if the mapping fails to store
 */
export async function storeUuidMapping(notionPageId: string, atlasDocumentUuid: string): Promise<void> {
  const { error } = await supabase().from('uuid_mapping').insert({
    notion_page_id: notionPageId,
    atlas_document_uuid: atlasDocumentUuid,
  });

  if (error) {
    // Check if this is a duplicate key error (mapping already exists)
    if (error.code === '23505') {
      // Unique constraint violation - mapping already exists
      console.warn(
        `UUID mapping already exists for Notion page ${notionPageId} or Atlas UUID ${atlasDocumentUuid}. Skipping.`,
      );
      return;
    }

    throw new Error(`Failed to store UUID mapping: ${error.message}`);
  }

  console.log(`✓ Stored UUID mapping: ${atlasDocumentUuid} → ${notionPageId}`);
}

/**
 * Store multiple UUID mappings in a single batch operation.
 *
 * This is more efficient than calling storeUuidMapping() multiple times
 * when creating many pages during sync.
 *
 * NOTE: This function is currently unused and may be deleted in the future.
 * It was created for potential batch operations but is not currently needed.
 *
 * @param mappings Array of UUID mappings to store
 * @throws Error if any mapping fails to store
 */
export async function storeUuidMappingsBatch(
  mappings: Array<{ notionPageId: string; atlasDocumentUuid: string }>,
): Promise<void> {
  if (mappings.length === 0) {
    return;
  }

  const rows = mappings.map((m) => ({
    notion_page_id: m.notionPageId,
    atlas_document_uuid: m.atlasDocumentUuid,
  }));

  const { error } = await supabase().from('uuid_mapping').insert(rows);

  if (error) {
    // For batch operations, we need to handle duplicate errors more carefully
    // If some mappings already exist, we might want to continue with the others
    throw new Error(`Failed to store UUID mappings batch: ${error.message}`);
  }

  console.log(`✓ Stored ${mappings.length} UUID mappings in batch`);
}

/**
 * Check if a UUID mapping exists for a given Atlas document UUID.
 *
 * This is useful during sync to determine if a document already has
 * a corresponding Notion page.
 *
 * NOTE: This function is currently unused and may be deleted in the future.
 * Created for potential future use but not currently needed in the sync workflow.
 *
 * @param atlasDocumentUuid The Atlas document UUID to check
 * @returns The Notion page ID if mapping exists, null otherwise
 */
export async function getNotionPageIdForAtlasUuid(atlasDocumentUuid: string): Promise<string | null> {
  const { data, error } = await supabase()
    .from('uuid_mapping')
    .select('notion_page_id')
    .eq('atlas_document_uuid', atlasDocumentUuid)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned - mapping doesn't exist
      return null;
    }
    throw new Error(`Failed to get Notion page ID for Atlas UUID: ${error.message}`);
  }

  return data?.notion_page_id || null;
}

/**
 * Check if a UUID mapping exists for a given Notion page ID.
 *
 * This is useful for reverse lookups when processing Notion data.
 *
 * NOTE: This function is currently unused and may be deleted in the future.
 * Created for potential future use but not currently needed in the sync workflow.
 *
 * @param notionPageId The Notion page ID to check
 * @returns The Atlas document UUID if mapping exists, null otherwise
 */
export async function getAtlasUuidForNotionPageId(notionPageId: string): Promise<string | null> {
  const { data, error } = await supabase()
    .from('uuid_mapping')
    .select('atlas_document_uuid')
    .eq('notion_page_id', notionPageId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned - mapping doesn't exist
      return null;
    }
    throw new Error(`Failed to get Atlas UUID for Notion page ID: ${error.message}`);
  }

  return data?.atlas_document_uuid || null;
}
