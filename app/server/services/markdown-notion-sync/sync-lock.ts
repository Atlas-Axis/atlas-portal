/**
 * Markdown-Notion Sync Lock Service
 *
 * Manages exclusive access for markdown-to-notion sync operations.
 * Uses a single-row table pattern to ensure only one sync can run at a time.
 * Supports graceful stopping via a stop_requested flag.
 */
import { supabase } from '../supabase/supabase-client';

/** Lock expiry time in hours */
const LOCK_EXPIRY_HOURS = 6;

export interface SyncLockStatus {
  isLocked: boolean;
  lockedAt: Date | null;
  triggerRunId: string | null;
  stopRequested: boolean;
}

/**
 * Attempt to acquire the sync lock.
 * Returns true if lock was acquired, false if already locked by another process.
 * Automatically releases stale locks (older than LOCK_EXPIRY_HOURS).
 *
 * @param triggerRunId The Trigger.dev run ID for progress tracking
 */
export async function acquireSyncLock(triggerRunId: string): Promise<boolean> {
  console.log('[SyncLock] Attempting to acquire lock...');
  console.log('[SyncLock] Trigger Run ID:', triggerRunId);

  const now = new Date();
  const expiryThreshold = new Date(now.getTime() - LOCK_EXPIRY_HOURS * 60 * 60 * 1000);

  console.log('[SyncLock] Current time:', now.toISOString());
  console.log('[SyncLock] Expiry threshold (locks older than this will be released):', expiryThreshold.toISOString());
  console.log('[SyncLock] Lock expiry hours:', LOCK_EXPIRY_HOURS);

  // Get current lock status first for debugging
  const currentStatus = await getSyncLockStatus();
  console.log('[SyncLock] Current lock status before acquisition:', {
    isLocked: currentStatus.isLocked,
    lockedAt: currentStatus.lockedAt?.toISOString() ?? null,
    triggerRunId: currentStatus.triggerRunId,
    stopRequested: currentStatus.stopRequested,
    isExpired: currentStatus.lockedAt ? isLockExpired(currentStatus.lockedAt) : false,
  });

  // Try to acquire lock - only succeeds if not locked or lock is expired
  console.log('[SyncLock] Executing UPDATE query to acquire lock...');
  const { data, error } = await supabase()
    .from('markdown_notion_sync_lock')
    .update({
      is_locked: true,
      locked_at: now.toISOString(),
      trigger_run_id: triggerRunId,
      stop_requested: false,
    })
    .eq('id', 1)
    .or(`is_locked.eq.false,locked_at.lt.${expiryThreshold.toISOString()}`)
    .select()
    .single();

  if (error) {
    // PGRST116 means no rows matched (lock is held by another process)
    if (error.code === 'PGRST116') {
      console.error('[SyncLock] Lock acquisition FAILED - lock is held by another process');
      console.error('[SyncLock] Error code:', error.code);
      console.error('[SyncLock] Error:', error);
      return false;
    }
    console.error('[SyncLock] Lock acquisition FAILED with unexpected error:', error);
    throw new Error(`Failed to acquire sync lock: ${error.message}`);
  }

  console.log('[SyncLock] Lock acquisition SUCCESSFUL');
  console.log('[SyncLock] Lock data:', data);
  return data !== null;
}

/**
 * Release the sync lock.
 * Only releases if the lock is held by the specified run ID (or force release).
 *
 * @param triggerRunId The Trigger.dev run ID that holds the lock (optional for force release)
 */
export async function releaseSyncLock(triggerRunId?: string): Promise<void> {
  console.log('[SyncLock] Releasing lock...');
  console.log('[SyncLock] Trigger Run ID (for verification):', triggerRunId ?? 'FORCE RELEASE');

  // Get current status before release
  const currentStatus = await getSyncLockStatus();
  console.log('[SyncLock] Current lock status before release:', {
    isLocked: currentStatus.isLocked,
    lockedAt: currentStatus.lockedAt?.toISOString() ?? null,
    triggerRunId: currentStatus.triggerRunId,
    stopRequested: currentStatus.stopRequested,
  });

  let query = supabase()
    .from('markdown_notion_sync_lock')
    .update({
      is_locked: false,
      locked_at: null,
      trigger_run_id: null,
      stop_requested: false,
    })
    .eq('id', 1);

  // If triggerRunId provided, only release if it matches (safety check)
  if (triggerRunId) {
    console.log('[SyncLock] Adding trigger_run_id match condition for safety');
    query = query.eq('trigger_run_id', triggerRunId);
  } else {
    console.log('[SyncLock] WARNING: Force releasing lock without run ID verification');
  }

  const { error } = await query;

  if (error) {
    console.error('[SyncLock] Lock release FAILED:', error);
    throw new Error(`Failed to release sync lock: ${error.message}`);
  }

  console.log('[SyncLock] Lock released successfully');
}

/**
 * Request a graceful stop of the current sync operation.
 * The running task should check this flag periodically and stop gracefully.
 */
export async function requestSyncStop(): Promise<void> {
  console.log('[SyncLock] Requesting sync stop...');

  const { error } = await supabase()
    .from('markdown_notion_sync_lock')
    .update({ stop_requested: true })
    .eq('id', 1)
    .eq('is_locked', true);

  if (error) {
    console.error('[SyncLock] Failed to request stop:', error);
    throw new Error(`Failed to request sync stop: ${error.message}`);
  }

  console.log('[SyncLock] Stop request recorded successfully');
}

/**
 * Check if a stop has been requested for the current sync.
 */
export async function isStopRequested(): Promise<boolean> {
  const { data, error } = await supabase()
    .from('markdown_notion_sync_lock')
    .select('stop_requested')
    .eq('id', 1)
    .single();

  if (error) {
    console.error('[SyncLock] Failed to check stop request:', error);
    throw new Error(`Failed to check stop request: ${error.message}`);
  }

  const stopRequested = data?.stop_requested ?? false;
  if (stopRequested) {
    console.log('[SyncLock] Stop has been requested');
  }

  return stopRequested;
}

/**
 * Get the current status of the sync lock.
 */
export async function getSyncLockStatus(): Promise<SyncLockStatus & { expiresAt: Date | null }> {
  const { data, error } = await supabase()
    .from('markdown_notion_sync_lock')
    .select('is_locked, locked_at, trigger_run_id, stop_requested')
    .eq('id', 1)
    .single();

  if (error) {
    // If row doesn't exist, return unlocked status
    if (error.code === 'PGRST116') {
      console.log('[SyncLock] Lock row does not exist, returning unlocked status');
      return {
        isLocked: false,
        lockedAt: null,
        triggerRunId: null,
        stopRequested: false,
        expiresAt: null,
      };
    }
    console.error('[SyncLock] Failed to get lock status:', error);
    throw new Error(`Failed to get sync lock status: ${error.message}`);
  }

  const lockedAt = data.locked_at ? new Date(data.locked_at) : null;
  const expiresAt = lockedAt ? new Date(lockedAt.getTime() + LOCK_EXPIRY_HOURS * 60 * 60 * 1000) : null;

  return {
    isLocked: data.is_locked,
    lockedAt,
    triggerRunId: data.trigger_run_id,
    stopRequested: data.stop_requested,
    expiresAt,
  };
}

/**
 * Check if the lock has expired (older than LOCK_EXPIRY_HOURS).
 * Useful for displaying warnings to users.
 */
export function isLockExpired(lockedAt: Date | null): boolean {
  if (!lockedAt) return false;
  const expiryThreshold = new Date(Date.now() - LOCK_EXPIRY_HOURS * 60 * 60 * 1000);
  return lockedAt < expiryThreshold;
}
