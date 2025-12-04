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
    console.log('[triggerMarkdownNotionSync] Starting sync trigger process');
    console.log('[triggerMarkdownNotionSync] Filters:', JSON.stringify(filters, null, 2));

    // Check environment variables
    const hasTriggerKey = !!process.env.TRIGGER_SECRET_KEY;
    console.log('[triggerMarkdownNotionSync] Environment check:');
    console.log('  - TRIGGER_SECRET_KEY present:', hasTriggerKey);
    console.log('  - NODE_ENV:', process.env.NODE_ENV);

    if (!hasTriggerKey) {
      console.error('[triggerMarkdownNotionSync] WARNING: TRIGGER_SECRET_KEY not found in environment');
    }

    // Check if sync is already running
    console.log('[triggerMarkdownNotionSync] Checking for existing sync lock...');
    const lockStatus = await getSyncLockStatus();
    console.log('[triggerMarkdownNotionSync] Lock status:', {
      isLocked: lockStatus.isLocked,
      triggerRunId: lockStatus.triggerRunId,
      lockedAt: lockStatus.lockedAt,
      stopRequested: lockStatus.stopRequested,
    });

    if (lockStatus.isLocked && lockStatus.triggerRunId) {
      console.log('[triggerMarkdownNotionSync] Sync already in progress, returning error');
      return {
        error: `A sync is already in progress (run ID: ${lockStatus.triggerRunId}). Please wait for it to complete or stop it first.`,
      };
    }

    // Trigger the background task
    console.log('[triggerMarkdownNotionSync] Triggering task "markdown-notion-sync"...');
    const payload: MarkdownNotionSyncPayload = { filters };
    console.log('[triggerMarkdownNotionSync] Payload:', JSON.stringify(payload, null, 2));

    const handle = await tasks.trigger<
      typeof import('@/app/server/services/trigger/markdown-notion-sync-task').markdownNotionSyncTask
    >('markdown-notion-sync', payload);

    console.log('[triggerMarkdownNotionSync] Task triggered successfully!');
    console.log('[triggerMarkdownNotionSync] Handle:', {
      id: handle.id,
      publicAccessToken: handle.publicAccessToken ? '[PRESENT]' : '[MISSING]',
    });

    return { runId: handle.id };
  } catch (error) {
    const err = error as Error;
    console.error('[triggerMarkdownNotionSync] ERROR triggering task:', err);
    console.error('[triggerMarkdownNotionSync] Error details:', {
      name: err.name,
      message: err.message,
      stack: err.stack,
    });
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
  console.log('[getSyncStatus] Fetching sync lock status...');
  const status = await getSyncLockStatus();
  console.log('[getSyncStatus] Status fetched:', {
    isLocked: status.isLocked,
    lockedAt: status.lockedAt?.toISOString() ?? null,
    triggerRunId: status.triggerRunId,
    stopRequested: status.stopRequested,
    expiresAt: status.expiresAt?.toISOString() ?? null,
  });

  return {
    isLocked: status.isLocked,
    lockedAt: status.lockedAt?.toISOString() ?? null,
    triggerRunId: status.triggerRunId,
    stopRequested: status.stopRequested,
  };
}
