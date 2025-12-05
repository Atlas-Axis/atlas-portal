/**
 * Experiment 6: Test Notion mention behavior with non-existent page
 *
 * Tests what happens when creating a "mention" block that links to a
 * Notion page that doesn't exist. Will it create plain text? A mention object?
 *
 * Usage: npx tsx scripts/experiments/experiment6.ts
 */
import { notion } from '@/app/server/services/notion/notion-client';
import { uuidToHyphens } from '@/app/shared/utils/utils';
import { loadEnv } from '../utils/load-env';

// Target page to append the block to (existing page)
const TARGET_PAGE_ID = uuidToHyphens('2a7f2ff08d738005b4fee7e4f089f03d');

// Non-existent page ID to mention (made up UUID)
const NON_EXISTENT_PAGE_ID = '00000000-0000-0000-0000-000000000000';

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
    console.log(`🚀 Testing Notion mention behavior with non-existent page...`);
    console.log(`📅 Started at: ${dateTimeString}\n`);
    console.log(`👉 Target Page ID (existing): ${TARGET_PAGE_ID}`);
    console.log(`👉 Mention Page ID (non-existent): ${NON_EXISTENT_PAGE_ID}\n`);

    // Append a paragraph block with a mention to a non-existent page
    console.log(`📝 Appending paragraph block with mention...`);

    const response = await notion().blocks.children.append({
      block_id: TARGET_PAGE_ID,
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: `[${dateTimeString}] Test mention to non-existent page: `,
                },
              },
              {
                type: 'mention',
                mention: {
                  type: 'page',
                  page: {
                    id: NON_EXISTENT_PAGE_ID,
                  },
                },
              },
              {
                type: 'text',
                text: {
                  content: ' - end of test',
                },
              },
            ],
          },
        },
      ],
    });

    console.log(`✅ Block created successfully!`);
    console.log(`\n📋 Response:`);
    console.log(JSON.stringify(response, null, 2));

    // Log the target page URL
    console.log(`\n🔗 View page: https://www.notion.so/${TARGET_PAGE_ID.replace(/-/g, '')}`);

    // Calculate and log execution time
    const endTime = Date.now();
    const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`\n⏰ Total processing time: ${durationSeconds} seconds`);
  } catch (error) {
    console.error('\n❌ Error creating mention block:');
    console.error(error);
    process.exit(1);
  }
}

// Execute main function
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
