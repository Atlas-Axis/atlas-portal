/**
 * Detects if the code is using dev Notion IDs based on NODE_ENV.
 * Uses dev IDs in all environments except production.
 * @returns true if using dev Notion IDs (NODE_ENV !== 'production'), false otherwise
 */
export function isUsingDevNotionIds(): boolean {
  return process.env.NODE_ENV !== 'production';
}
