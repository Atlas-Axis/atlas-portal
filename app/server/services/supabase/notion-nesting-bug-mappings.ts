/**
 * Notion Nesting Bug Fix - Service Layer
 *
 * Provides database operations for storing and retrieving manual parent-child relationship mappings.
 * These mappings override incorrect Notion relationships during Notion imports for deeply nested documents.
 *
 * @see {@link file://../../../docs/NOTION_NESTING_BUG_FIX.md} for complete documentation
 */
import { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import { supabase } from './supabase-client';

export interface NotionNestingBugMapping {
  child_notion_page_id: string;
  parent_notion_page_id: string;
  atlas_database_name: AtlasDatabaseName;
  child_label?: string;
  parent_label?: string;
  place_after_sibling_notion_page_id?: string;
  place_after_sibling_label?: string;
}

/**
 * Load all Notion nesting bug mappings from Supabase
 */
export async function loadNotionNestingFixMappings(): Promise<NotionNestingBugMapping[]> {
  const { data, error } = await supabase()
    .from('notion_nesting_bug_mapping')
    .select(
      'child_notion_page_id, parent_notion_page_id, atlas_database_name, child_label, parent_label, place_after_sibling_notion_page_id, place_after_sibling_label',
    )
    .order('atlas_database_name', { ascending: true });

  if (error) {
    console.error('Error loading notion nesting bug mappings:', error);
    throw new Error(`Failed to load nesting bug mappings: ${error.message}`);
  }

  return data as NotionNestingBugMapping[];
}

/**
 * Save Notion nesting bug mappings to Supabase (upsert and delete as needed)
 */
export async function saveNotionNestingFixMappings(mappings: NotionNestingBugMapping[]): Promise<void> {
  // Start a transaction by deleting all existing mappings and inserting new ones
  // This is simpler than trying to diff and update individual records

  // Delete all existing mappings
  // Note: Supabase PostgREST requires a filter for delete operations. We use "is not null" to match all rows
  // since child_notion_page_id is NOT NULL in the schema
  const { error: deleteError } = await supabase()
    .from('notion_nesting_bug_mapping')
    .delete()
    .not('child_notion_page_id', 'is', null);

  if (deleteError) {
    console.error('Error deleting existing mappings:', deleteError);
    throw new Error(`Failed to delete existing mappings: ${deleteError.message}`);
  }

  // Insert new mappings if there are any
  if (mappings.length > 0) {
    const { error: insertError } = await supabase().from('notion_nesting_bug_mapping').insert(mappings);

    if (insertError) {
      console.error('Error inserting new mappings:', insertError);
      throw new Error(`Failed to insert new mappings: ${insertError.message}`);
    }
  }
}
