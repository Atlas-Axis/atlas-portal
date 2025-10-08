-- Create the import_logs table to track Notion to Supabase import operations
CREATE TABLE IF NOT EXISTS import_logs (
  finished_at TIMESTAMPTZ NOT NULL,
  success BOOLEAN NOT NULL,
  has_changes BOOLEAN NOT NULL,
  duration_minutes DECIMAL(5,2) NOT NULL,
  changed_notion_page_ids JSONB NOT NULL DEFAULT '[]',
  
  -- Import type and error tracking
  import_type TEXT NOT NULL, -- 'full_sync', 'partial'
  error_message TEXT,
  
  -- Detailed change counts
  new_pages_count INTEGER NOT NULL DEFAULT 0,
  deleted_pages_count INTEGER NOT NULL DEFAULT 0,
  changed_properties_count INTEGER NOT NULL DEFAULT 0,
  changed_relationships_count INTEGER NOT NULL DEFAULT 0,

  -- Internal fields
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_dev_run_id TEXT,
  started_at TIMESTAMPTZ NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_import_logs_finished_at ON import_logs(finished_at);
CREATE INDEX IF NOT EXISTS idx_import_logs_success ON import_logs(success);
CREATE INDEX IF NOT EXISTS idx_import_logs_has_changes ON import_logs(has_changes);

-- Enable Row Level Security
ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

-- Add constraints
ALTER TABLE import_logs ADD CONSTRAINT check_import_type_valid
CHECK (import_type IN ('full_sync', 'partial'));

ALTER TABLE import_logs ADD CONSTRAINT check_duration_positive
CHECK (duration_minutes >= 0);

ALTER TABLE import_logs ADD CONSTRAINT check_finished_after_started
CHECK (finished_at >= started_at);

ALTER TABLE import_logs ADD CONSTRAINT check_counts_non_negative
CHECK (
  new_pages_count >= 0 AND
  deleted_pages_count >= 0 AND
  changed_properties_count >= 0 AND
  changed_relationships_count >= 0
);
