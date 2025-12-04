-- Create the markdown_notion_sync_lock table to manage exclusive access for markdown-to-notion sync
-- This table uses a single-row pattern (id = 1) to ensure only one sync can run at a time

CREATE TABLE IF NOT EXISTS markdown_notion_sync_lock (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Ensures single row
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  locked_at TIMESTAMPTZ, -- When the lock was acquired
  trigger_run_id TEXT, -- Trigger.dev run ID for progress tracking
  stop_requested BOOLEAN NOT NULL DEFAULT FALSE, -- Flag for graceful stop
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the single row if it doesn't exist
INSERT INTO markdown_notion_sync_lock (id, is_locked, stop_requested)
VALUES (1, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- Trigger to automatically update updated_at column on row update
CREATE TRIGGER set_updated_at_markdown_notion_sync_lock
  BEFORE UPDATE ON markdown_notion_sync_lock
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE markdown_notion_sync_lock ENABLE ROW LEVEL SECURITY;
