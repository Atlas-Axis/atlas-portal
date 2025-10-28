'use server';

/**
 * Notion Nesting Bug Fix - Server Action
 *
 * Handles saving ID mappings from the UI to Supabase.
 *
 * @see {@link file://../../../docs/NOTION_NESTING_BUG_FIX.md} for complete documentation
 */
import {
  NotionNestingBugMapping,
  saveNotionNestingFixMappings,
} from '@/app/server/services/supabase/notion-nesting-bug-mappings';

export interface SaveMappingsResult {
  success: boolean;
  error?: string;
}

/**
 * Server action to save nesting bug mappings
 */
export async function saveMappingsAction(mappings: NotionNestingBugMapping[]): Promise<SaveMappingsResult> {
  try {
    await saveNotionNestingFixMappings(mappings);
    return { success: true };
  } catch (error) {
    console.error('Error saving mappings:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
