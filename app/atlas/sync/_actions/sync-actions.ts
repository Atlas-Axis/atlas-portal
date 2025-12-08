'use server';

import { tasks } from '@trigger.dev/sdk/v3';
import {
  acquireSyncLock,
  getSyncLockStatus,
  releaseSyncLock,
  requestSyncStop as requestSyncStopDb,
} from '@/app/server/services/markdown-notion-sync';
import type { MarkdownNotionSyncPayload, SyncFilters } from '@/app/server/services/trigger/markdown-notion-sync-task';

// Re-export types for client use
export type { SyncFilters } from '@/app/server/services/trigger/markdown-notion-sync-task';

/**
 * Triggers the markdown-notion-sync background task.
 * Returns the run ID for tracking progress via realtime subscription.
 *
 * Acquires the sync lock BEFORE triggering the task to prevent race conditions
 * where two tasks could be triggered before either acquires the lock.
 * The lock is acquired with a placeholder ID first, then updated with the actual
 * Trigger.dev run ID. The task can safely re-acquire the lock for its own run ID
 * (idempotent lock acquisition).
 *
 * @param filters Filters to control which change types are processed
 * @returns Object with runId or error
 */
export async function triggerMarkdownNotionSync(filters: SyncFilters): Promise<{ runId: string } | { error: string }> {
  // Generate a placeholder run ID for initial lock acquisition
  // The actual Trigger.dev run ID will update this after triggering
  const placeholderRunId = `pending-${Date.now()}`;

  try {
    // Check if sync is already running (informational check before attempting lock)
    const lockStatus = await getSyncLockStatus();
    if (lockStatus.isLocked && lockStatus.triggerRunId) {
      return {
        error: `A sync is already in progress (run ID: ${lockStatus.triggerRunId}). Please wait for it to complete or stop it first.`,
      };
    }

    // Acquire lock BEFORE triggering the task to prevent race conditions
    // This ensures only one task can be triggered at a time
    const lockAcquired = await acquireSyncLock(placeholderRunId);
    if (!lockAcquired) {
      return {
        error: 'Another sync is being started. Please wait a moment and try again.',
      };
    }

    // Trigger the background task
    const payload: MarkdownNotionSyncPayload = { filters };
    let handle;
    try {
      handle = await tasks.trigger<
        typeof import('@/app/server/services/trigger/markdown-notion-sync-task').markdownNotionSyncTask
      >('markdown-notion-sync', payload);
    } catch (triggerError) {
      // If triggering fails, release the lock we acquired
      await releaseSyncLock(placeholderRunId);
      throw triggerError;
    }

    // Update the lock with the actual Trigger.dev run ID
    // The task will also call acquireSyncLock with its run ID, which will succeed
    // because the lock function allows re-acquisition by the same run ID
    await releaseSyncLock(placeholderRunId);
    const reacquired = await acquireSyncLock(handle.id);
    if (!reacquired) {
      // This shouldn't happen, but handle it gracefully
      console.warn('[triggerMarkdownNotionSync] Failed to update lock with actual run ID');
    }

    return { runId: handle.id };
  } catch (error) {
    const err = error as Error;
    console.error('[triggerMarkdownNotionSync] Failed to trigger task:', err.message);
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
