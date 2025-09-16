-- Create the enum type for atlas_document_type
CREATE TYPE atlas_document_type_enum AS ENUM (
  'Scope',
  'Article',
  'Section',
  'Core',
  'Type Specification',
  'Active Data Controller',
  'Spell SP Controller',
  'Placeholder',
  'Category',
  'Action Tenet',
  'Active Data',
  'Annotation',
  'Scenario',
  'Scenario Variation'
);

-- Create the enum type for atlas_database_name_enum
CREATE TYPE atlas_database_name_enum AS ENUM (
  'Scopes',
  'Articles',
  'Sections & Primary Docs',
  'Annotations',
  'Tenets',
  'Scenarios',
  'Scenario Variations',
  'Active Data',
  'Agent Scope Database',
  'Needed Research',
  'Original Context Data'
);

-- Create the notion_database_pages table to store synchronized pages from Notion
CREATE TABLE IF NOT EXISTS notion_database_pages (
  notion_page_id UUID NOT NULL PRIMARY KEY, -- Notion page ID
  canonical_document_title TEXT, -- Title of the Atlas document this page belongs to, e.g. A.AGX.2.1.P1 - TODO: Is this format still correct? This may be a more recent example: A.2.2.1.1
  atlas_document_type atlas_document_type_enum NOT NULL,
  atlas_document_number TEXT NOT NULL DEFAULT '',
  atlas_database_name atlas_database_name_enum NOT NULL,
  has_children BOOLEAN NOT NULL DEFAULT FALSE, -- TODO: Remove
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  in_trash BOOLEAN NOT NULL DEFAULT FALSE,
  plain_text_content TEXT, -- Extracted plain text content
  json_content JSONB, -- Rich Text content from Notion API
  plain_text_name TEXT, -- Extracted plain text page title
  json_name JSONB, -- Rich Text page title from Notion API
  parent_notion_page_id UUID, -- Parent Notion page ID (if any)
  -- Child relationships grouped by Atlas database type. Each stores an array of UUID strings.
  child_scope_ids JSONB NOT NULL DEFAULT '[]', -- Children from Scopes database
  child_article_ids JSONB NOT NULL DEFAULT '[]', -- Children from Articles database
  child_section_and_primary_doc_ids JSONB NOT NULL DEFAULT '[]', -- Children from Sections & Primary Docs database
  child_annotation_ids JSONB NOT NULL DEFAULT '[]', -- Children from Annotations database
  child_tenet_ids JSONB NOT NULL DEFAULT '[]', -- Children from Tenets database
  child_scenario_ids JSONB NOT NULL DEFAULT '[]', -- Children from Scenarios database
  child_scenario_variation_ids JSONB NOT NULL DEFAULT '[]', -- Children from Scenario Variations database
  child_active_data_ids JSONB NOT NULL DEFAULT '[]', -- Children from Active Data database
  child_agent_scope_ids JSONB NOT NULL DEFAULT '[]', -- Children from Agent Scope Database
  child_needed_research_ids JSONB NOT NULL DEFAULT '[]', -- Children from Needed Research database
  sort_order DECIMAL(5,2) NOT NULL, -- Position within parent (for ordering; 0-indexed, allows fractions like 1.5)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When this database row was created
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When this database row was last updated
  last_edited_by_user_id TEXT -- ID of the Notion user who last edited this page

  -- date_valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Used for versioning
  -- date_valid_to TIMESTAMPTZ NULL, -- Used for versioning. NULL means "current" version
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notion_database_pages_notion_page_id ON notion_database_pages(notion_page_id); -- Index for Notion page ID
CREATE INDEX IF NOT EXISTS idx_notion_database_pages_atlas_document_type ON notion_database_pages(atlas_document_type); -- Index for atlas_document_type
-- CREATE INDEX IF NOT EXISTS idx_notion_database_pages_temporal ON notion_database_pages(date_valid_from, date_valid_to) WHERE date_valid_to IS NULL OR date_valid_to > NOW(); -- Index for temporal queries (valid pages at a specific time)

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


-- Enable Row Level Security
ALTER TABLE notion_database_pages ENABLE ROW LEVEL SECURITY;
