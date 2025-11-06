'use server';

/**
 * UUID Verification Server Action
 *
 * Verifies if a UUID exists in the notion_database_pages table and returns
 * relevant information for validation purposes.
 */
import { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import { supabase } from '@/app/server/services/supabase/supabase-client';

export interface UuidVerificationResult {
  exists: boolean;
  documentName?: string;
  atlas_database_name?: AtlasDatabaseName;
  child_section_and_primary_doc_ids?: string[];
  child_agent_scope_ids?: string[];
}

/**
 * Verify if a UUID exists in Supabase and return relevant information
 * @param uuid - The Notion page UUID to verify
 * @returns Verification result with document details if found
 */
/**
 * Type guard to check if a value is a string array
 */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export async function verifyUuidAction(uuid: string): Promise<UuidVerificationResult> {
  try {
    // Query the current pages view for this UUID
    const { data, error } = await supabase()
      .from('notion_database_pages_current')
      .select(
        'notion_page_id, plain_text_name, atlas_database_name, child_section_and_primary_doc_ids, child_agent_scope_ids',
      )
      .eq('notion_page_id', uuid)
      .single();

    if (error || !data) {
      // UUID not found or error occurred
      return { exists: false };
    }

    // UUID exists, return the details with proper type validation
    return {
      exists: true,
      documentName: data.plain_text_name || undefined,
      atlas_database_name: data.atlas_database_name as AtlasDatabaseName,
      child_section_and_primary_doc_ids: isStringArray(data.child_section_and_primary_doc_ids)
        ? data.child_section_and_primary_doc_ids
        : undefined,
      child_agent_scope_ids: isStringArray(data.child_agent_scope_ids) ? data.child_agent_scope_ids : undefined,
    };
  } catch (error) {
    // Handle any unexpected errors gracefully
    console.error('Error verifying UUID:', error);
    return { exists: false };
  }
}
