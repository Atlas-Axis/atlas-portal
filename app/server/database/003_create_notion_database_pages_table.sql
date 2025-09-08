-- Create the notion_database_pages table to store synchronized pages from Notion
CREATE TABLE IF NOT EXISTS notion_database_pages (
  -- id UUID PRIMARY KEY, -- Internal primary ID
  notion_page_id UUID NOT NULL PRIMARY KEY, -- Notion page ID
  parent_notion_page_id UUID, -- Parent page ID (null for root pages)
  root_notion_database_id UUID NOT NULL, -- The Notion page id this page belongs to, or the root/top-most page id of a subtree of pages
  page_type TEXT NOT NULL, -- Page type (paragraph, heading_1, etc.)
  has_children BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  in_trash BOOLEAN NOT NULL DEFAULT FALSE,
  plain_text_content TEXT, -- Extracted plain text content
  json_content JSONB, -- Rich Text content from Notion API
  plain_text_name TEXT, -- Extracted plain text page title
  json_name JSONB, -- Rich Text page title from Notion API
  sort_order INTEGER NOT NULL, -- Position within parent (for ordering; 0-indexed)
  canonical_document_title TEXT, -- Title of the Atlas document this page belongs to, e.g. A.AGX.2.1.P1 - TODO: Is this format still correct? This may be a more recent example: A.2.2.1.1
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When this database row was created
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When this database row was last updated
  last_edited_by_user_id TEXT, -- ID of the Notion user who last edited this page

  -- date_valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Used for versioning
  -- date_valid_to TIMESTAMPTZ NULL, -- Used for versioning. NULL means "current" version

  -- Edit Page related fields
  belongs_to_edit_page BOOLEAN NOT NULL DEFAULT TRUE, -- Indicates if the page belongs to an Edit Page, which is a temporary Notion page, duplicated from the original, for proposed edits
  edit_page_original_notion_page_id UUID, -- ID of the original Notion page that this editable copy has been duplicated from; Used for efficient querying without needing a mapping table
  edit_page_original_notion_database_id UUID, -- ID of the original root Notion database that this editable copy has been duplicated from; Used for efficient querying without needing a mapping table

  -- Cascade-delete child pages when the parent page is deleted
  CONSTRAINT fk_parent_page FOREIGN KEY (parent_notion_page_id) REFERENCES notion_database_pages(notion_page_id) ON DELETE CASCADE  
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notion_database_pages_notion_page_id ON notion_database_pages(notion_page_id); -- Index for Notion page ID
CREATE INDEX IF NOT EXISTS idx_notion_database_pages_parent_notion_page_id ON notion_database_pages(parent_notion_page_id); -- Index for parent page ID
CREATE INDEX IF NOT EXISTS idx_notion_database_pages_root_notion_page_id ON notion_database_pages(root_notion_database_id);
CREATE INDEX IF NOT EXISTS idx_notion_database_pages_page_type ON notion_database_pages(page_type); -- Index for page type
CREATE INDEX IF NOT EXISTS idx_notion_database_pages_sort_order ON notion_database_pages(parent_notion_page_id, sort_order); -- Index for sort order within parent
-- CREATE INDEX IF NOT EXISTS idx_notion_database_pages_temporal ON notion_database_pages(date_valid_from, date_valid_to) WHERE date_valid_to IS NULL OR date_valid_to > NOW(); -- Index for temporal queries (valid pages at a specific time)
CREATE INDEX IF NOT EXISTS idx_notion_database_pages_belongs_to_edit_page ON notion_database_pages(belongs_to_edit_page);
-- CREATE INDEX IF NOT EXISTS idx_notion_database_pages_page_edit_temporal ON notion_database_pages(root_notion_database_id, belongs_to_edit_page, date_valid_from, date_valid_to);

-- Index for document-level queries
CREATE INDEX IF NOT EXISTS idx_notion_database_pages_canonical_title 
ON notion_database_pages(canonical_document_title) 
WHERE canonical_document_title IS NOT NULL;

-- Ensure only one active version of a page exists at a time
-- CREATE UNIQUE INDEX IF NOT EXISTS uniq_notion_page_id_current
-- ON notion_database_pages(notion_page_id)
-- WHERE date_valid_to IS NULL;

-- Function to update the updated_at column on row update
CREATE OR REPLACE FUNCTION update_updated_at_column_pages()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at column on row update
CREATE TRIGGER set_updated_at_pages
  BEFORE UPDATE ON notion_database_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column_pages();

-- Ensure valid temporal range (valid_to must be greater than valid_from)
-- ALTER TABLE notion_database_pages ADD CONSTRAINT check_valid_temporal_range
-- CHECK (date_valid_to IS NULL OR date_valid_to > date_valid_from);

-- Ensure sort_order is non-negative
ALTER TABLE notion_database_pages ADD CONSTRAINT check_sort_order_positive
CHECK (sort_order >= 0);

-- Ensure edit page fields are consistent with belongs_to_edit_page flag
ALTER TABLE notion_database_pages ADD CONSTRAINT check_edit_page_fields_consistency
CHECK (
  (belongs_to_edit_page = true AND edit_page_original_notion_database_id IS NOT NULL)
  OR
  (belongs_to_edit_page = false AND edit_page_original_notion_page_id IS NULL AND edit_page_original_notion_database_id IS NULL)
);

-- Enable Row Level Security
ALTER TABLE notion_database_pages ENABLE ROW LEVEL SECURITY;
