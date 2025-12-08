/**
 * Public API for Markdown-to-Notion sync service
 */

// Export all types
export type {
  SyncPhase,
  SyncMetadata,
  SyncFilters,
  FieldFilters,
  MarkdownNotionSyncPayload,
  MarkdownNotionSyncResult,
  SyncActionResult,
  PageWithUnresolvedMentions,
} from './types';

// Export constants
export { DEFAULT_FIELD_FILTERS } from './types';

// Export helper functions
export { validatePageExists, pageHasChildren, sortAdditionsByDepthFirst, getDocumentLabel } from './sync-helpers';

// Export sync operations
export {
  updateNotionPageContent,
  createNotionDatabasePage,
  deleteNotionPage,
  updateNotionPageParent,
  updatePageMentions,
} from './sync-operations';

// Export orchestrator
export { processChanges } from './sync-orchestrator';
export type { ProgressCallback, StopCheckCallback, ProcessChangesResult } from './sync-orchestrator';

// Export lock management
export {
  acquireSyncLock,
  releaseSyncLock,
  requestSyncStop,
  isStopRequested,
  getSyncLockStatus,
  isLockExpired,
} from './sync-lock';
export type { SyncLockStatus } from './sync-lock';
