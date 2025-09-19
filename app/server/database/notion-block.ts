import { Json } from '@/app/server/services/supabase/database.types';

// Represents a Notion block in the database
export interface NotionBlock {
  // Primary keys and identifiers
  // id: string; // UUID - Internal primary ID
  notion_block_id: string; // UUID - Notion block ID
  parent_notion_block_id?: string | null; // UUID - Parent block ID (null for root blocks)
  root_notion_block_id: string; // UUID - The Notion page id this block belongs to, or the root/top-most block id of a subtree of blocks

  // Notion block metadata
  block_type: string; // Block type (paragraph, heading_1, etc.)
  has_children: boolean;
  archived: boolean;
  in_trash: boolean;
  last_edited_by_user_id?: string | null; // ID of the Notion user who last edited this block

  // Content fields
  plain_text_content?: string | null; // Extracted plain text for easy searching
  json_content: Json; // JSONB - Full block content from Notion API

  // Ordering
  sort_order: number; // Position within parent (for ordering; 0-indexed)

  // Atlas document fields
  canonical_document_title?: string | null; // Title of the Atlas document this block belongs to

  // Timestamps
  created_at: string; // When this database row was created
  updated_at: string; // When this database row was last updated

  // Versioning fields
  //   date_valid_from: string; // Used for versioning
  //   date_valid_to?: string | null; // Used for versioning. NULL means "current" version

  // Edit Page related fields
  edit_page_original_notion_block_id?: string | null; // ID of the original Notion block that this editable copy has been duplicated from
  edit_page_original_notion_page_id?: string | null; // ID of the original Notion page that this editable copy has been duplicated from
}
