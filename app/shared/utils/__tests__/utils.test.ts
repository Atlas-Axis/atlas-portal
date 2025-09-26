import { describe, expect, it } from 'vitest';
import { formatUtcTimestamp, isValidUUID, uuidToHyphens, uuidToNoHyphens } from '../utils';

describe('utils', () => {
  it('converts UUID to no-hyphen format and back', () => {
    const withHyphens = '25ef7584-64c5-80f6-a11a-eab7080d03b1';
    const withoutHyphens = uuidToNoHyphens(withHyphens);
    expect(withoutHyphens).toBe('25ef758464c580f6a11aeab7080d03b1');
    expect(uuidToHyphens(withoutHyphens)).toBe(withHyphens);
  });

  it('validates UUIDs correctly', () => {
    expect(isValidUUID('25ef7584-64c5-80f6-a11a-eab7080d03b1')).toBe(true);
    expect(isValidUUID('invalid-uuid')).toBe(false);
  });

  it('formats UTC timestamp', () => {
    const date = new Date(Date.UTC(2024, 0, 2, 3, 4, 5));
    expect(formatUtcTimestamp(date)).toBe('2024-01-02 03:04:05 UTC');
  });
});
