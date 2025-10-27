import { AtlasDiffResult, AtlasDocumentChange } from '@/app/server/atlas/diff/atlas-diff';
import { UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import {
  SyncActionResult,
  createNotionDatabasePage,
  deleteNotionPage,
  updateNotionPageContent,
} from '../_actions/sync-actions';

export type SyncPhase = 'content' | 'additions' | 'deletions' | 'idle';

export interface SyncOptions {
  stopRequested: boolean;
}

export interface SyncLogEntry {
  timestamp: Date;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
  documentId?: string;
  documentLabel?: string;
}

export interface ProcessedChange {
  change: AtlasDocumentChange;
  result: SyncActionResult;
  phase: SyncPhase;
}

export interface SyncResult {
  succeeded: ProcessedChange[];
  failed: ProcessedChange[];
  skipped: ProcessedChange[];
  logs: SyncLogEntry[];
  totalProcessed: number;
  stopRequested: boolean;
}

/**
 * Orchestrates the synchronization of Atlas changes to Notion via Notion API.
 * Processes changes in order: content changes -> additions -> deletions.
 * Supports graceful stopping after current operation completes.
 *
 * @param diffResult The diff result containing changes to sync
 * @param options Sync options including stopRequested flag
 * @param uuidMappings UUID mappings for converting Atlas UUIDs to Notion page links in markdown
 * @param onProgress Optional callback for progress updates
 */
export async function syncChangesToNotion(
  diffResult: AtlasDiffResult,
  options: SyncOptions,
  uuidMappings: UuidMappings,
  onProgress?: (progress: {
    phase: SyncPhase;
    completedCount: number;
    totalCount: number;
    currentDocumentLabel: string | null;
  }) => void,
): Promise<SyncResult> {
  const result: SyncResult = {
    succeeded: [],
    failed: [],
    skipped: [],
    logs: [],
    totalProcessed: 0,
    stopRequested: false,
  };

  const addLog = (
    message: string,
    type: SyncLogEntry['type'] = 'info',
    documentId?: string,
    documentLabel?: string,
  ) => {
    result.logs.push({
      timestamp: new Date(),
      message,
      type,
      documentId,
      documentLabel,
    });
  };

  // Extract changes and document lookup maps from diff result
  const { changes, newIdsToDocuments } = diffResult;

  // Calculate total changes to process (excluding structural changes which aren't synced yet)
  const totalChangesToProcess = changes.changed.length + changes.added.length + changes.deleted.length; // TODO: Add parent_changed and sibling_order_changed

  addLog(`Starting sync: ${totalChangesToProcess} total changes`, 'info');

  let completedCount = 0;

  // Helper to update progress
  const updateProgress = (phase: SyncPhase, currentDocumentLabel: string | null) => {
    if (onProgress) {
      onProgress({
        phase,
        completedCount,
        totalCount: totalChangesToProcess,
        currentDocumentLabel,
      });
    }
  };

  // Phase 1: Process content changes (safest - no relationship modifications)
  if (changes.changed.length > 0) {
    addLog(`Phase 1: Processing ${changes.changed.length} content changes`, 'info');
    updateProgress('content', null);

    for (const change of changes.changed) {
      if (options.stopRequested) {
        result.stopRequested = true;
        addLog('Stop requested, skipping remaining content changes', 'warning');
        break;
      }

      const docLabel = getDocumentLabel(change);
      updateProgress('content', docLabel);
      addLog(`Updating content: ${docLabel}`, 'info', change.uuid, docLabel);

      try {
        const actionResult = await updateNotionPageContent(change, uuidMappings);
        completedCount++;

        if (actionResult.success) {
          result.succeeded.push({ change, result: actionResult, phase: 'content' });
          addLog(`✓ Updated: ${docLabel}`, 'success', change.uuid, docLabel);
        } else {
          result.failed.push({ change, result: actionResult, phase: 'content' });
          addLog(`✗ Failed to update: ${docLabel} - ${actionResult.error}`, 'error', change.uuid, docLabel);
        }
      } catch (error) {
        completedCount++;
        const err = error as Error;
        const actionResult: SyncActionResult = { success: false, error: err.message };
        result.failed.push({ change, result: actionResult, phase: 'content' });
        addLog(`✗ Error updating: ${docLabel} - ${err.message}`, 'error', change.uuid, docLabel);
      }
    }
  }

  // Phase 2: Process additions (validate parents first)
  if (changes.added.length > 0 && !options.stopRequested) {
    addLog(`Phase 2: Processing ${changes.added.length} additions`, 'info');
    updateProgress('additions', null);

    for (const change of changes.added) {
      if (options.stopRequested) {
        result.stopRequested = true;
        addLog('Stop requested, skipping remaining additions', 'warning');
        break;
      }

      const docLabel = getDocumentLabel(change);
      updateProgress('additions', docLabel);
      addLog(`Creating page: ${docLabel}`, 'info', change.uuid, docLabel);

      try {
        const actionResult = await createNotionDatabasePage(change, newIdsToDocuments, uuidMappings);
        completedCount++;

        if (actionResult.success) {
          result.succeeded.push({ change, result: actionResult, phase: 'additions' });
          addLog(`✓ Created: ${docLabel}`, 'success', actionResult.pageId, docLabel);
        } else if (actionResult.reason === 'parent_not_found') {
          // Skip when a same-database parent is specified but doesn't exist in Notion
          // Note: Having no parent (root-level or cross-database) is perfectly valid
          result.skipped.push({ change, result: actionResult, phase: 'additions' });
          addLog(`⊘ Skipped (specified relationship parent missing): ${docLabel}`, 'warning', change.uuid, docLabel);
        } else {
          result.failed.push({ change, result: actionResult, phase: 'additions' });
          addLog(`✗ Failed to create: ${docLabel} - ${actionResult.error}`, 'error', change.uuid, docLabel);
        }
      } catch (error) {
        completedCount++;
        const err = error as Error;
        const actionResult: SyncActionResult = { success: false, error: err.message };
        result.failed.push({ change, result: actionResult, phase: 'additions' });
        addLog(`✗ Error creating: ${docLabel} - ${err.message}`, 'error', change.uuid, docLabel);
      }
    }
  }

  // Phase 3: Process deletions (verify no children)
  if (changes.deleted.length > 0 && !options.stopRequested) {
    addLog(`Phase 3: Processing ${changes.deleted.length} deletions`, 'info');
    updateProgress('deletions', null);

    for (const change of changes.deleted) {
      if (options.stopRequested) {
        result.stopRequested = true;
        addLog('Stop requested, skipping remaining deletions', 'warning');
        break;
      }

      const docLabel = getDocumentLabel(change);
      updateProgress('deletions', docLabel);
      addLog(`Deleting page: ${docLabel}`, 'info', change.uuid, docLabel);

      try {
        const actionResult = await deleteNotionPage(change);
        completedCount++;

        if (actionResult.success) {
          result.succeeded.push({ change, result: actionResult, phase: 'deletions' });
          addLog(`✓ Deleted: ${docLabel}`, 'success', change.uuid, docLabel);
        } else if (actionResult.reason === 'has_children') {
          // Skip deletion if page has children to prevent orphaned documents and data loss
          result.skipped.push({ change, result: actionResult, phase: 'deletions' });
          addLog(`⊘ Skipped (has children): ${docLabel}`, 'warning', change.uuid, docLabel);
        } else {
          result.failed.push({ change, result: actionResult, phase: 'deletions' });
          addLog(`✗ Failed to delete: ${docLabel} - ${actionResult.error}`, 'error', change.uuid, docLabel);
        }
      } catch (error) {
        completedCount++;
        const err = error as Error;
        const actionResult: SyncActionResult = { success: false, error: err.message };
        result.failed.push({ change, result: actionResult, phase: 'deletions' });
        addLog(`✗ Error deleting: ${docLabel} - ${err.message}`, 'error', change.uuid, docLabel);
      }
    }
  }

  result.totalProcessed = completedCount;

  // Summary log
  addLog(
    `Sync completed: ${result.succeeded.length} succeeded, ${result.failed.length} failed, ${result.skipped.length} skipped`,
    result.failed.length > 0 ? 'warning' : 'success',
  );

  updateProgress('idle', null);

  return result;
}

/**
 * Gets a human-readable label for a document change.
 */
function getDocumentLabel(change: AtlasDocumentChange): string {
  const doc = change.newValues || change.oldValues;
  if (!doc) return 'Unknown document';

  return `${doc.doc_no} - ${doc.name} [${doc.type}]`;
}
