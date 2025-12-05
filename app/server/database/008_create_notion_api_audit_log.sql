-- Create audit log table for tracking all Notion API operations during sync
-- This table stores complete request/response payloads for accountability and debugging

CREATE TABLE IF NOT EXISTS notion_api_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL CHECK (operation_type IN ('create', 'update', 'delete')),
  notion_page_id UUID NOT NULL,
  atlas_document_uuid UUID,
  database_name TEXT NOT NULL,
  request_payload JSONB NOT NULL,
  response_payload JSONB,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_batch_id UUID -- Group operations from same sync
);

-- Create index for querying by batch
CREATE INDEX IF NOT EXISTS idx_notion_api_audit_log_sync_batch_id 
  ON notion_api_audit_log(sync_batch_id);

-- Create index for querying by page
CREATE INDEX IF NOT EXISTS idx_notion_api_audit_log_notion_page_id 
  ON notion_api_audit_log(notion_page_id);

-- Create index for querying by operation type
CREATE INDEX IF NOT EXISTS idx_notion_api_audit_log_operation_type 
  ON notion_api_audit_log(operation_type);

-- Create index for querying by timestamp
CREATE INDEX IF NOT EXISTS idx_notion_api_audit_log_created_at 
  ON notion_api_audit_log(created_at DESC);

-- Enable Row Level Security
ALTER TABLE notion_api_audit_log ENABLE ROW LEVEL SECURITY;

-- Add comment
COMMENT ON TABLE notion_api_audit_log IS 'Audit log for all Notion API operations during Markdown→Notion sync. Stores complete request/response payloads for debugging and compliance.';

