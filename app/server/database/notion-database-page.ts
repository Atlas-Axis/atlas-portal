import { Json } from '@/app/server/services/supabase/database.types';

// Represents a Notion page in the database
export interface NotionDatabasePage {
  // Primary keys and identifiers
  notion_page_id: string; // UUID - Notion page ID
  parent_notion_page_id?: string | null; // UUID - Parent page ID (null for root pages)
  root_notion_database_id: string; // UUID - The Notion database ID this page belongs to

  // Notion page metadata
  page_type: string; // Page type
  has_children: boolean;
  archived: boolean;
  in_trash: boolean;
  last_edited_by_user_id?: string | null; // ID of the Notion user who last edited this page

  // Content fields
  plain_text_name?: string | null; // Extracted plain text page title
  json_name: Json; // JSONB - Full block content from Notion API
  plain_text_content?: string | null; // Extracted plain text for easy searching
  json_content: Json; // JSONB - Full block content from Notion API

  // Ordering
  sort_order: number; // Position within parent (for ordering; 0-indexed)

  // Atlas document fields
  canonical_document_title?: string | null; // Title of the Atlas document this page belongs to

  // Timestamps
  created_at: string; // When this database row was created
  updated_at: string; // When this database row was last updated

  // Edit Page related fields
  belongs_to_edit_page: boolean; // Indicates if the page belongs to an Edit Page
  edit_page_original_notion_page_id?: string | null; // ID of the original Notion page that this editable copy has been duplicated from
  edit_page_original_root_notion_page_id?: string | null; // ID of the original root Notion page that this editable copy has been duplicated from
}
