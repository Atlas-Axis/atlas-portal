import { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import { AtlasDiffResult, AtlasDocumentChange } from '@/app/server/atlas/diff/atlas-diff';
import { ExportAtlasTreeBaseDocument } from '@/app/server/atlas/export/types';
import { UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import { createSyncBatch } from '@/app/server/services/supabase/audit-log-service';
import {
  SyncActionOptions,
  SyncActionResult,
  createNotionDatabasePage,
  deleteNotionPage,
  updateNotionPageContent,
  updateNotionPageParent,
} from '../_actions/sync-actions';
import { getAncestryDepth, getDatabaseHierarchyLevel, getDatabaseNameFromDocument } from './atlas-database-mapper';

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

  // Create sync batch ID for audit logging
  const syncBatchId = createSyncBatch();
  const syncActionOptions: SyncActionOptions = { syncBatchId };

  addLog(`Starting sync batch: ${syncBatchId}`, 'info');

  // Extract changes, document lookup maps, and database tracking maps from diff result
  const { changes, newIdsToDocuments, originalIdsToDatabase, newIdsToDatabase } = diffResult;

  // Calculate total changes to process
  const totalChangesToProcess =
    changes.changed.length +
    changes.added.length +
    changes.deleted.length +
    changes.parent_changed.length +
    changes.sibling_order_changed.length;

  addLog(`Starting sync: ${totalChangesToProcess} total changes to process`, 'info');

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
        const actionResult = await updateNotionPageContent(
          change,
          originalIdsToDatabase,
          uuidMappings,
          syncActionOptions,
        );
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
    // Sort additions by hierarchy level and depth to ensure parents are created before children
    const sortedAdditions = sortAdditionsByHierarchy(changes.added, newIdsToDocuments, newIdsToDatabase);

    addLog(`Phase 2: Processing ${sortedAdditions.length} additions (sorted by hierarchy)`, 'info');
    updateProgress('additions', null);

    for (const change of sortedAdditions) {
      if (options.stopRequested) {
        result.stopRequested = true;
        addLog('Stop requested, skipping remaining additions', 'warning');
        break;
      }

      const docLabel = getDocumentLabel(change);
      updateProgress('additions', docLabel);
      addLog(`Creating page: ${docLabel}`, 'info', change.uuid, docLabel);

      try {
        const actionResult = await createNotionDatabasePage(
          change,
          newIdsToDocuments,
          newIdsToDatabase,
          uuidMappings,
          syncActionOptions,
        );
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
        const actionResult = await deleteNotionPage(change, originalIdsToDatabase, syncActionOptions);
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

  // Phase 4: Process parent changes
  if (changes.parent_changed.length > 0 && !options.stopRequested) {
    addLog(`Phase 4: Processing ${changes.parent_changed.length} parent changes`, 'info');
    updateProgress('content', null); // Reuse content phase for now

    for (const change of changes.parent_changed) {
      if (options.stopRequested) {
        result.stopRequested = true;
        addLog('Stop requested, skipping remaining parent changes', 'warning');
        break;
      }

      const docLabel = getDocumentLabel(change);
      updateProgress('content', docLabel);
      addLog(`Updating parent: ${docLabel}`, 'info', change.uuid, docLabel);

      try {
        const actionResult = await updateNotionPageParent(
          change,
          newIdsToDocuments,
          newIdsToDatabase,
          originalIdsToDatabase,
          syncActionOptions,
        );
        completedCount++;

        if (actionResult.success) {
          result.succeeded.push({ change, result: actionResult, phase: 'content' });
          addLog(`✓ Updated parent: ${docLabel}`, 'success', change.uuid, docLabel);
        } else if (actionResult.reason === 'parent_not_found') {
          result.skipped.push({ change, result: actionResult, phase: 'content' });
          addLog(`⊘ Skipped (new parent not found): ${docLabel}`, 'warning', change.uuid, docLabel);
        } else {
          result.failed.push({ change, result: actionResult, phase: 'content' });
          addLog(`✗ Failed to update parent: ${docLabel} - ${actionResult.error}`, 'error', change.uuid, docLabel);
        }
      } catch (error) {
        completedCount++;
        const err = error as Error;
        const actionResult: SyncActionResult = { success: false, error: err.message };
        result.failed.push({ change, result: actionResult, phase: 'content' });
        addLog(`✗ Error updating parent: ${docLabel} - ${err.message}`, 'error', change.uuid, docLabel);
      }
    }
  }

  // Phase 5: Process sibling order changes
  // Note: Since doc_no and sort_order are now synced via property builder,
  // sibling order changes are effectively handled by updating the doc_no property
  if (changes.sibling_order_changed.length > 0 && !options.stopRequested) {
    addLog(`Phase 5: Processing ${changes.sibling_order_changed.length} sibling order changes`, 'info');
    updateProgress('content', null); // Reuse content phase for now

    for (const change of changes.sibling_order_changed) {
      if (options.stopRequested) {
        result.stopRequested = true;
        addLog('Stop requested, skipping remaining sibling order changes', 'warning');
        break;
      }

      const docLabel = getDocumentLabel(change);
      updateProgress('content', docLabel);
      addLog(`Updating sibling order: ${docLabel}`, 'info', change.uuid, docLabel);

      try {
        // Use updateNotionPageContent which now includes doc_no and sort_order sync
        const actionResult = await updateNotionPageContent(
          change,
          originalIdsToDatabase,
          uuidMappings,
          syncActionOptions,
        );
        completedCount++;

        if (actionResult.success) {
          result.succeeded.push({ change, result: actionResult, phase: 'content' });
          addLog(`✓ Updated sibling order: ${docLabel}`, 'success', change.uuid, docLabel);
        } else {
          result.failed.push({ change, result: actionResult, phase: 'content' });
          addLog(
            `✗ Failed to update sibling order: ${docLabel} - ${actionResult.error}`,
            'error',
            change.uuid,
            docLabel,
          );
        }
      } catch (error) {
        completedCount++;
        const err = error as Error;
        const actionResult: SyncActionResult = { success: false, error: err.message };
        result.failed.push({ change, result: actionResult, phase: 'content' });
        addLog(`✗ Error updating sibling order: ${docLabel} - ${err.message}`, 'error', change.uuid, docLabel);
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
 * Sorts additions by Atlas database hierarchy and nesting depth.
 * This ensures that parent pages are created before their children, preventing
 * relationship errors when both parent and child are being created.
 *
 * Sorting rules:
 * 1. Group by Atlas database name (derived from document type + ancestry)
 * 2. Sort groups by database hierarchy level (Scopes=0, Articles=1, etc.)
 * 3. Within each group, sort by nesting depth (parents before children)
 * 4. Maintain original order for documents at same database + same depth
 *
 * @param additions Array of addition changes to sort
 * @param uuidToDocumentMap Map of UUIDs to document objects for database derivation
 */
export function sortAdditionsByHierarchy(
  additions: AtlasDocumentChange[],
  uuidToDocumentMap: Map<string, ExportAtlasTreeBaseDocument>,
  uuidToDatabase: Map<string, AtlasDatabaseName>,
): AtlasDocumentChange[] {
  // Create array with sorting metadata
  const withMetadata = additions.map((change, originalIndex) => {
    const doc = change.newValues;
    if (!doc) {
      throw new Error(`Document not found for addition change: ${JSON.stringify(change)}`);
    }

    if (!doc.uuid) {
      throw new Error(`Document UUID not found for addition change: ${JSON.stringify(change)}`);
    }

    const databaseName = getDatabaseNameFromDocument(doc.type, doc.uuid, uuidToDatabase);
    const depth = getAncestryDepth(change.newAncestry);

    // For Needed Research, derive parent database to get correct hierarchy level
    let parentDatabaseName;
    if (databaseName === 'Needed Research' && change.newAncestry && change.newAncestry.length > 0) {
      const parentId = change.newAncestry[change.newAncestry.length - 1];
      const parentDoc = uuidToDocumentMap.get(parentId);
      if (parentDoc) {
        parentDatabaseName = uuidToDatabase.get(parentId);
      } else {
        throw new Error(`Parent document not found for new Needed Research document: ${JSON.stringify(change)}`);
      }
    }

    const hierarchyLevel = getDatabaseHierarchyLevel(databaseName, parentDatabaseName);

    return { change, databaseName, hierarchyLevel, depth, originalIndex };
  });

  // Sort by: hierarchy level (asc), then depth (asc), then original order
  withMetadata.sort((a, b) => {
    // First by hierarchy level (lower = higher in hierarchy)
    if (a.hierarchyLevel !== b.hierarchyLevel) {
      return a.hierarchyLevel - b.hierarchyLevel;
    }
    // Then by depth (lower = closer to root)
    if (a.depth !== b.depth) {
      return a.depth - b.depth;
    }
    // Finally by original order (stable sort)
    return a.originalIndex - b.originalIndex;
  });

  return withMetadata.map((item) => item.change);
}

/**
 * Gets a human-readable label for a document change.
 */
function getDocumentLabel(change: AtlasDocumentChange): string {
  const doc = change.newValues || change.oldValues;
  if (!doc) return 'Unknown document';

  return `${doc.doc_no} - ${doc.name} [${doc.type}]`;
}
