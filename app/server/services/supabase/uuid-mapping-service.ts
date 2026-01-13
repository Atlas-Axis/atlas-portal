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
 * Result of a storeUuidMapping operation
 */
export interface StoreUuidMappingResult {
  success: boolean;
  /** If the mapping was skipped, this indicates why */
  skippedReason?: 'notion_page_id_exists' | 'atlas_uuid_exists';
  /** Warning message if the operation was skipped due to a potential data issue */
  warning?: string;
}

/**
 * Store a UUID mapping for a newly created Notion page.
 *
 * This function is called after successfully creating a page in Notion during sync
 * to establish the bidirectional mapping between the Notion page ID and the Atlas document UUID.
 *
 * Handles duplicate key errors gracefully:
 * - If notion_page_id already exists: Safe to skip (idempotent operation)
 * - If atlas_document_uuid already exists: Logs a WARNING as this indicates the Atlas UUID
 *   is already mapped to a different Notion page, which could cause data inconsistency
 *
 * @param notionPageId The UUID of the Notion page (returned by Notion API)
 * @param atlasDocumentUuid The Atlas document UUID from the markdown file
 * @returns Result indicating success or skip reason
 * @throws Error if the mapping fails to store for non-duplicate reasons
 */
export async function storeUuidMapping(
  notionPageId: string,
  atlasDocumentUuid: string,
): Promise<StoreUuidMappingResult> {
  const { error } = await supabase().from('uuid_mapping').insert({
    notion_page_id: notionPageId,
    atlas_document_uuid: atlasDocumentUuid,
  });

  if (error) {
    // Check if this is a duplicate key error (mapping already exists)
    if (error.code === '23505') {
      // Unique constraint violation - determine which constraint was violated
      // PostgreSQL error messages typically include the constraint name
      const errorMessage = error.message?.toLowerCase() || '';
      const errorDetails = (error.details as string)?.toLowerCase() || '';
      const combinedError = `${errorMessage} ${errorDetails}`;

      // Check if the duplicate is on notion_page_id (safe to skip)
      if (combinedError.includes('notion_page_id')) {
        console.log(`ℹ️ UUID mapping already exists for Notion page ${notionPageId}. Skipping (idempotent operation).`);
        return { success: false, skippedReason: 'notion_page_id_exists' };
      }

      // Check if the duplicate is on atlas_document_uuid (potential data issue!)
      if (combinedError.includes('atlas_document_uuid')) {
        const warning =
          `⚠️ WARNING: Atlas UUID ${atlasDocumentUuid} is already mapped to a DIFFERENT Notion page! ` +
          `Attempted to map it to ${notionPageId}. This indicates a data consistency issue - ` +
          `the Atlas UUID may have been previously mapped during a Notion import with a random UUID. ` +
          `Consider cleaning up the uuid_mapping table.`;
        console.warn(warning);
        return { success: false, skippedReason: 'atlas_uuid_exists', warning };
      }

      // Generic fallback if we can't determine which constraint was violated
      console.warn(
        `UUID mapping already exists for Notion page ${notionPageId} or Atlas UUID ${atlasDocumentUuid}. Skipping.`,
      );
      return { success: false, skippedReason: 'notion_page_id_exists' };
    }

    throw new Error(`Failed to store UUID mapping: ${error.message}`);
  }

  console.log(`✓ Stored UUID mapping: ${atlasDocumentUuid} → ${notionPageId}`);
  return { success: true };
}
