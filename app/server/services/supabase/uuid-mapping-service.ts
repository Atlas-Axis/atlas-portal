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
  console.log(`[UUID_TRACE] storeUuidMapping called: Notion=${notionPageId} → Atlas=${atlasDocumentUuid}`);

  const { data, error } = await supabase()
    .from('uuid_mapping')
    .insert({
      notion_page_id: notionPageId,
      atlas_document_uuid: atlasDocumentUuid,
    })
    .select();

  if (error) {
    console.log(`[UUID_TRACE] Insert error: code=${error.code}, message=${error.message}`);
    console.log(`[UUID_TRACE] Error details:`, error.details);

    // Check if this is a duplicate key error (mapping already exists)
    if (error.code === '23505') {
      // Unique constraint violation - determine which constraint was violated
      // PostgreSQL error messages typically include the constraint name
      const errorMessage = error.message?.toLowerCase() || '';
      const errorDetails = (error.details as string)?.toLowerCase() || '';
      const combinedError = `${errorMessage} ${errorDetails}`;

      console.log(`[UUID_TRACE] Duplicate key error. Combined error text: ${combinedError}`);

      // Check if the duplicate is on notion_page_id (safe to skip)
      if (combinedError.includes('notion_page_id')) {
        console.log(`ℹ️ UUID mapping already exists for Notion page ${notionPageId}. Skipping (idempotent operation).`);
        console.log(`[UUID_TRACE] Skipping because notion_page_id already exists`);
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
        console.log(`[UUID_TRACE] CRITICAL: Atlas UUID collision detected!`);
        return { success: false, skippedReason: 'atlas_uuid_exists', warning };
      }

      // Generic fallback if we can't determine which constraint was violated
      console.warn(
        `UUID mapping already exists for Notion page ${notionPageId} or Atlas UUID ${atlasDocumentUuid}. Skipping.`,
      );
      console.log(`[UUID_TRACE] Generic duplicate - could not determine which constraint was violated`);
      return { success: false, skippedReason: 'notion_page_id_exists' };
    }

    console.error(`[UUID_TRACE] Non-duplicate error, throwing:`, error);
    throw new Error(`Failed to store UUID mapping: ${error.message}`);
  }

  console.log(`✓ Stored UUID mapping: ${atlasDocumentUuid} → ${notionPageId}`);
  console.log(`[UUID_TRACE] Insert successful. Returned data:`, data);
  return { success: true };
}

/**
 * Verify that a UUID mapping exists in the database.
 * Used for debugging to confirm mappings were stored correctly.
 *
 * @param notionPageId The Notion page ID to check
 * @returns The mapping if found, null otherwise
 */
export async function verifyUuidMapping(
  notionPageId: string,
): Promise<{ notion_page_id: string; atlas_document_uuid: string } | null> {
  const { data, error } = await supabase()
    .from('uuid_mapping')
    .select('notion_page_id, atlas_document_uuid')
    .eq('notion_page_id', notionPageId)
    .maybeSingle();

  if (error) {
    console.error(`[UUID_TRACE] Verify error for ${notionPageId}:`, error);
    return null;
  }

  return data;
}

/**
 * Look up a UUID mapping by Atlas document UUID.
 * Used to check if an Atlas document already has a Notion page mapping before creating a new page.
 *
 * @param atlasUuid The Atlas document UUID to look up
 * @returns The mapping if found, null otherwise
 */
export async function getUuidMappingByAtlasUuid(
  atlasUuid: string,
): Promise<{ notion_page_id: string; atlas_document_uuid: string } | null> {
  const { data, error } = await supabase()
    .from('uuid_mapping')
    .select('notion_page_id, atlas_document_uuid')
    .eq('atlas_document_uuid', atlasUuid.toLowerCase())
    .maybeSingle();

  if (error) {
    console.error(`[UUID_TRACE] Lookup error for Atlas UUID ${atlasUuid}:`, error);
    return null;
  }

  return data;
}
