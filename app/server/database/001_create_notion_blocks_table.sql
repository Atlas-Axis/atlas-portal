-- Create the notion_blocks table to store synchronized blocks from Notion
CREATE TABLE IF NOT EXISTS notion_blocks (
  -- id UUID PRIMARY KEY, -- Internal primary ID
  notion_block_id UUID NOT NULL PRIMARY KEY, -- Notion block ID
  parent_notion_block_id UUID, -- Parent block ID (null for root blocks)
  root_notion_toggle_block_id UUID NOT NULL, -- The ID of the top level block of this `notion_blocks` subtree. This is a Notion toggle block inside an Edit Page (there may be more than toggle blocks inside an Edit Page, this represents one of them)
  block_type TEXT NOT NULL, -- Block type (paragraph, heading_1, etc.)
  has_children BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  in_trash BOOLEAN NOT NULL DEFAULT FALSE,
  plain_text_content TEXT, -- Extracted plain text
  json_content JSONB, -- Full block content from Notion API
  sort_order INTEGER NOT NULL, -- Position within parent (for ordering; 0-indexed)
  canonical_document_title TEXT, -- Title of the Atlas document this block belongs to, e.g. A.AGX.2.1.P1 - TODO: Is this format still correct? This may be a more recent example: A.2.2.1.1
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When this database row was created
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When this database row was last updated
  last_edited_by_user_id TEXT, -- ID of the Notion user who last edited this block
  -- date_valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Used for versioning
  -- date_valid_to TIMESTAMPTZ NULL, -- Used for versioning. NULL means "current" version

  -- Edit Page related fields
  mapped_notion_page_id UUID, -- ID of the original Notion page that this editable text block has been duplicated from

  -- Cascade-delete child blocks when the parent block is deleted
  CONSTRAINT fk_parent_block FOREIGN KEY (parent_notion_block_id) REFERENCES notion_blocks(notion_block_id) ON DELETE CASCADE  
);

-- TODO: When the user presses the "Sync Changes" button on the UI, we need to first update `parent_notion_block_id` fields, and only then delete database rows for blocks that have been removed in Notion. This ensures we don't violate foreign key constraints during the sync process and don't trigger a cascade delete of child blocks that are still present but with updated parent IDs.

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notion_blocks_notion_block_id ON notion_blocks(notion_block_id); -- Index for Notion block ID
CREATE INDEX IF NOT EXISTS idx_notion_blocks_parent_notion_block_id ON notion_blocks(parent_notion_block_id); -- Index for parent block ID
CREATE INDEX IF NOT EXISTS idx_notion_blocks_notion_page_id ON notion_blocks(root_notion_toggle_block_id);
CREATE INDEX IF NOT EXISTS idx_notion_blocks_block_type ON notion_blocks(block_type); -- Index for block type
CREATE INDEX IF NOT EXISTS idx_notion_blocks_sort_order ON notion_blocks(parent_notion_block_id, sort_order); -- Index for sort order within parent
-- CREATE INDEX IF NOT EXISTS idx_notion_blocks_temporal ON notion_blocks(date_valid_from, date_valid_to) WHERE date_valid_to IS NULL OR date_valid_to > NOW(); -- Index for temporal queries (valid blocks at a specific time)

-- Index for document-level queries
CREATE INDEX IF NOT EXISTS idx_notion_blocks_canonical_title 
ON notion_blocks(canonical_document_title) 
WHERE canonical_document_title IS NOT NULL;

-- Ensure only one active version of a block exists at a time
-- CREATE UNIQUE INDEX IF NOT EXISTS uniq_notion_block_id_current
-- ON notion_blocks(notion_block_id)
-- WHERE date_valid_to IS NULL;

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
-- ALTER TABLE notion_blocks ADD CONSTRAINT check_valid_temporal_range
-- CHECK (date_valid_to IS NULL OR date_valid_to > date_valid_from);

-- Ensure sort_order is non-negative
ALTER TABLE notion_blocks ADD CONSTRAINT check_sort_order_positive
CHECK (sort_order >= 0);

-- Enable Row Level Security
ALTER TABLE notion_blocks ENABLE ROW LEVEL SECURITY;
