-- Create the enum type for atlas_document_type
CREATE TYPE atlas_document_type_enum AS ENUM (
  'Scope',
  'Article',
  'Section',
  'Core',
  'Type Specification',
  'Active Data Controller',
  'Spell SP Controller', -- Deprecated - TODO: remove
  'Placeholder', -- TODO: remove
  'Category', -- TODO: remove
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
  'Original Context Data', -- TODO: Remove
  'Type Specification'
);

-- Natural sorting computed column for atlas_document_number
-- Converts "A.1.11" to "A.000001.000011" for proper natural sorting
-- Function to convert atlas_document_number to a sortable format
CREATE OR REPLACE FUNCTION atlas_document_number_to_sortable(doc_number TEXT)
RETURNS TEXT AS $$
DECLARE
  parts TEXT[];
  result TEXT := '';
  part TEXT;
  padded_part TEXT;
BEGIN
  IF doc_number IS NULL OR doc_number = '' THEN
    RETURN '';
  END IF;
  
  -- Split by dots and process each part separately
  -- This approach avoids regex backreference issues and is more portable
  parts := string_to_array(doc_number, '.');
  
  FOR i IN 1..array_length(parts, 1) LOOP
    part := parts[i];
    
    -- Check if this part contains only digits
    IF part ~ '^\d+$' THEN
      -- Pad numeric parts to 6 digits
      padded_part := lpad(part, 6, '0');
    ELSE
      -- Keep non-numeric parts as-is
      padded_part := part;
    END IF;
    
    -- Build result string
    IF i = 1 THEN
      result := padded_part;
    ELSE
      result := result || '.' || padded_part;
    END IF;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- Create the notion_database_pages table to store synchronized pages from Notion
CREATE TABLE IF NOT EXISTS notion_database_pages (
  notion_page_id UUID NOT NULL PRIMARY KEY, -- Notion page ID
  -- TODO: Delete canonical_document_title - in Atlas Explorer, there are only two fields: Document No and Document Name
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
  parent_notion_page_id UUID, -- Parent Notion page ID (if any) -- This field is deprecated, don't use it
  -- Child relationships grouped by Atlas database type. Each stores an array of UUID strings.
  child_scope_ids JSONB NOT NULL DEFAULT '[]', -- Children from Scopes database
  child_article_ids JSONB NOT NULL DEFAULT '[]', -- Children from Articles database
  child_section_and_primary_doc_ids JSONB NOT NULL DEFAULT '[]', -- Descendants from Sections & Primary Docs database (not just direct children!)
  child_annotation_ids JSONB NOT NULL DEFAULT '[]', -- Children from Annotations database
  child_tenet_ids JSONB NOT NULL DEFAULT '[]', -- Children from Tenets database
  child_scenario_ids JSONB NOT NULL DEFAULT '[]', -- Children from Scenarios database
  child_scenario_variation_ids JSONB NOT NULL DEFAULT '[]', -- Children from Scenario Variations database
  child_active_data_ids JSONB NOT NULL DEFAULT '[]', -- Children from Active Data database
  child_agent_scope_ids JSONB NOT NULL DEFAULT '[]', -- Descendants from Agent Scope Database (not just direct children!)
  child_needed_research_ids JSONB NOT NULL DEFAULT '[]', -- Children from Needed Research database
  -- child_type_specification_ids JSONB NOT NULL DEFAULT '[]', -- Children from Type Specifications database -- TODO: Add
  extra_fields JSONB NOT NULL DEFAULT '{}', -- Additional fields stored as JSON key-value pairs
  sort_order DECIMAL(5,2), -- Position within parent (for ordering; 0-indexed, allows fractions like 1.5)
  atlas_document_number_sortable TEXT GENERATED ALWAYS AS (atlas_document_number_to_sortable(atlas_document_number)) STORED, -- Computed column for natural sorting (e.g. A.1.11 -> A.000001.000011) to fix lexicographic sorting issues
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When this database row was created
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- When this database row was last updated
  last_edited_by_user_id TEXT, -- ID of the Notion user who last edited this page

  date_valid_from TIMESTAMPTZ NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'), -- Used for versioning (temporal table)
  date_valid_to TIMESTAMPTZ NULL -- Used for versioning. NULL means "current" version (temporal table)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notion_database_pages_notion_page_id ON notion_database_pages(notion_page_id); -- Index for Notion page ID
CREATE INDEX IF NOT EXISTS idx_notion_database_pages_atlas_document_type ON notion_database_pages(atlas_document_type); -- Index for atlas_document_type
-- CREATE INDEX IF NOT EXISTS idx_notion_database_pages_temporal ON notion_database_pages(date_valid_from, date_valid_to) WHERE date_valid_to IS NULL OR date_valid_to > NOW(); -- Index for temporal queries (valid pages at a specific time)

-- Temporal indexes to speed history/current lookups
CREATE INDEX IF NOT EXISTS idx_ndp_date_valid_from
ON notion_database_pages(date_valid_from);

CREATE INDEX IF NOT EXISTS idx_ndp_date_valid_to
ON notion_database_pages(date_valid_to);

-- Index for document-level queries
CREATE INDEX IF NOT EXISTS idx_notion_database_pages_canonical_title 
ON notion_database_pages(canonical_document_title) 
WHERE canonical_document_title IS NOT NULL;

-- Ensure only one active (current) version of a page exists at a time
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notion_page_id_current
ON notion_database_pages(notion_page_id)
WHERE date_valid_to IS NULL;

-- Create optimized index for natural sorting
CREATE INDEX IF NOT EXISTS idx_atlas_pages_natural_sort 
ON notion_database_pages (
  atlas_database_name, 
  atlas_document_number_sortable, 
  sort_order, 
  canonical_document_title
)
WHERE date_valid_to IS NULL 
  AND archived = false 
  AND in_trash = false;

-- Ensure valid temporal range (valid_to must be greater than valid_from)
ALTER TABLE notion_database_pages ADD CONSTRAINT check_valid_temporal_range
CHECK (date_valid_to IS NULL OR date_valid_to > date_valid_from);

-- Ensure sort_order is non-negative
ALTER TABLE notion_database_pages ADD CONSTRAINT check_sort_order_positive
CHECK (sort_order >= 0);


-- Enable Row Level Security
ALTER TABLE notion_database_pages ENABLE ROW LEVEL SECURITY;

-- Optimized indexes for current-state reads (by atlas_database_name)
CREATE INDEX IF NOT EXISTS idx_ndp_current_by_database_name
ON notion_database_pages(atlas_database_name)
WHERE date_valid_to IS NULL;

-- Optional: speed up version scans per page
CREATE INDEX IF NOT EXISTS idx_ndp_versions_by_page_and_from
ON notion_database_pages(notion_page_id, date_valid_from DESC);

-- =========================
-- RPC: Versioned Upsert
-- =========================
-- Accepts an array of JSON rows matching notion_database_pages columns (except temporal and audit columns)
-- 1) Invalidates current versions for provided notion_page_id values by setting date_valid_to to now() UTC
-- 2) Inserts new versions with date_valid_from = now() UTC and date_valid_to = NULL
CREATE OR REPLACE FUNCTION versioned_upsert_notion_database_pages(p_rows JSONB)
RETURNS VOID AS $$
DECLARE
  v_now TIMESTAMPTZ := (NOW() AT TIME ZONE 'utc');
BEGIN
  IF p_rows IS NULL OR jsonb_array_length(p_rows) = 0 THEN
    RETURN;
  END IF;

  -- Invalidate existing current rows for incoming notion_page_id set
  WITH incoming_ids AS (
    SELECT DISTINCT (r->>'notion_page_id')::UUID AS notion_page_id
    FROM jsonb_array_elements(p_rows) AS r
    WHERE (r ? 'notion_page_id')
  )
  UPDATE notion_database_pages ndp
  SET date_valid_to = v_now
  FROM incoming_ids ids
  WHERE ndp.notion_page_id = ids.notion_page_id
    AND ndp.date_valid_to IS NULL;

  -- Insert new versions from payload
  INSERT INTO notion_database_pages (
    notion_page_id,
    canonical_document_title,
    atlas_document_type,
    atlas_document_number,
    atlas_database_name,
    has_children,
    archived,
    in_trash,
    plain_text_content,
    json_content,
    plain_text_name,
    json_name,
    parent_notion_page_id,
    child_scope_ids,
    child_article_ids,
    child_section_and_primary_doc_ids,
    child_annotation_ids,
    child_tenet_ids,
    child_scenario_ids,
    child_scenario_variation_ids,
    child_active_data_ids,
    child_agent_scope_ids,
    child_needed_research_ids,
    extra_fields,
    sort_order,
    last_edited_by_user_id,
    date_valid_from,
    date_valid_to
  )
  SELECT
    notion_page_id,
    canonical_document_title,
    atlas_document_type,
    atlas_document_number,
    atlas_database_name,
    has_children,
    COALESCE(archived, FALSE),
    COALESCE(in_trash, FALSE),
    plain_text_content,
    json_content,
    plain_text_name,
    json_name,
    parent_notion_page_id,
    COALESCE(child_scope_ids, '[]'::JSONB),
    COALESCE(child_article_ids, '[]'::JSONB),
    COALESCE(child_section_and_primary_doc_ids, '[]'::JSONB),
    COALESCE(child_annotation_ids, '[]'::JSONB),
    COALESCE(child_tenet_ids, '[]'::JSONB),
    COALESCE(child_scenario_ids, '[]'::JSONB),
    COALESCE(child_scenario_variation_ids, '[]'::JSONB),
    COALESCE(child_active_data_ids, '[]'::JSONB),
    COALESCE(child_agent_scope_ids, '[]'::JSONB),
    COALESCE(child_needed_research_ids, '[]'::JSONB),
    COALESCE(extra_fields, '{}'::JSONB),
    sort_order,
    last_edited_by_user_id,
    v_now,
    NULL
  FROM jsonb_to_recordset(p_rows) AS x (
    notion_page_id UUID,
    canonical_document_title TEXT,
    atlas_document_type atlas_document_type_enum,
    atlas_document_number TEXT,
    atlas_database_name atlas_database_name_enum,
    has_children BOOLEAN,
    archived BOOLEAN,
    in_trash BOOLEAN,
    plain_text_content TEXT,
    json_content JSONB,
    plain_text_name TEXT,
    json_name JSONB,
    parent_notion_page_id UUID,
    child_scope_ids JSONB,
    child_article_ids JSONB,
    child_section_and_primary_doc_ids JSONB,
    child_annotation_ids JSONB,
    child_tenet_ids JSONB,
    child_scenario_ids JSONB,
    child_scenario_variation_ids JSONB,
    child_active_data_ids JSONB,
    child_agent_scope_ids JSONB,
    child_needed_research_ids JSONB,
    extra_fields JSONB,
    sort_order DECIMAL(5,2),
    last_edited_by_user_id TEXT
  );
END;
$$ LANGUAGE plpgsql;

-- =========================
-- RPC: Versioned Delete (soft-delete)
-- =========================
-- Sets date_valid_to to now() UTC for current rows matching provided IDs
CREATE OR REPLACE FUNCTION versioned_delete_notion_database_pages(p_ids UUID[])
RETURNS INTEGER AS $$
DECLARE
  v_now TIMESTAMPTZ := (NOW() AT TIME ZONE 'utc');
  v_rows INTEGER;
BEGIN
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL OR array_length(p_ids, 1) = 0 THEN
    RETURN 0;
  END IF;

  UPDATE notion_database_pages
  SET date_valid_to = v_now
  WHERE notion_page_id = ANY(p_ids)
    AND date_valid_to IS NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$ LANGUAGE plpgsql;

-- =========================
-- View: Rows valid currently
-- Note: This view is not used in the codebase
-- Note: RLS is automatically inherited from the underlying notion_database_pages table
-- =========================
CREATE OR REPLACE VIEW notion_database_pages_current
WITH (security_invoker = on)
AS
SELECT * FROM notion_database_pages WHERE date_valid_to IS NULL AND in_trash = FALSE AND archived = FALSE;

