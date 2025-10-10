import { notion } from '@/app/server/services/notion/notion-client';
import { loadEnv } from './utils/load-env';

const NOTION_DATABASE_ID = '288f2ff08d73804fa179ef76388d6d26';

// #!/usr/bin/env node
async function main() {
  const startTime = Date.now();

  // Load environment variables
  loadEnv();

  try {
    console.log('🚀 Creating a new page in Notion database...');

    // Create a new page in the database with rich text content
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

    const response = await notion('write').pages.create({
      parent: {
        database_id: NOTION_DATABASE_ID,
      },
      properties: {
        Name: {
          title: [
            {
              type: 'text',
              text: {
                content: `Test ${dateTimeString}`,
              },
            },
          ],
        },
        Content: {
          rich_text: [
            {
              type: 'text',
              text: {
                content: 'This is a demo page created via the Notion API! 🎉',
              },
              annotations: {
                bold: true,
                italic: false,
                strikethrough: false,
                underline: false,
                code: false,
                color: 'blue',
              },
            },
            {
              type: 'text',
              text: {
                content: '\n\nThis page demonstrates rich text formatting with multiple styles.',
              },
              annotations: {
                bold: false,
                italic: true,
                strikethrough: false,
                underline: false,
                code: false,
                color: 'default',
              },
            },
            {
              type: 'text',
              text: {
                content: '\n\nHere are some features:',
              },
              annotations: {
                bold: true,
                italic: false,
                strikethrough: false,
                underline: false,
                code: false,
                color: 'default',
              },
            },
            {
              type: 'text',
              text: {
                content: '\n• Bold text',
              },
              annotations: {
                bold: true,
                italic: false,
                strikethrough: false,
                underline: false,
                code: false,
                color: 'default',
              },
            },
            {
              type: 'text',
              text: {
                content: '\n• Italic text',
              },
              annotations: {
                bold: false,
                italic: true,
                strikethrough: false,
                underline: false,
                code: false,
                color: 'default',
              },
            },
            {
              type: 'text',
              text: {
                content: '\n• Code text',
              },
              annotations: {
                bold: false,
                italic: false,
                strikethrough: false,
                underline: false,
                code: true,
                color: 'default',
              },
            },
            {
              type: 'text',
              text: {
                content: '\n• Colored text',
              },
              annotations: {
                bold: false,
                italic: false,
                strikethrough: false,
                underline: false,
                code: false,
                color: 'green',
              },
            },
          ],
        },
      },
    });

    console.log('✅ Page created successfully!');
    console.log(`📄 Page ID: ${response.id}`);
    console.log(`🔗 Page URL: https://www.notion.so/${response.id}`);

    // Log processing time
    const endTime = Date.now();
    const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`⏰ Processing time: ${durationSeconds} seconds`);
  } catch (error) {
    console.error('Error:', error);
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
