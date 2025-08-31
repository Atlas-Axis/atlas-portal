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
 * @param uuid - UUID without hyphens (e.g., "25ef758464c580f6a11aeab7080d03b1")
 * @returns UUID with hyphens (e.g., "25ef7584-64c5-80f6-a11a-eab7080d03b1")
 */
export const uuidToHyphens = (uuid: string): string => {
  if (uuid.length !== 32) {
    throw new Error('Invalid UUID format: expected 32 characters without hyphens');
  }

  return [uuid.slice(0, 8), uuid.slice(8, 12), uuid.slice(12, 16), uuid.slice(16, 20), uuid.slice(20, 32)].join('-');
};
