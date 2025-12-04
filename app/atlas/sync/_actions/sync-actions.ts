'use server';

import { tasks } from '@trigger.dev/sdk/v3';
import { getSyncLockStatus, requestSyncStop as requestSyncStopDb } from '@/app/server/services/markdown-notion-sync';
import type { MarkdownNotionSyncPayload, SyncFilters } from '@/app/server/services/trigger/markdown-notion-sync-task';

// Re-export types for client use
export type { SyncFilters } from '@/app/server/services/trigger/markdown-notion-sync-task';

/**
 * Triggers the markdown-notion-sync background task.
 * Returns the run ID for tracking progress via realtime subscription.
 *
 * @param filters Filters to control which change types are processed
 * @returns Object with runId or error
 */
export async function triggerMarkdownNotionSync(filters: SyncFilters): Promise<{ runId: string } | { error: string }> {
  try {
    // Check if sync is already running
    const lockStatus = await getSyncLockStatus();
    if (lockStatus.isLocked && lockStatus.triggerRunId) {
      return {
        error: `A sync is already in progress (run ID: ${lockStatus.triggerRunId}). Please wait for it to complete or stop it first.`,
      };
    }

    // Trigger the background task
    const handle = await tasks.trigger<
      typeof import('@/app/server/services/trigger/markdown-notion-sync-task').markdownNotionSyncTask
    >('markdown-notion-sync', { filters } satisfies MarkdownNotionSyncPayload);

    return { runId: handle.id };
  } catch (error) {
    const err = error as Error;
    console.error('Failed to trigger markdown-notion-sync:', err);
    return { error: err.message || 'Failed to start sync' };
  }
}

/**
 * Requests a graceful stop of the current sync operation.
 * The running task will check this flag and stop at the next safe point.
 */
export async function requestSyncStop(): Promise<{ success: boolean; error?: string }> {
  try {
    await requestSyncStopDb();
    return { success: true };
  } catch (error) {
    const err = error as Error;
    console.error('Failed to request sync stop:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Gets the current sync status including lock state and trigger run ID.
 */
export async function getSyncStatus(): Promise<{
  isLocked: boolean;
  lockedAt: string | null;
  triggerRunId: string | null;
  stopRequested: boolean;
}> {
  const status = await getSyncLockStatus();
  return {
    isLocked: status.isLocked,
    lockedAt: status.lockedAt?.toISOString() ?? null,
    triggerRunId: status.triggerRunId,
    stopRequested: status.stopRequested,
  };
}
