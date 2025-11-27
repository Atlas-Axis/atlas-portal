/**
 * Types and constants for batch sync functionality.
 * This file has NO server-side dependencies and can be safely imported on both client and server.
 */
import type { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import type { AtlasDocumentChange } from '@/app/server/atlas/diff/atlas-diff';
import type { ExportAtlasTreeBaseDocument } from '@/app/server/atlas/export/types';

/** Batch size for client-side batching (25 documents per batch) */
export const SYNC_BATCH_SIZE = 25;

/**
 * Serializable version of diff data for passing to server action.
 * Maps are serialized as [key, value][] arrays since Maps can't be passed to server actions.
 */
export interface SerializedBatchData {
  /** Changes to process in this batch */
  changes: AtlasDocumentChange[];
  /** Serialized map of UUID -> AtlasDatabaseName for original documents */
  originalIdsToDatabase: [string, AtlasDatabaseName][];
  /** Serialized map of UUID -> AtlasDatabaseName for new documents */
  newIdsToDatabase: [string, AtlasDatabaseName][];
  /** Serialized map of UUID -> ExportAtlasTreeBaseDocument for new documents */
  newIdsToDocuments: [string, ExportAtlasTreeBaseDocument][];
}

/**
 * Result returned from sync server actions.
 */
export interface RealSyncResult {
  succeeded: number;
  failed: number;
  skipped: number;
  logs: Array<{
    timestamp: string;
    message: string;
    type: 'info' | 'success' | 'error' | 'warning';
    documentId?: string;
    documentLabel?: string;
  }>;
  stopRequested: boolean;
  error?: string;
}

/**
 * Prepares serialized batch data for a set of changes.
 * Extracts only the map entries needed for the given changes to minimize payload size.
 *
 * @param changes Changes to process in this batch
 * @param originalIdsToDatabase Full map of original document UUIDs to database names
 * @param newIdsToDatabase Full map of new document UUIDs to database names
 * @param newIdsToDocuments Full map of new document UUIDs to document objects
 * @returns Serialized batch data ready to pass to server action
 */
export function prepareBatchData(
  changes: AtlasDocumentChange[],
  originalIdsToDatabase: Map<string, AtlasDatabaseName>,
  newIdsToDatabase: Map<string, AtlasDatabaseName>,
  newIdsToDocuments: Map<string, ExportAtlasTreeBaseDocument>,
): SerializedBatchData {
  // Collect all UUIDs needed for this batch
  const originalUuids = new Set<string>();
  const newUuids = new Set<string>();

  for (const change of changes) {
    // Add the change's own UUID
    if (change.uuid) {
      // For existing documents (changed, deleted, parent_changed, sibling_order_changed)
      originalUuids.add(change.uuid);
      // For documents with new values
      newUuids.add(change.uuid);
    }

    // Add old ancestry UUIDs (for deletions, parent changes)
    if (change.oldAncestry) {
      for (const ancestorId of change.oldAncestry) {
        originalUuids.add(ancestorId);
      }
    }

    // Add new ancestry UUIDs (for additions, parent changes)
    if (change.newAncestry) {
      for (const ancestorId of change.newAncestry) {
        newUuids.add(ancestorId);
      }
    }
  }

  // Extract subsets of maps for only the needed UUIDs
  const originalIdsToDatabaseSubset: [string, AtlasDatabaseName][] = [];
  for (const uuid of originalUuids) {
    const dbName = originalIdsToDatabase.get(uuid);
    if (dbName) {
      originalIdsToDatabaseSubset.push([uuid, dbName]);
    }
  }

  const newIdsToDatabaseSubset: [string, AtlasDatabaseName][] = [];
  for (const uuid of newUuids) {
    const dbName = newIdsToDatabase.get(uuid);
    if (dbName) {
      newIdsToDatabaseSubset.push([uuid, dbName]);
    }
  }

  const newIdsToDocumentsSubset: [string, ExportAtlasTreeBaseDocument][] = [];
  for (const uuid of newUuids) {
    const doc = newIdsToDocuments.get(uuid);
    if (doc) {
      newIdsToDocumentsSubset.push([uuid, doc]);
    }
  }

  return {
    changes,
    originalIdsToDatabase: originalIdsToDatabaseSubset,
    newIdsToDatabase: newIdsToDatabaseSubset,
    newIdsToDocuments: newIdsToDocumentsSubset,
  };
}

/**
 * Splits an array of changes into batches of the specified size.
 *
 * @param changes All changes to process
 * @param batchSize Number of changes per batch
 * @returns Array of change batches
 */
export function splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Flattens grouped changes into a single array in the correct processing order.
 * Order: content changes → additions (should be pre-sorted by hierarchy) → deletions → parent changes → sibling order changes
 *
 * @param changes Grouped changes object
 * @returns Flat array of all changes in processing order
 */
export function flattenChangesInOrder(changes: {
  changed: AtlasDocumentChange[];
  added: AtlasDocumentChange[];
  deleted: AtlasDocumentChange[];
  parent_changed: AtlasDocumentChange[];
  sibling_order_changed: AtlasDocumentChange[];
}): AtlasDocumentChange[] {
  return [
    ...changes.changed,
    ...changes.added,
    ...changes.deleted,
    ...changes.parent_changed,
    ...changes.sibling_order_changed,
  ];
}
