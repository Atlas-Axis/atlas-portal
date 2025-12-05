/**
 * Experiment 7: Overwrite non-existent page mentions with existing page
 *
 * Finds all mention objects in a page that link to a non-existent page ID
 * and overwrites them with a reference to an existing page.
 *
 * Usage: npx tsx scripts/experiments/experiment7.ts
 */
import type { BlockObjectResponse, RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints';
import { notion } from '@/app/server/services/notion/notion-client';
import { uuidToHyphens } from '@/app/shared/utils/utils';
import { loadEnv } from '../utils/load-env';

// Target page to search for mentions
const TARGET_PAGE_ID = uuidToHyphens('2a7f2ff08d738005b4fee7e4f089f03d');

// Non-existent page ID to find and replace
const NON_EXISTENT_PAGE_ID = '00000000-0000-0000-0000-000000000000';

// Existing page ID to replace with
const EXISTING_PAGE_ID = uuidToHyphens('2aef2ff08d73801a9e91e862c7b4fc84');

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
    console.log(`🚀 Overwriting non-existent page mentions...`);
    console.log(`📅 Started at: ${dateTimeString}\n`);
    console.log(`👉 Target Page ID: ${TARGET_PAGE_ID}`);
    console.log(`👉 Find mentions to: ${NON_EXISTENT_PAGE_ID}`);
    console.log(`👉 Replace with: ${EXISTING_PAGE_ID}\n`);

    // Fetch all blocks from the target page
    console.log(`📖 Fetching blocks from target page...`);
    const blocks: BlockObjectResponse[] = [];
    let cursor: string | undefined;

    do {
      const response = await notion().blocks.children.list({
        block_id: TARGET_PAGE_ID,
        start_cursor: cursor,
        page_size: 100,
      });

      for (const block of response.results) {
        if ('type' in block) {
          blocks.push(block as BlockObjectResponse);
        }
      }

      cursor = response.next_cursor || undefined;
    } while (cursor);

    console.log(`Found ${blocks.length} blocks\n`);

    // Find blocks with mentions to the non-existent page
    let updatedCount = 0;

    for (const block of blocks) {
      const blockType = block.type;
      const blockContent = block[blockType as keyof typeof block] as { rich_text?: RichTextItemResponse[] } | undefined;

      if (!blockContent?.rich_text) continue;

      // Check if any rich_text item mentions the non-existent page
      const hasMentionToReplace = blockContent.rich_text.some(
        (item) =>
          item.type === 'mention' && item.mention?.type === 'page' && item.mention.page?.id === NON_EXISTENT_PAGE_ID,
      );

      if (!hasMentionToReplace) continue;

      console.log(`📝 Found block with non-existent mention: ${block.id}`);
      console.log(`   Type: ${blockType}`);

      // Build updated rich_text array with replaced mentions
      const updatedRichText = blockContent.rich_text.map((item) => {
        if (
          item.type === 'mention' &&
          item.mention?.type === 'page' &&
          item.mention.page?.id === NON_EXISTENT_PAGE_ID
        ) {
          // Replace with existing page mention
          return {
            type: 'mention' as const,
            mention: {
              type: 'page' as const,
              page: {
                id: EXISTING_PAGE_ID,
              },
            },
          };
        }
        // Keep other items as-is (simplified - just text content)
        if (item.type === 'text') {
          return {
            type: 'text' as const,
            text: {
              content: item.text.content,
              link: item.text.link,
            },
          };
        }
        // For mentions to other pages, preserve them
        if (item.type === 'mention' && item.mention?.type === 'page') {
          return {
            type: 'mention' as const,
            mention: {
              type: 'page' as const,
              page: {
                id: item.mention.page.id,
              },
            },
          };
        }
        // Fallback: convert to text
        return {
          type: 'text' as const,
          text: {
            content: item.plain_text,
          },
        };
      });

      // Update the block
      await notion().blocks.update({
        block_id: block.id,
        [blockType]: {
          rich_text: updatedRichText,
        },
      });

      console.log(`   ✅ Updated block ${block.id}`);
      updatedCount++;
    }

    console.log(`\n✅ Done! Updated ${updatedCount} blocks`);
    console.log(`🔗 View page: https://www.notion.so/${TARGET_PAGE_ID.replace(/-/g, '')}`);

    // Calculate and log execution time
    const endTime = Date.now();
    const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`\n⏰ Total processing time: ${durationSeconds} seconds`);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

// Execute main function
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
