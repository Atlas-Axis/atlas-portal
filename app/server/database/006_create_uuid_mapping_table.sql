-- Create the uuid_mapping table to map Notion page IDs to Atlas document UUIDs
CREATE TABLE IF NOT EXISTS uuid_mapping (
  notion_page_id UUID NOT NULL UNIQUE,
  atlas_document_uuid UUID NOT NULL UNIQUE
);

-- Enable Row Level Security
ALTER TABLE uuid_mapping ENABLE ROW LEVEL SECURITY;
