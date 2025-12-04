/**
 * Shared types for Markdown-to-Notion sync service
 */

// Sync phase type for progress tracking
export type SyncPhase =
  | 'initializing'
  | 'content'
  | 'additions'
  | 'deletions'
  | 'parent_changes'
  | 'completed'
  | 'stopped';

// Metadata structure for real-time progress tracking
export interface SyncMetadata {
  phase: SyncPhase;
  completed: number;
  total: number;
  currentDoc: string | null;
  succeeded: number;
  failed: number;
  skipped: number;
}

// Sync filters for controlling which change types are processed
export interface SyncFilters {
  added: boolean;
  deleted: boolean;
  contentChanges: boolean;
  parentChanges: boolean;
}

// Task payload
export interface MarkdownNotionSyncPayload {
  filters: SyncFilters;
}

// Task result
export interface MarkdownNotionSyncResult {
  succeeded: number;
  failed: number;
  skipped: number;
  stoppedEarly: boolean;
  error?: string;
}

// Result of individual sync operations (create, update, delete)
export interface SyncActionResult {
  success: boolean;
  pageId?: string;
  error?: string;
  reason?: string;
}
