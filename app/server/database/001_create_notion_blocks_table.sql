-- Current limitation: Edit Pages can only be created from Notion pages, not subtrees

-- Create the notion_blocks table to store synchronized blocks from Notion
CREATE TABLE IF NOT EXISTS notion_blocks (
  id UUID PRIMARY KEY, -- Internal primary ID
  notion_block_id UUID NOT NULL, -- Notion block ID
  parent_notion_block_id UUID, -- Parent block ID (null for root blocks)
  notion_page_id UUID NOT NULL, -- The Notion page this block belongs to
  block_type TEXT NOT NULL, -- Block type (paragraph, heading_1, etc.)
  has_children BOOLEAN DEFAULT FALSE,
  plain_text_content TEXT, -- Extracted plain text for easy searching
  rich_text_content JSONB, -- Full block content from Notion API
  sort_order INTEGER NOT NULL, -- Position within parent (for ordering; 0-indexed)
  canonical_document_title TEXT, -- Title of the root document/page this block belongs to, e.g. A.AGX.2.1.P1 - TODO: Is this format still correct?
  created_at TIMESTAMPTZ DEFAULT NOW(), -- When this database row was created
  updated_at TIMESTAMPTZ DEFAULT NOW(), -- When this database row was last updated
  last_edited_by_user_id TEXT, -- ID of the Notion user who last edited this block
  date_valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Used for versioning
  date_valid_to TIMESTAMPTZ NULL, -- Used for versioning. NULL means "current" version
  -- Edit Page related fields
  belongs_to_edit_page BOOLEAN DEFAULT TRUE, -- Indicates if the block belongs to an Edit Page, which is a temporary Notion page, duplicated from the original, for proposed edits
  edit_page_original_notion_block_id UUID, -- ID of the original Notion block that this editable copy has been duplicated from; Used for efficient querying without needing a mapping table
  edit_page_original_notion_page_id UUID, -- ID of the original Notion page that this editable copy has been duplicated from; Used for efficient querying without needing a mapping table

  -- Cascade-delete child blocks when the parent block is deleted
  CONSTRAINT fk_parent_block FOREIGN KEY (parent_notion_block_id) REFERENCES notion_blocks(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notion_blocks_notion_block_id ON notion_blocks(notion_block_id); -- Index for Notion block ID
CREATE INDEX IF NOT EXISTS idx_notion_blocks_parent_notion_block_id ON notion_blocks(parent_notion_block_id); -- Index for parent block ID
CREATE INDEX IF NOT EXISTS idx_notion_blocks_notion_page_id ON notion_blocks(notion_page_id);
CREATE INDEX IF NOT EXISTS idx_notion_blocks_block_type ON notion_blocks(block_type); -- Index for block type
CREATE INDEX IF NOT EXISTS idx_notion_blocks_sort_order ON notion_blocks(parent_notion_block_id, sort_order); -- Index for sort order within parent
CREATE INDEX IF NOT EXISTS idx_notion_blocks_temporal ON notion_blocks(date_valid_from, date_valid_to) WHERE date_valid_to IS NULL OR date_valid_to > NOW(); -- Index for temporal queries (valid blocks at a specific time)
CREATE INDEX IF NOT EXISTS idx_notion_blocks_belongs_to_edit_page ON notion_blocks(belongs_to_edit_page);
CREATE INDEX IF NOT EXISTS idx_notion_blocks_page_edit_temporal ON notion_blocks(notion_page_id, belongs_to_edit_page, date_valid_from, date_valid_to);

-- Index for document-level queries
CREATE INDEX IF NOT EXISTS idx_notion_blocks_canonical_title 
ON notion_blocks(canonical_document_title) 
WHERE canonical_document_title IS NOT NULL;

-- Ensure a block is unique within a page by notion_block_id when date_valid_to IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notion_block_id_current
ON notion_blocks(notion_block_id)
WHERE date_valid_to IS NULL;

-- Function to update the updated_at column on row update
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at column on row update
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON notion_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Ensure valid temporal range (valid_to must be greater than valid_from)
ALTER TABLE notion_blocks ADD CONSTRAINT check_valid_temporal_range
CHECK (date_valid_to IS NULL OR date_valid_to > date_valid_from);

-- Ensure sort_order is non-negative
ALTER TABLE notion_blocks ADD CONSTRAINT check_sort_order_positive
CHECK (sort_order >= 0);

-- Ensure edit page fields are consistent with belongs_to_edit_page flag
ALTER TABLE notion_blocks ADD CONSTRAINT check_edit_page_fields_consistency
CHECK (
  (belongs_to_edit_page = true AND edit_page_original_notion_block_id IS NOT NULL AND edit_page_original_notion_page_id IS NOT NULL)
  OR
  (belongs_to_edit_page = false AND edit_page_original_notion_block_id IS NULL AND edit_page_original_notion_page_id IS NULL)
);
