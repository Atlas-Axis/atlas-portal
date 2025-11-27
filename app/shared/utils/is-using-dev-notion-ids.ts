/**
 * Detects if the code is using dev Notion IDs
 * @returns true if using dev Notion IDs, false otherwise
 */
export function isUsingDevNotionIds(): boolean {
  return process.env.USE_DEV_NOTION_IDS === 'true';
}
