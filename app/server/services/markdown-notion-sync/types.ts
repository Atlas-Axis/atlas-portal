/**
 * Shared types for Markdown-to-Notion sync service
 */

// Sync phase type for progress tracking
export type SyncPhase =
  | 'initializing'
  | 'content'
  | 'additions'
  | 'mention_updates' // Phase 2.5: Update placeholder mentions with real Notion page IDs
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
  /** Atlas UUIDs that had no Notion page ID mapping (for mention post-processing) */
  unresolvedMentionUuids?: string[];
}

// Information about a page that needs mention post-processing
export interface PageWithUnresolvedMentions {
  /** The Notion page ID of the page that was created */
  notionPageId: string;
  /** The Atlas document UUID */
  atlasUuid: string;
  /** Atlas UUIDs referenced in mentions that had no mapping at creation time */
  unresolvedMentionUuids: string[];
}
