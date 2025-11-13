/**
 * Experiment 5: Set Parent Item Relationship via Child Page
 *
 * This script sets the parent-child relationship between two Notion pages
 * by updating the "Parent item" property on the CHILD page (not the parent).
 * This is an alternative approach to experiment2.ts which updates the parent's "Sub-item" property.
 *
 * Usage: npx tsx scripts/experiments/experiment5.ts
 */
import { notion } from '@/app/server/services/notion/notion-client';
import { loadEnv } from '../utils/load-env';

// Configure the parent-child relationship
// Note: Nesting level at 10 may cause issues
const PARENT_NOTION_PAGE_ID = '294f2ff08d73804aa844fbb1fff1398b'; // Demo 10
const CHILD_NOTION_PAGE_ID = '294f2ff08d7380ff88cdfc08a0eb3011'; // Demo 11

// Alternative: Nesting level below 10 (should work reliably)
// const PARENT_NOTION_PAGE_ID = '294f2ff08d7380bd9d89e53ddf7e0c96'; // Demo 8
// const CHILD_NOTION_PAGE_ID = '294f2ff08d73809a86ecdf7d9b05ccbc'; // Demo 9

async function main() {
  const startTime = Date.now();

  // Initialize environment
  loadEnv();

  // Format timestamp for logging
  const now = new Date();
  const dateTimeString = now.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  try {
    // Log operation details
    console.log(`🚀 Setting Parent item relationship...`);
    console.log(`📅 Started at: ${dateTimeString}\n`);
    console.log(`👉 Parent Page ID: ${PARENT_NOTION_PAGE_ID}`);
    console.log(`👉 Child Page ID: ${CHILD_NOTION_PAGE_ID}\n`);

    // Update child page's "Parent item" relation property
    await notion('write').pages.update({
      page_id: CHILD_NOTION_PAGE_ID,
      properties: {
        'Parent item': {
          relation: [
            {
              id: PARENT_NOTION_PAGE_ID,
            },
          ],
        },
      },
    });

    // Log success
    console.log(`✅ Successfully updated Parent item relationship!`);
    console.log(`🔗 Parent page: https://www.notion.so/${PARENT_NOTION_PAGE_ID.replace(/-/g, '')}`);
    console.log(`🔗 Child page: https://www.notion.so/${CHILD_NOTION_PAGE_ID.replace(/-/g, '')}`);

    // Calculate and log execution time
    const endTime = Date.now();
    const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`\n⏰ Total processing time: ${durationSeconds} seconds`);
  } catch (error) {
    console.error('\n❌ Error updating Parent item relationship:', error);
    process.exit(1);
  }
}

// Execute main function
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
