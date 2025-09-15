import { notion } from '@/app/server/services/notion/notion-client';
import { uuidToHyphens } from '@/app/shared/utils/utils';
import { loadEnv } from './utils/load-env';

const NOTION_PAGE_ID = uuidToHyphens('26ff2ff08d73803196d4df2ffa67e699');
const MATH_EQUATION = String.raw`Rfactor = \frac{2u_m - 1}{2u_m \left( u_{opt}(\alpha + 1) - 1 + \frac{\beta u_{opt}}{slope1} \right)}`;

// #!/usr/bin/env node
async function main() {
  const startTime = Date.now();

  // Load environment variables
  loadEnv();

  try {
    console.log('Creating paragraph with inline math equation...');

    // Create a paragraph block with inline equation
    const response = await notion('write').blocks.children.append({
      block_id: NOTION_PAGE_ID,
      children: [
        {
          type: 'paragraph',
          paragraph: {
            rich_text: [
              {
                type: 'text',
                text: {
                  content: 'The risk factor is calculated using the formula: ',
                },
              },
              {
                type: 'equation',
                equation: {
                  expression: MATH_EQUATION,
                },
              },
              {
                type: 'text',
                text: {
                  content: ' for all applicable scenarios.',
                },
              },
            ],
          },
        },
      ],
    });

    const createdBlock = response.results[0];
    if (createdBlock && 'id' in createdBlock) {
      console.log(`✅ Successfully created paragraph with inline equation. Block ID: ${createdBlock.id}`);
      console.log(`📐 Equation content: ${MATH_EQUATION}`);
    } else {
      console.error('❌ Failed to create paragraph block - no ID returned');
    }

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
 * npx tsx scripts/test.ts
 */
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
