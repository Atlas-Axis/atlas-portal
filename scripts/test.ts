import { notion } from '@/app/server/services/notion/notion-client';
import { uuidToHyphens } from '@/app/shared/utils/utils';
import { loadEnv } from './utils/load-env';

const NOTION_PAGE_ID = uuidToHyphens('26ff2ff08d73803196d4df2ffa67e699');
const MATH_EQUATION = String.raw`Rfactor = \frac{2u_m - 1}{2u_m \left( u_{opt}(\alpha + 1) - 1 + \frac{\beta u_{opt}}{slope1} \right)}`;

/**
 * Creates a standalone equation block in Notion.
 *
 * Block equations appear as centered, standalone mathematical expressions
 * on their own line, similar to display math in LaTeX.
 *
 * Notion API Structure:
 * - Uses block type 'equation'
 * - Expression is stored in equation.expression property
 * - Supports full KaTeX syntax for mathematical notation
 *
 * @param pageId - The Notion page ID where the equation block will be added
 * @param expression - KaTeX mathematical expression string
 * @returns Promise resolving to the created block ID
 */
async function createBlockEquation(pageId: string, expression: string): Promise<string> {
  console.log('Creating standalone equation block...');

  const response = await notion('write').blocks.children.append({
    block_id: pageId,
    children: [
      {
        type: 'equation',
        equation: {
          expression: expression,
        },
      },
    ],
  });

  const createdBlock = response.results[0];
  if (createdBlock && 'id' in createdBlock) {
    console.log(`✅ Successfully created equation block with ID: ${createdBlock.id}`);
    return createdBlock.id;
  } else {
    throw new Error('Failed to create equation block - no ID returned');
  }
}

/**
 * Creates an inline equation within a paragraph block in Notion.
 *
 * Inline equations appear within the text flow, allowing mathematical
 * expressions to be embedded naturally within sentences.
 *
 * Notion API Structure:
 * - Uses block type 'paragraph' with rich_text array
 * - Equation is a rich_text item with type 'equation'
 * - Can be mixed with regular text items in the same paragraph
 * - Supports full LaTeX syntax for mathematical notation
 *
 * @param pageId - The Notion page ID where the paragraph will be added
 * @param expression - LaTeX mathematical expression string
 * @param beforeText - Text to appear before the equation (optional)
 * @param afterText - Text to appear after the equation (optional)
 * @returns Promise resolving to the created block ID
 */
async function createInlineEquation(
  pageId: string,
  expression: string,
  beforeText: string = '',
  afterText: string = '',
): Promise<string> {
  console.log('Creating paragraph with inline equation...');

  const richTextItems = [];

  // Add text before equation if provided
  if (beforeText) {
    richTextItems.push({
      type: 'text' as const,
      text: {
        content: beforeText,
      },
    });
  }

  // Add the inline equation
  richTextItems.push({
    type: 'equation' as const,
    equation: {
      expression: expression,
    },
  });

  // Add text after equation if provided
  if (afterText) {
    richTextItems.push({
      type: 'text' as const,
      text: {
        content: afterText,
      },
    });
  }

  const response = await notion('write').blocks.children.append({
    block_id: pageId,
    children: [
      {
        type: 'paragraph',
        paragraph: {
          rich_text: richTextItems,
        },
      },
    ],
  });

  const createdBlock = response.results[0];
  if (createdBlock && 'id' in createdBlock) {
    console.log(`✅ Successfully created paragraph with inline equation. Block ID: ${createdBlock.id}`);
    return createdBlock.id;
  } else {
    throw new Error('Failed to create paragraph block - no ID returned');
  }
}

// #!/usr/bin/env node
async function main() {
  const startTime = Date.now();

  // Load environment variables
  loadEnv();

  try {
    console.log('Creating both inline and block equations...');
    console.log(`📐 Equation: ${MATH_EQUATION}`);

    // Create an inline equation within a paragraph
    const inlineBlockId = await createInlineEquation(
      NOTION_PAGE_ID,
      MATH_EQUATION,
      'The risk factor is calculated using the formula: ',
      ' for all applicable scenarios.',
    );

    // Create a standalone block equation
    const blockEquationId = await createBlockEquation(NOTION_PAGE_ID, MATH_EQUATION);

    console.log(`📊 Summary:`);
    console.log(`  - Inline equation block ID: ${inlineBlockId}`);
    console.log(`  - Block equation ID: ${blockEquationId}`);

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
