/**
 * Tests Notion's database sub-item nesting depth limit by creating nested pages.
 * Creates pages in a database with Parent item relationships to determine the maximum
 * allowed nesting depth before Notion API returns an error.
 *
 * Usage: npx tsx scripts/experiment.ts
 */
import type { CreatePageParameters } from '@notionhq/client/build/src/api-endpoints';
import { notion } from '@/app/server/services/notion/notion-client';
import { loadEnv } from './utils/load-env';

const NOTION_DATABASE_ID = '292f2ff08d7380df9acede66fe5a9d89';
const NESTING_LEVELS = 15;

interface CreatedPage {
  id: string;
  depth: number;
  title: string;
}

interface NotionError {
  code?: string;
  message?: string;
  body?: unknown;
}

async function main() {
  const startTime = Date.now();

  // Load environment variables
  loadEnv();

  // Format timestamp for page titles
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
    console.log(`🚀 Testing Notion sub-item nesting depth limit (max ${NESTING_LEVELS} levels)...`);
    console.log(`📅 Test started at: ${dateTimeString}\n`);

    let currentDepth = 0;
    let parentPageId: string | null = null;
    const createdPages: CreatedPage[] = [];

    // Create nested pages iteratively, each one a child of the previous
    for (let level = 1; level <= NESTING_LEVELS; level++) {
      try {
        console.log(`📝 Creating page at depth ${level}...`);

        // Build page properties with title
        const pageTitle = `Depth ${level} - ${dateTimeString}`;
        const properties: CreatePageParameters['properties'] = {
          Name: {
            title: [
              {
                type: 'text',
                text: {
                  content: pageTitle,
                },
              },
            ],
          },
        };

        // Link to parent page if this isn't the root level
        if (parentPageId) {
          properties['Parent item'] = {
            relation: [
              {
                id: parentPageId,
              },
            ],
          };
        }

        // Create the page in Notion
        const response = await notion('write').pages.create({
          parent: {
            database_id: NOTION_DATABASE_ID,
          },
          properties,
        });

        // Track successful creation
        currentDepth = level;
        createdPages.push({
          id: response.id,
          depth: level,
          title: pageTitle,
        });

        console.log(`  ✅ Created page at depth ${level}`);
        if (parentPageId) {
          console.log(`  🔗 Linked as sub-item of depth ${level - 1} (Parent: ${parentPageId})`);
        }
        console.log('');

        // Set this page as the parent for the next iteration
        parentPageId = response.id;

        // Avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (createError) {
        // Handle nesting depth limit or other errors
        const error = createError as NotionError;
        console.error(`\n❌ Failed to create page at depth ${level}`);
        console.error(`Error type: ${error.code ?? 'unknown'}`);
        console.error(`Error message: ${error.message ?? 'No message'}`);

        if (error.body) {
          console.error(`Full error body:`, JSON.stringify(error.body, null, 2));
        }

        console.log(`\n🛑 Maximum nesting depth reached: ${currentDepth} levels`);
        break;
      }
    }

    // Print test results summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully created: ${createdPages.length} pages`);
    console.log(`🏆 Maximum nesting depth achieved: ${currentDepth} levels`);
    console.log(`\n📋 Created pages:`);

    createdPages.forEach((page) => {
      console.log(`  ${page.depth}. ${page.title}`);
      console.log(`     ID: ${page.id}`);
      console.log(`     URL: https://www.notion.so/${page.id.replace(/-/g, '')}`);
    });

    // Log processing time
    const endTime = Date.now();
    const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`\n⏰ Total processing time: ${durationSeconds} seconds`);
  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  }
}

/**
 * Usage:
 * npx tsx scripts/experiment.ts
 */
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
