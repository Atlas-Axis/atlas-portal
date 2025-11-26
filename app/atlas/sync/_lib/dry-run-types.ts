/**
 * Shared types and constants for dry-run functionality.
 * This file has NO server-side dependencies and can be safely imported on both client and server.
 */
import type { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import type { AtlasChangeType } from '@/app/server/atlas/diff/atlas-diff';

export type SyncPhase = 'content' | 'additions' | 'deletions' | 'idle';

/**
 * Represents a single operation that would be performed during sync.
 * Used for dry-run mode to show what changes would be made without executing them.
 */
export interface DryRunOperation {
  phase: SyncPhase;
  operationType: 'create' | 'update' | 'archive';
  documentLabel: string;
  documentId: string;
  databaseName: AtlasDatabaseName | 'Unknown';
  changeType: AtlasChangeType;
  /** Whether this operation would be skipped */
  skipped?: boolean;
  /** Reason for skipping (e.g., nesting bug affected, has children) */
  skipReason?: string;
}

/**
 * Summary counts for dry-run results.
 */
export interface DryRunSummary {
  createCount: number;
  updateCount: number;
  archiveCount: number;
  skippedCount: number;
  totalCount: number;
}

/**
 * Result of a dry-run sync operation.
 * Contains planned operations without executing any writes.
 * Operations are limited to MAX_OPERATIONS_PER_TYPE to keep UI responsive.
 */
export interface DryRunResult {
  /** Limited list of operations (max per type to keep UI responsive) */
  operations: DryRunOperation[];
  /** Summary counts (always accurate, even when operations are truncated) */
  summary: DryRunSummary;
  /** Whether the operations list was truncated due to size limits */
  truncated: boolean;
  skippedCount: number;
}

/** Maximum operations to return per type for UI display */
export const MAX_OPERATIONS_PER_TYPE = 50;
