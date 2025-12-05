/**
 * Unit tests for sync-lock.ts
 *
 * Tests the sync lock service that manages exclusive access for markdown-to-notion sync operations.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acquireSyncLock,
  getSyncLockStatus,
  isLockExpired,
  isStopRequested,
  releaseSyncLock,
  requestSyncStop,
} from '../sync-lock';

// Mock the Supabase client
const mockSupabase = {
  from: vi.fn(),
};

vi.mock('@/app/server/services/supabase/supabase-client', () => ({
  supabase: () => mockSupabase,
}));

describe('sync-lock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('acquireSyncLock', () => {
    it('successfully acquires lock when unlocked', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockOr = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: 1, is_locked: true },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate,
      });

      mockUpdate.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ or: mockOr });
      mockOr.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ single: mockSingle });

      const result = await acquireSyncLock('test-run-id');

      expect(result).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({
        is_locked: true,
        locked_at: expect.any(String),
        trigger_run_id: 'test-run-id',
        stop_requested: false,
      });
    });

    it('fails to acquire lock when already locked', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockOr = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate,
      });

      mockUpdate.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ or: mockOr });
      mockOr.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ single: mockSingle });

      const result = await acquireSyncLock('test-run-id');

      expect(result).toBe(false);
    });

    it('throws error for unexpected database errors', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockOr = vi.fn().mockReturnThis();
      const mockSelect = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'OTHER_ERROR', message: 'Database error' },
      });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate,
      });

      mockUpdate.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ or: mockOr });
      mockOr.mockReturnValue({ select: mockSelect });
      mockSelect.mockReturnValue({ single: mockSingle });

      await expect(acquireSyncLock('test-run-id')).rejects.toThrow('Failed to acquire sync lock');
    });
  });

  describe('releaseSyncLock', () => {
    it('successfully releases lock with run ID', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const finalMockEq = vi.fn().mockResolvedValue({
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate,
      });

      mockUpdate.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ eq: finalMockEq });

      await releaseSyncLock('test-run-id');

      expect(mockUpdate).toHaveBeenCalledWith({
        is_locked: false,
        locked_at: null,
        trigger_run_id: null,
        stop_requested: false,
      });
      expect(mockEq).toHaveBeenCalledWith('id', 1);
      expect(finalMockEq).toHaveBeenCalledWith('trigger_run_id', 'test-run-id');
    });

    it('successfully releases lock without run ID (force release)', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate,
      });

      mockUpdate.mockReturnValue({ eq: mockEq });

      await releaseSyncLock();

      expect(mockUpdate).toHaveBeenCalledWith({
        is_locked: false,
        locked_at: null,
        trigger_run_id: null,
        stop_requested: false,
      });
      expect(mockEq).toHaveBeenCalledWith('id', 1);
      expect(mockEq).toHaveBeenCalledTimes(1); // Only called once (no trigger_run_id filter)
    });

    it('throws error on database failure', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const finalMockEq = vi.fn().mockResolvedValue({
        error: { message: 'Database error' },
      });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate,
      });

      mockUpdate.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ eq: finalMockEq });

      await expect(releaseSyncLock('test-run-id')).rejects.toThrow('Failed to release sync lock');
    });
  });

  describe('requestSyncStop', () => {
    it('successfully sets stop_requested flag', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const finalMockEq = vi.fn().mockResolvedValue({
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate,
      });
      mockUpdate.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ eq: finalMockEq });

      await requestSyncStop();

      expect(mockUpdate).toHaveBeenCalledWith({ stop_requested: true });
      expect(mockEq).toHaveBeenCalledWith('id', 1);
      expect(finalMockEq).toHaveBeenCalledWith('is_locked', true);
    });

    it('throws error on database failure', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const finalMockEq = vi.fn().mockResolvedValue({
        error: { message: 'Database error' },
      });

      mockSupabase.from.mockReturnValue({
        update: mockUpdate,
      });
      mockUpdate.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ eq: finalMockEq });

      await expect(requestSyncStop()).rejects.toThrow('Failed to request sync stop');
    });
  });

  describe('isStopRequested', () => {
    it('returns true when stop is requested', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: { stop_requested: true },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ single: mockSingle });

      const result = await isStopRequested();

      expect(result).toBe(true);
    });

    it('returns false when stop is not requested', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: { stop_requested: false },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ single: mockSingle });

      const result = await isStopRequested();

      expect(result).toBe(false);
    });

    it('throws error on database failure', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ single: mockSingle });

      await expect(isStopRequested()).rejects.toThrow('Failed to check stop request');
    });
  });

  describe('getSyncLockStatus', () => {
    it('returns lock status when locked', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          is_locked: true,
          locked_at: '2024-01-01T00:00:00Z',
          trigger_run_id: 'test-run-id',
          stop_requested: true,
        },
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ single: mockSingle });

      const result = await getSyncLockStatus();

      expect(result).toEqual({
        isLocked: true,
        lockedAt: new Date('2024-01-01T00:00:00Z'),
        triggerRunId: 'test-run-id',
        stopRequested: true,
        expiresAt: new Date('2024-01-01T06:00:00Z'), // 6 hours after locked_at
      });
    });

    it('returns unlocked status when row does not exist', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' },
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ single: mockSingle });

      const result = await getSyncLockStatus();

      expect(result).toEqual({
        isLocked: false,
        lockedAt: null,
        triggerRunId: null,
        stopRequested: false,
        expiresAt: null,
      });
    });

    it('throws error for unexpected database errors', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'OTHER_ERROR', message: 'Database error' },
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ single: mockSingle });

      await expect(getSyncLockStatus()).rejects.toThrow('Failed to get sync lock status');
    });
  });

  describe('isLockExpired', () => {
    it('returns false for null date', () => {
      expect(isLockExpired(null)).toBe(false);
    });

    it('returns false for recent date', () => {
      const recentDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
      expect(isLockExpired(recentDate)).toBe(false);
    });

    it('returns true for expired date (> 6 hours)', () => {
      const expiredDate = new Date(Date.now() - 1000 * 60 * 60 * 7); // 7 hours ago
      expect(isLockExpired(expiredDate)).toBe(true);
    });

    it('returns false for date exactly at expiry threshold', () => {
      const thresholdDate = new Date(Date.now() - 1000 * 60 * 60 * 6); // Exactly 6 hours ago
      // Should be false because it's not strictly less than the threshold
      expect(isLockExpired(thresholdDate)).toBe(false);
    });
  });
});
