-- Create the notion_sync_status table to track synchronization progress for Notion pages
CREATE TABLE IF NOT EXISTS notion_sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Internal primary ID
  notion_page_id UUID NOT NULL UNIQUE, -- The Notion page or database ID being synchronized
  sync_status TEXT NOT NULL DEFAULT 'pending', -- Current sync status: pending, in_progress, completed, failed, cancelled
  last_sync_started_at TIMESTAMPTZ, -- When the most recent sync attempt started
  last_sync_completed_at TIMESTAMPTZ, -- When the most recent successful sync completed
  sync_error_message TEXT, -- Error message from the last failed sync attempt
  blocks_synced_count INTEGER DEFAULT NULL, -- Number of blocks successfully synced
  is_sync_locked BOOLEAN DEFAULT FALSE, -- Prevents concurrent syncs of the same page
  sync_lock_acquired_at TIMESTAMPTZ, -- When the sync lock was acquired
  sync_lock_expires_at TIMESTAMPTZ, -- When the sync lock expires (for cleanup of stale locks)
  created_at TIMESTAMPTZ DEFAULT NOW(), -- When this record was created
  updated_at TIMESTAMPTZ DEFAULT NOW() -- When this record was last updated
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notion_sync_status_page_id ON notion_sync_status(notion_page_id);
CREATE INDEX IF NOT EXISTS idx_notion_sync_status_sync_status ON notion_sync_status(sync_status);
CREATE INDEX IF NOT EXISTS idx_notion_sync_status_sync_locked ON notion_sync_status(is_sync_locked, sync_lock_expires_at) WHERE is_sync_locked = TRUE;

-- Trigger to automatically update updated_at column on row update
CREATE TRIGGER set_updated_at_sync_status
  BEFORE UPDATE ON notion_sync_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Ensure valid sync status values
ALTER TABLE notion_sync_status ADD CONSTRAINT check_valid_sync_status
CHECK (sync_status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled'));

-- Ensure sync lock expiration is in the future when lock is active
ALTER TABLE notion_sync_status ADD CONSTRAINT check_sync_lock_expiration
CHECK (
  (is_sync_locked = FALSE)
  OR
  (is_sync_locked = TRUE AND sync_lock_expires_at > NOW())
);

-- Enable Row Level Security
ALTER TABLE notion_sync_status ENABLE ROW LEVEL SECURITY;
