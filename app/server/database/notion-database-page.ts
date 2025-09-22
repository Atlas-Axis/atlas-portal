import { Json } from '@/app/server/services/supabase/database.types';
import { AtlasDatabaseName, AtlasDocumentType } from '../services/atlas/constants';

// Represents a Notion page in the database
export interface NotionDatabasePage {
  // Primary keys and identifiers
  notion_page_id: string; // UUID - Notion page ID

  // Atlas document fields
  canonical_document_title?: string | null; // Title of the Atlas document this page belongs to
  atlas_document_type: AtlasDocumentType;
  atlas_document_number: string; // Document number of the Atlas document this page belongs to
  atlas_document_number_sortable?: string; // Computed column for natural sorting (auto-generated)
  atlas_database_name: AtlasDatabaseName;

  // Notion page metadata
  has_children: boolean;
  archived: boolean;
  in_trash: boolean;
  last_edited_by_user_id?: string | null; // ID of the Notion user who last edited this page

  // Content fields
  plain_text_name?: string | null; // Extracted plain text page title
  json_name: Json; // JSONB - Full block content from Notion API
  plain_text_content?: string | null; // Extracted plain text for easy searching
  json_content: Json; // JSONB - Full block content from Notion API

  // Parent page in the same database (if any)
  parent_notion_page_id: string | null; // UUID - Notion page ID of the parent page

  // Child relationships grouped by Atlas database type
  child_scope_ids: Json; // JSON array of UUID strings
  child_article_ids: Json; // JSON array of UUID strings
  child_section_and_primary_doc_ids: Json; // JSON array of UUID strings
  child_annotation_ids: Json; // JSON array of UUID strings
  child_tenet_ids: Json; // JSON array of UUID strings
  child_scenario_ids: Json; // JSON array of UUID strings
  child_scenario_variation_ids: Json; // JSON array of UUID strings
  child_active_data_ids: Json; // JSON array of UUID strings
  child_agent_scope_ids: Json; // JSON array of UUID strings
  child_needed_research_ids: Json; // JSON array of UUID strings

  // Additional fields for specific document types (Type Specification documents)
  extra_fields: Json; // JSONB - Additional fields stored as JSON key-value pairs

  // Ordering
  sort_order: number; // Position within parent (for ordering; 0-indexed)

  // Timestamps
  created_at: string; // When this database row was created
  updated_at: string; // When this database row was last updated
  // Temporal validity (UTC)
  date_valid_from?: string | null;
  date_valid_to?: string | null;
}
