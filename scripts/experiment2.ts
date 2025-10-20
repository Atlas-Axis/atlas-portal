import { notion } from '@/app/server/services/notion/notion-client';
import { loadEnv } from './utils/load-env';

// Doesn't Work - Nesting level exceeds 10
// const PARENT_NOTION_PAGE_ID = '292f2ff08d73813fa0ebdf4f11519e6d';
// const CHILD_NOTION_PAGE_ID = '292f2ff08d7381db8995d5e19e9c48d5';

// Works - Nesting level is below 10
const PARENT_NOTION_PAGE_ID = '292f2ff08d73800182c7c70db2169c47';
const CHILD_NOTION_PAGE_ID = '292f2ff08d7380a2b615c71d91d84052';

// #!/usr/bin/env node
async function main() {
  const startTime = Date.now();

  // Load environment variables
  loadEnv();

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
    console.log(`🚀 Setting Sub-item relationship...`);
    console.log(`📅 Started at: ${dateTimeString}\n`);
    console.log(`👉 Parent Page ID: ${PARENT_NOTION_PAGE_ID}`);
    console.log(`👉 Child Page ID: ${CHILD_NOTION_PAGE_ID}\n`);

    // Update the parent page to add the child to its Sub-item relation
    await notion('write').pages.update({
      page_id: PARENT_NOTION_PAGE_ID,
      properties: {
        'Sub-item': {
          relation: [
            {
              id: CHILD_NOTION_PAGE_ID,
            },
          ],
        },
      },
    });

    console.log(`✅ Successfully updated Sub-item relationship!`);
    console.log(`🔗 Parent page: https://www.notion.so/${PARENT_NOTION_PAGE_ID.replace(/-/g, '')}`);
    console.log(`🔗 Child page: https://www.notion.so/${CHILD_NOTION_PAGE_ID.replace(/-/g, '')}`);

    // Log processing time
    const endTime = Date.now();
    const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`\n⏰ Total processing time: ${durationSeconds} seconds`);
  } catch (error) {
    console.error('\n❌ Error updating Sub-item relationship:', error);
    process.exit(1);
  }
}

/**
 * Usage:
 * npx tsx scripts/experiment2.ts
 */
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
