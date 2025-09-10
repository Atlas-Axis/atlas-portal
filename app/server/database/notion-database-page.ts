import { Database, Json } from '@/app/server/services/supabase/database.types';

export type Relationships = Record<string, string[]>;

// Represents a Notion page in the database
export interface NotionDatabasePage {
  // Primary keys and identifiers
  notion_page_id: string; // UUID - Notion page ID
  parent_notion_page_id?: string | null; // UUID - Parent page ID (null for root pages)

  // Atlas document fields
  canonical_document_title?: string | null; // Title of the Atlas document this page belongs to
  atlas_document_type: Database['public']['Enums']['atlas_document_type_enum'];
  atlas_document_number: string; // Document number of the Atlas document this page belongs to
  atlas_database_name: Database['public']['Enums']['atlas_database_name_enum'];

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

  // Relationships
  relationships: Json; // JSONB - Stores relationships to other pages/blocks

  // Ordering
  sort_order: number; // Position within parent (for ordering; 0-indexed)

  // Timestamps
  created_at: string; // When this database row was created
  updated_at: string; // When this database row was last updated
}
