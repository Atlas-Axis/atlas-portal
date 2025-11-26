/**
 * Client-side dry-run computation to avoid server action payload size limits.
 * Uses types from dry-run-types.ts (no server dependencies).
 */
import type { AtlasDiffResult, AtlasDocumentChange } from '@/app/server/atlas/diff/atlas-diff';
import type { DryRunOperation, DryRunResult } from './dry-run-types';
import { MAX_OPERATIONS_PER_TYPE } from './dry-run-types';

/**
 * Computes dry-run result entirely on the client side.
 * Only requires the nesting bug affected UUIDs from the server (tiny payload).
 *
 * @param diffResult The diff result (already available on client from page load)
 * @param nestingBugAffectedUuids Set of UUIDs affected by nesting bug (from server)
 */
export function computeDryRunResult(diffResult: AtlasDiffResult, nestingBugAffectedUuids: Set<string>): DryRunResult {
  const operations: DryRunOperation[] = [];
  let skippedCount = 0;

  const { changes, originalIdsToDatabase, newIdsToDatabase } = diffResult;

  // Helper to get document label
  const getDocumentLabel = (change: AtlasDocumentChange): string => {
    const doc = change.newValues || change.oldValues;
    if (!doc) return 'Unknown document';
    return `${doc.doc_no} - ${doc.name} [${doc.type}]`;
  };

  // Phase 1: Content changes
  for (const change of changes.changed) {
    const databaseName = originalIdsToDatabase.get(change.uuid!) || 'Unknown';
    operations.push({
      phase: 'content',
      operationType: 'update',
      documentLabel: getDocumentLabel(change),
      documentId: change.uuid!,
      databaseName,
      changeType: 'changed',
    });
  }

  // Phase 2: Additions
  for (const change of changes.added) {
    const doc = change.newValues!;
    const databaseName = newIdsToDatabase.get(doc.uuid!) || 'Unknown';
    operations.push({
      phase: 'additions',
      operationType: 'create',
      documentLabel: getDocumentLabel(change),
      documentId: doc.uuid!,
      databaseName,
      changeType: 'added',
    });
  }

  // Phase 3: Deletions
  for (const change of changes.deleted) {
    const databaseName = originalIdsToDatabase.get(change.uuid!) || 'Unknown';
    operations.push({
      phase: 'deletions',
      operationType: 'archive',
      documentLabel: getDocumentLabel(change),
      documentId: change.uuid!,
      databaseName,
      changeType: 'deleted',
    });
  }

  // Phase 4: Parent changes (check nesting bug)
  for (const change of changes.parent_changed) {
    const databaseName = newIdsToDatabase.get(change.uuid!) || 'Unknown';
    const isNestingBugAffected = change.uuid && nestingBugAffectedUuids.has(change.uuid);

    if (isNestingBugAffected) {
      operations.push({
        phase: 'content',
        operationType: 'update',
        documentLabel: getDocumentLabel(change),
        documentId: change.uuid!,
        databaseName,
        changeType: 'parent_changed',
        skipped: true,
        skipReason: 'Affected by nesting bug - manual mapping exists',
      });
      skippedCount++;
    } else {
      operations.push({
        phase: 'content',
        operationType: 'update',
        documentLabel: getDocumentLabel(change),
        documentId: change.uuid!,
        databaseName,
        changeType: 'parent_changed',
      });
    }
  }

  // Phase 5: Sibling order changes
  for (const change of changes.sibling_order_changed) {
    const databaseName = originalIdsToDatabase.get(change.uuid!) || 'Unknown';
    operations.push({
      phase: 'content',
      operationType: 'update',
      documentLabel: getDocumentLabel(change),
      documentId: change.uuid!,
      databaseName,
      changeType: 'sibling_order_changed',
    });
  }

  // Calculate summary from full list (before truncation)
  const createCount = operations.filter((op) => op.operationType === 'create').length;
  const updateCount = operations.filter((op) => op.operationType === 'update' && !op.skipped).length;
  const archiveCount = operations.filter((op) => op.operationType === 'archive').length;
  const totalCount = createCount + updateCount + archiveCount + skippedCount;

  // Truncate for UI display
  const createOps = operations.filter((op) => op.operationType === 'create');
  const updateOps = operations.filter((op) => op.operationType === 'update' && !op.skipped);
  const archiveOps = operations.filter((op) => op.operationType === 'archive');
  const skippedOps = operations.filter((op) => op.skipped);

  const truncatedOperations = [
    ...createOps.slice(0, MAX_OPERATIONS_PER_TYPE),
    ...updateOps.slice(0, MAX_OPERATIONS_PER_TYPE),
    ...archiveOps.slice(0, MAX_OPERATIONS_PER_TYPE),
    ...skippedOps.slice(0, MAX_OPERATIONS_PER_TYPE),
  ];

  const truncated =
    createOps.length > MAX_OPERATIONS_PER_TYPE ||
    updateOps.length > MAX_OPERATIONS_PER_TYPE ||
    archiveOps.length > MAX_OPERATIONS_PER_TYPE ||
    skippedOps.length > MAX_OPERATIONS_PER_TYPE;

  return {
    operations: truncatedOperations,
    summary: {
      createCount,
      updateCount,
      archiveCount,
      skippedCount,
      totalCount,
    },
    truncated,
    skippedCount,
  };
}
