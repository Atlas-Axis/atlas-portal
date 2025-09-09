import type { PageObjectResponse } from '@notionhq/client';

/**
 * Check if a Notion page needs to be synced based on its last_edited_time
 * compared to the existing page's updated_at timestamp in Supabase
 */
export function checkPageNeedsSync(notionPage: PageObjectResponse, existingUpdatedAt: string | null): boolean {
  // If no existing record, page needs to be synced
  if (!existingUpdatedAt) {
    return true;
  }

  // Convert timestamps to Date objects for comparison
  const notionLastEdited = new Date(notionPage.last_edited_time);
  const supabaseUpdatedAt = new Date(existingUpdatedAt);

  // Round down both timestamps to nearest minute (same as Notion API does)
  notionLastEdited.setSeconds(0, 0);
  supabaseUpdatedAt.setSeconds(0, 0);

  // Page needs sync if Notion's last_edited_time is newer than or equal to Supabase's updated_at
  return notionLastEdited >= supabaseUpdatedAt;
}

/**
 * Filter Notion pages to only include those that need syncing
 */
export function filterPagesNeedingSync(
  notionPages: PageObjectResponse[],
  existingPagesFromSupabaseByNotionId: Map<string, { updated_at: string }>,
): PageObjectResponse[] {
  return notionPages.filter((page) => {
    const existingPage = existingPagesFromSupabaseByNotionId.get(page.id);
    return checkPageNeedsSync(page, existingPage?.updated_at || null);
  });
}
