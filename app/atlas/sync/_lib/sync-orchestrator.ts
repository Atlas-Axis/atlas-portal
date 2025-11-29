import { AtlasDiffResult, AtlasDocumentChange } from '@/app/server/atlas/diff/atlas-diff';
import { compareDocNumbers } from '@/app/server/atlas/document-numbering/atlas-utils';
import { UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import { createSyncBatch } from '@/app/server/services/supabase/audit-log-service';
import {
  buildNestingBugAffectedUuidsSet,
  loadNotionNestingFixMappings,
} from '@/app/server/services/supabase/notion-nesting-bug-mappings';
import {
  SyncActionOptions,
  SyncActionResult,
  createNotionDatabasePage,
  deleteNotionPage,
  updateNotionPageContent,
  updateNotionPageParent,
} from '../_actions/sync-actions';
import type { SyncPhase } from './dry-run-types';

// Re-export dry-run types from shared file (safe to import on client side)
export type { DryRunOperation, DryRunResult, DryRunSummary, SyncPhase } from './dry-run-types';

export interface SyncOptions {
  stopRequested: boolean;
  dryRun?: boolean;
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

  // Create sync batch ID for audit logging (skip for dry-run)
  const syncBatchId = options.dryRun ? 'dry-run' : createSyncBatch();
  const syncActionOptions: SyncActionOptions = { syncBatchId };

  if (options.dryRun) {
    addLog(`Starting dry-run (no API calls will be made)`, 'info');
  } else {
    addLog(`Starting sync batch: ${syncBatchId}`, 'info');
  }

  // Load nesting bug mappings once and build affected UUIDs set for O(1) lookups
  // Documents affected by the nesting bug should not have their parent relationships changed
  const nestingStartTime = performance.now();
  const nestingMappings = await loadNotionNestingFixMappings();
  const nestingBugAffectedUuids = buildNestingBugAffectedUuidsSet(nestingMappings, uuidMappings);
  const nestingElapsed = performance.now() - nestingStartTime;
  console.log(`[Sync Timing] Load nesting bug mappings: ${nestingElapsed.toFixed(0)}ms`);
  if (nestingBugAffectedUuids.size > 0) {
    addLog(
      `Loaded ${nestingBugAffectedUuids.size} documents affected by nesting bug (parent changes will be skipped)`,
      'info',
    );
  }

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
    const phase1StartTime = performance.now();
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
        let actionResult: SyncActionResult;

        if (options.dryRun) {
          // Dry-run: simulate success without making API call
          actionResult = { success: true, pageId: change.uuid };
          completedCount++;
          result.succeeded.push({ change, result: actionResult, phase: 'content' });
          addLog(`[DRY-RUN] Would update: ${docLabel}`, 'info', change.uuid, docLabel);
        } else {
          // Normal: make actual API call
          actionResult = await updateNotionPageContent(change, originalIdsToDatabase, uuidMappings, syncActionOptions);
          completedCount++;

          if (actionResult.success) {
            result.succeeded.push({ change, result: actionResult, phase: 'content' });
            addLog(`✓ Updated: ${docLabel}`, 'success', change.uuid, docLabel);
          } else if (actionResult.reason === 'mapping_not_found') {
            // Skip if UUID mapping is not found (document may not exist in Supabase yet)
            result.skipped.push({ change, result: actionResult, phase: 'content' });
            addLog(`⊘ Skipped (${actionResult.reason}): ${docLabel}`, 'warning', change.uuid, docLabel);
          } else {
            result.failed.push({ change, result: actionResult, phase: 'content' });
            addLog(`✗ Failed to update: ${docLabel} - ${actionResult.error}`, 'error', change.uuid, docLabel);
          }
        }
      } catch (error) {
        completedCount++;
        const err = error as Error;
        const actionResult: SyncActionResult = { success: false, error: err.message };
        result.failed.push({ change, result: actionResult, phase: 'content' });
        addLog(`✗ Error updating: ${docLabel} - ${err.message}`, 'error', change.uuid, docLabel);
      }
    }

    const phase1Elapsed = performance.now() - phase1StartTime;
    console.log(
      `[Sync Timing] Phase 1 - Content Changes: ${phase1Elapsed.toFixed(0)}ms (${changes.changed.length} documents)`,
    );
  }

  // Phase 2: Process additions (validate parents first)
  if (changes.added.length > 0 && !options.stopRequested) {
    const phase2StartTime = performance.now();
    // Sort additions in depth-first order to ensure parents are created before children
    // and document numbers remain consistent even with partial syncs
    const sortedAdditions = sortAdditionsByDepthFirst(changes.added);

    addLog(`Phase 2: Processing ${sortedAdditions.length} additions (sorted depth-first)`, 'info');
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
        let actionResult: SyncActionResult;

        if (options.dryRun) {
          // Dry-run: simulate success without making API call
          actionResult = { success: true, pageId: 'new-page-id' };
          completedCount++;
          result.succeeded.push({ change, result: actionResult, phase: 'additions' });
          addLog(`[DRY-RUN] Would create: ${docLabel}`, 'info', change.uuid, docLabel);
        } else {
          // Normal: make actual API call
          actionResult = await createNotionDatabasePage(
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
          } else if (
            actionResult.reason === 'parent_not_found' ||
            actionResult.reason === 'mapping_not_found' ||
            actionResult.reason === 'parent_lookup_error' ||
            actionResult.reason === 'relationship_error'
          ) {
            // Skip when a same-database parent is specified but doesn't exist in Notion
            // Note: Having no parent (root-level or cross-database) is perfectly valid
            // Also skip if UUID mapping is not found (document may not exist in Supabase yet)
            // Also skip if parent lookup or relationship building failed
            result.skipped.push({ change, result: actionResult, phase: 'additions' });
            addLog(`⊘ Skipped (${actionResult.reason}): ${docLabel}`, 'warning', change.uuid, docLabel);
          } else {
            result.failed.push({ change, result: actionResult, phase: 'additions' });
            addLog(`✗ Failed to create: ${docLabel} - ${actionResult.error}`, 'error', change.uuid, docLabel);
          }
        }
      } catch (error) {
        completedCount++;
        const err = error as Error;
        const actionResult: SyncActionResult = { success: false, error: err.message };
        result.failed.push({ change, result: actionResult, phase: 'additions' });
        addLog(`✗ Error creating: ${docLabel} - ${err.message}`, 'error', change.uuid, docLabel);
      }
    }

    const phase2Elapsed = performance.now() - phase2StartTime;
    console.log(
      `[Sync Timing] Phase 2 - Additions: ${phase2Elapsed.toFixed(0)}ms (${sortedAdditions.length} documents)`,
    );
  }

  // Phase 3: Process deletions (verify no children)
  if (changes.deleted.length > 0 && !options.stopRequested) {
    const phase3StartTime = performance.now();
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
        let actionResult: SyncActionResult;

        if (options.dryRun) {
          // Dry-run: simulate success without making API call
          actionResult = { success: true, pageId: change.uuid };
          completedCount++;
          result.succeeded.push({ change, result: actionResult, phase: 'deletions' });
          addLog(`[DRY-RUN] Would delete: ${docLabel}`, 'info', change.uuid, docLabel);
        } else {
          // Normal: make actual API call
          actionResult = await deleteNotionPage(change, originalIdsToDatabase, uuidMappings, syncActionOptions);
          completedCount++;

          if (actionResult.success) {
            result.succeeded.push({ change, result: actionResult, phase: 'deletions' });
            addLog(`✓ Deleted: ${docLabel}`, 'success', change.uuid, docLabel);
          } else if (actionResult.reason === 'has_children' || actionResult.reason === 'mapping_not_found') {
            // Skip deletion if page has children to prevent orphaned documents and data loss
            // Also skip if UUID mapping is not found (document may not exist in Supabase yet)
            result.skipped.push({ change, result: actionResult, phase: 'deletions' });
            addLog(`⊘ Skipped (${actionResult.reason}): ${docLabel}`, 'warning', change.uuid, docLabel);
          } else {
            result.failed.push({ change, result: actionResult, phase: 'deletions' });
            addLog(`✗ Failed to delete: ${docLabel} - ${actionResult.error}`, 'error', change.uuid, docLabel);
          }
        }
      } catch (error) {
        completedCount++;
        const err = error as Error;
        const actionResult: SyncActionResult = { success: false, error: err.message };
        result.failed.push({ change, result: actionResult, phase: 'deletions' });
        addLog(`✗ Error deleting: ${docLabel} - ${err.message}`, 'error', change.uuid, docLabel);
      }
    }

    const phase3Elapsed = performance.now() - phase3StartTime;
    console.log(
      `[Sync Timing] Phase 3 - Deletions: ${phase3Elapsed.toFixed(0)}ms (${changes.deleted.length} documents)`,
    );
  }

  // Phase 4: Process parent changes
  // Note: Documents affected by the nesting bug are skipped to preserve manual relationship corrections
  if (changes.parent_changed.length > 0 && !options.stopRequested) {
    const phase4StartTime = performance.now();
    addLog(`Phase 4: Processing ${changes.parent_changed.length} parent changes`, 'info');
    updateProgress('content', null); // Reuse content phase for now

    for (const change of changes.parent_changed) {
      if (options.stopRequested) {
        result.stopRequested = true;
        addLog('Stop requested, skipping remaining parent changes', 'warning');
        break;
      }

      const docLabel = getDocumentLabel(change);
      updateProgress('parent_changed', docLabel);

      // Skip documents affected by nesting bug to preserve manual relationship corrections
      if (change.uuid && nestingBugAffectedUuids.has(change.uuid)) {
        const actionResult: SyncActionResult = {
          success: false,
          reason: 'nesting_bug_affected',
          error: 'Document has manual nesting bug mapping - parent change skipped',
        };
        result.skipped.push({ change, result: actionResult, phase: 'parent_changed' });
        addLog(
          `⊘ Skipped (nesting bug affected): ${docLabel} - manual mapping exists`,
          'warning',
          change.uuid,
          docLabel,
        );
        completedCount++;
        continue;
      }

      try {
        let actionResult: SyncActionResult;

        if (options.dryRun) {
          // Dry-run: simulate success without making API call
          actionResult = { success: true, pageId: change.uuid };
          completedCount++;
          result.succeeded.push({ change, result: actionResult, phase: 'parent_changed' });
          addLog(`[DRY-RUN] Would update parent: ${docLabel}`, 'info', change.uuid, docLabel);
        } else {
          // Normal: make actual API call
          addLog(`Updating parent: ${docLabel}`, 'info', change.uuid, docLabel);
          actionResult = await updateNotionPageParent(
            change,
            newIdsToDocuments,
            newIdsToDatabase,
            originalIdsToDatabase,
            uuidMappings,
            syncActionOptions,
          );
          completedCount++;

          if (actionResult.success) {
            result.succeeded.push({ change, result: actionResult, phase: 'parent_changed' });
            addLog(`✓ Updated parent: ${docLabel}`, 'success', change.uuid, docLabel);
          } else if (
            actionResult.reason === 'parent_not_found' ||
            actionResult.reason === 'mapping_not_found' ||
            actionResult.reason === 'parent_lookup_error' ||
            actionResult.reason === 'relationship_error'
          ) {
            result.skipped.push({ change, result: actionResult, phase: 'parent_changed' });
            addLog(`⊘ Skipped (${actionResult.reason}): ${docLabel}`, 'warning', change.uuid, docLabel);
          } else {
            result.failed.push({ change, result: actionResult, phase: 'parent_changed' });
            addLog(`✗ Failed to update parent: ${docLabel} - ${actionResult.error}`, 'error', change.uuid, docLabel);
          }
        }
      } catch (error) {
        completedCount++;
        const err = error as Error;
        const actionResult: SyncActionResult = { success: false, error: err.message };
        result.failed.push({ change, result: actionResult, phase: 'parent_changed' });
        addLog(`✗ Error updating parent: ${docLabel} - ${err.message}`, 'error', change.uuid, docLabel);
      }
    }

    const phase4Elapsed = performance.now() - phase4StartTime;
    console.log(
      `[Sync Timing] Phase 4 - Parent Changes: ${phase4Elapsed.toFixed(0)}ms (${changes.parent_changed.length} documents)`,
    );
  }

  // Phase 5: Process sibling order changes
  // Note: Since doc_no and sort_order are now synced via property builder,
  // sibling order changes are effectively handled by updating the doc_no property
  if (changes.sibling_order_changed.length > 0 && !options.stopRequested) {
    const phase5StartTime = performance.now();
    addLog(`Phase 5: Processing ${changes.sibling_order_changed.length} sibling order changes`, 'info');
    updateProgress('sibling_order_changed', null);

    for (const change of changes.sibling_order_changed) {
      if (options.stopRequested) {
        result.stopRequested = true;
        addLog('Stop requested, skipping remaining sibling order changes', 'warning');
        break;
      }

      const docLabel = getDocumentLabel(change);
      updateProgress('sibling_order_changed', docLabel);

      try {
        let actionResult: SyncActionResult;

        if (options.dryRun) {
          // Dry-run: simulate success without making API call
          actionResult = { success: true, pageId: change.uuid };
          completedCount++;
          result.succeeded.push({ change, result: actionResult, phase: 'sibling_order_changed' });
          addLog(`[DRY-RUN] Would update sibling order: ${docLabel}`, 'info', change.uuid, docLabel);
        } else {
          // Normal: make actual API call
          addLog(`Updating sibling order: ${docLabel}`, 'info', change.uuid, docLabel);
          // Use updateNotionPageContent which now includes doc_no and sort_order sync
          actionResult = await updateNotionPageContent(change, originalIdsToDatabase, uuidMappings, syncActionOptions);
          completedCount++;

          if (actionResult.success) {
            result.succeeded.push({ change, result: actionResult, phase: 'sibling_order_changed' });
            addLog(`✓ Updated sibling order: ${docLabel}`, 'success', change.uuid, docLabel);
          } else if (actionResult.reason === 'mapping_not_found') {
            // Skip if UUID mapping is not found (document may not exist in Supabase yet)
            result.skipped.push({ change, result: actionResult, phase: 'sibling_order_changed' });
            addLog(`⊘ Skipped (${actionResult.reason}): ${docLabel}`, 'warning', change.uuid, docLabel);
          } else {
            result.failed.push({ change, result: actionResult, phase: 'sibling_order_changed' });
            addLog(
              `✗ Failed to update sibling order: ${docLabel} - ${actionResult.error}`,
              'error',
              change.uuid,
              docLabel,
            );
          }
        }
      } catch (error) {
        completedCount++;
        const err = error as Error;
        const actionResult: SyncActionResult = { success: false, error: err.message };
        result.failed.push({ change, result: actionResult, phase: 'sibling_order_changed' });
        addLog(`✗ Error updating sibling order: ${docLabel} - ${err.message}`, 'error', change.uuid, docLabel);
      }
    }

    const phase5Elapsed = performance.now() - phase5StartTime;
    console.log(
      `[Sync Timing] Phase 5 - Sibling Order Changes: ${phase5Elapsed.toFixed(0)}ms (${changes.sibling_order_changed.length} documents)`,
    );
  }

  result.totalProcessed = completedCount;

  // Summary log
  if (options.dryRun) {
    addLog(
      `Dry-run completed: ${result.succeeded.length} operations would execute, ${result.skipped.length} would be skipped`,
      'success',
    );

    // Write dry-run results to markdown file
    try {
      const { writeDryRunMarkdown } = await import('../_actions/dry-run-markdown-writer');
      await writeDryRunMarkdown(result, diffResult);
      addLog('Dry-run results written to dry-run-output.md', 'success');
    } catch (error) {
      const err = error as Error;
      addLog(`Failed to write dry-run results: ${err.message}`, 'error');
    }
  } else {
    addLog(
      `Sync completed: ${result.succeeded.length} succeeded, ${result.failed.length} failed, ${result.skipped.length} skipped`,
      result.failed.length > 0 ? 'warning' : 'success',
    );
  }

  updateProgress('idle', null);

  return result;
}

/**
 * Sorts additions in depth-first (pre-order) traversal order.
 *
 * This ensures that when syncing documents to Notion:
 * 1. Parents are always created before their children
 * 2. Document numbers remain consistent even with partial syncs
 * 3. Stopping mid-sync results in a clean state where the diff shows only "Added"
 *
 * The ordering matches the document numbering algorithm in atlas-tree-numbering.ts,
 * which assigns numbers based on sibling position during pre-order traversal.
 *
 * Example ordering:
 * - A.0 (Scope)
 * - A.0.1 (Article)
 * - A.0.1.1 (Section)
 * - A.0.1.1.1 (Core)
 * - A.0.1.1.2 (Core)
 * - A.0.1.2 (Section)
 * - A.0.2 (Article)
 * - A.1 (Scope)
 *
 * @param additions Array of addition changes to sort
 * @returns Sorted array in depth-first order
 */
export function sortAdditionsByDepthFirst(additions: AtlasDocumentChange[]): AtlasDocumentChange[] {
  if (additions.length === 0) {
    return [];
  }

  // 1. Build parent-to-children map from ancestry
  // Key: parent UUID (or null for roots/documents whose parent already exists in Notion)
  const childrenMap = new Map<string | null, AtlasDocumentChange[]>();

  // Track which UUIDs are being added (to distinguish roots from children)
  const addedUuids = new Set(additions.map((c) => c.uuid));

  for (const change of additions) {
    // Find the immediate parent from ancestry
    const parentUuid = change.newAncestry?.length ? change.newAncestry[change.newAncestry.length - 1] : null;

    // If parent is not being added in this sync, this document is effectively a root
    // (its parent already exists in Notion)
    const effectiveParent = parentUuid && addedUuids.has(parentUuid) ? parentUuid : null;

    if (!childrenMap.has(effectiveParent)) {
      childrenMap.set(effectiveParent, []);
    }
    childrenMap.get(effectiveParent)!.push(change);
  }

  // 2. Sort children at each level using natural document number ordering
  // This ensures siblings are processed in the correct order (A.0.1.1 before A.0.1.2 before A.0.1.10)
  for (const children of childrenMap.values()) {
    children.sort((a, b) => compareDocNumbers(a.newValues?.doc_no ?? '', b.newValues?.doc_no ?? ''));
  }

  // 3. Pre-order traversal starting from roots (null parent)
  const result: AtlasDocumentChange[] = [];

  function traverse(parentUuid: string | null) {
    const children = childrenMap.get(parentUuid) ?? [];
    for (const child of children) {
      result.push(child);
      // Recursively add this document's children
      if (child.uuid) {
        traverse(child.uuid);
      }
    }
  }

  traverse(null);
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
