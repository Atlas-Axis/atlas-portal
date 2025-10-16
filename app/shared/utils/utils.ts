import clsx, { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Converts a UUID from hyphen format to no-hyphen format
 * @param uuid - UUID with hyphens (e.g., "25ef7584-64c5-80f6-a11a-eab7080d03b1")
 * @returns UUID without hyphens (e.g., "25ef758464c580f6a11aeab7080d03b1")
 */
export const uuidToNoHyphens = (uuid: string): string => {
  return uuid.replace(/-/g, '');
};

/**
 * Converts a UUID from no-hyphen format to hyphen format
 * @param uuid - UUID without hyphens (e.g., "25ef758464c580f6a11aeab7080d03b1") or with hyphens (returns as-is if valid)
 * @returns UUID with hyphens (e.g., "25ef7584-64c5-80f6-a11a-eab7080d03b1")
 */
export const uuidToHyphens = (uuid: string): string => {
  // If already in hyphen format and valid, return as-is
  if (isValidUUID(uuid)) return uuid;

  // Otherwise, expect no-hyphen format
  if (uuid.length !== 32) {
    throw new Error(`Invalid UUID format: expected 32 characters without hyphens or valid hyphenated UUID (${uuid})`);
  }

  return [uuid.slice(0, 8), uuid.slice(8, 12), uuid.slice(12, 16), uuid.slice(16, 20), uuid.slice(20, 32)].join('-');
};

export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

/**
 * Formats a Date object as a human-readable UTC timestamp
 * @param date - Date object to format (defaults to current time)
 * @returns Formatted string in "YYYY-MM-DD HH:MM:SS UTC" format
 */
export const formatUtcTimestamp = (date: Date = new Date()): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
