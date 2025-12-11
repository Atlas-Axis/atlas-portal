/**
 * Shared types for Markdown-to-Notion sync service
 */
import type { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';

// Sync phase type for progress tracking
export type SyncPhase =
  | 'initializing'
  | 'content'
  | 'additions'
  | 'mention_updates' // Phase 2.5: Update placeholder mentions with real Notion page IDs
  | 'deletions'
  | 'parent_changes'
  | 'notion_import' // Phase 6: Notion-to-Supabase import for affected databases
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

/**
 * Field-level filters for controlling which document fields are included
 * in the diff display and synced to Notion.
 * Only affects the "Changed" category - additions/deletions/parent changes are unaffected.
 */
export interface FieldFilters {
  name: boolean;
  docNo: boolean;
  type: boolean;
  content: boolean;
  extraFields: boolean;
}

/**
 * Default field filters with all fields enabled.
 */
export const DEFAULT_FIELD_FILTERS: FieldFilters = {
  name: true,
  docNo: true,
  type: true,
  content: true,
  extraFields: true,
};

// Sync filters for controlling which change types are processed
export interface SyncFilters {
  added: boolean;
  deleted: boolean;
  contentChanges: boolean;
  parentChanges: boolean;
  /**
   * Use dynamically calculated doc_no/name (generatedDocID/generatedDocName)
   * instead of stored values from Supabase (atlas_document_number/plain_text_name).
   *
   * Default: true (use dynamic values until production migration is complete)
   *
   * @todo CLEANUP: After migration, change default to false and remove option (Phase 8)
   */
  useDynamicValues?: boolean;
  /**
   * Field-level filters for controlling which document fields are included
   * in the diff display and synced to Notion.
   * Only affects the "Changed" category.
   */
  fieldFilters: FieldFilters;
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
  /** Databases that were affected by the sync (for chained Notion-to-Supabase import) */
  affectedDatabases?: AtlasDatabaseName[];
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
