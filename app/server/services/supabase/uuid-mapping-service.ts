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
