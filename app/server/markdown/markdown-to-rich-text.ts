/*
  Markdown → Notion Rich Text/Blocks converter
  - Supports: paragraph, inline code, code block, equation, link, lists, table/table_row
  - Converts Markdown to Notion's Rich Text format
  - Handles multiline inline code by preserving line breaks
  - Output is Notion Rich Text/Blocks format

  Example usage:
  ```ts
  import { convertMarkdownToNotionRichText, convertMarkdownToNotionBlocks } from '@/app/server/markdown';

  // Convert inline markdown to rich text
  const richText = convertMarkdownToNotionRichText('Hello **World** and `code`');
  // => [{ type: 'text', text: { content: 'Hello ' }, annotations: {} }, ...]

  // Convert full markdown to blocks
  const blocks = convertMarkdownToNotionBlocks('# Heading\n\nSome text');
  // => [{ type: 'heading_1', heading_1: { rich_text: [...] } }, ...]
  ```
*/
import {
  CreateBlockOptions,
  CreateRichTextOptions,
  NotionAnnotations,
  NotionBlock,
  NotionRichText,
} from './notion-types';

// Simple markdown parser - we'll implement a basic one for now
// In a more complex environment, we might want to use a library like 'remark' or 'marked'

// Define the types of markdown nodes we can parse
type MarkdownNodeType =
  | 'paragraph'
  | 'heading_1'
  | 'heading_2'
  | 'heading_3'
  | 'code_block'
  | 'equation_block'
  | 'table'
  | 'bulleted_list_item'
  | 'numbered_list_item';

// Interface representing a parsed markdown element
interface MarkdownNode {
  type: MarkdownNodeType; // The type of markdown element
  content?: string; // Text content of the element
  children?: MarkdownNode[]; // Nested elements (for lists, etc.)
  level?: number; // Indentation level (for lists)
  language?: string; // Programming language (for code blocks)
  url?: string; // URL for links
  title?: string; // Title for links
  ordered?: boolean; // Whether this is an ordered list item
  start?: number; // Starting number for ordered lists
  align?: string[]; // Column alignment for tables
  header?: string[]; // Table header row
  rows?: string[][]; // Table data rows
}

/**
 * Parse markdown text into a structured tree of MarkdownNode objects
 * This is a simple line-by-line parser that handles basic markdown syntax
 *
 * @param markdown - The markdown text to parse
 * @returns Array of parsed MarkdownNode objects
 * @throws {Error} If markdown is not a string or contains invalid syntax
 */
function parseMarkdown(markdown: string): MarkdownNode[] {
  // Input validation
  if (typeof markdown !== 'string') {
    throw new Error('Markdown must be a string');
  }

  // Handle empty input
  if (!markdown || markdown.trim() === '') {
    return [];
  }

  const lines = markdown.split('\n'); // Split input into individual lines
  const nodes: MarkdownNode[] = []; // Array to store parsed nodes
  let i = 0; // Current line index

  // Process each line sequentially
  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Parse headings (# ## ###)
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length; // Number of # characters
      // Convert to specific heading types (we only support h1-h3)
      // Levels 4-6 should be treated as paragraphs since Notion only supports 3 heading levels
      if (level <= 3) {
        const headingType = level === 1 ? 'heading_1' : level === 2 ? 'heading_2' : 'heading_3';
        nodes.push({
          type: headingType,
          content: headingMatch[2], // The heading text (after the #)
          level,
        });
      } else {
        // Treat H4-H6 as paragraphs (preserve the # symbols)
        nodes.push({
          type: 'paragraph',
          content: line, // Keep the original line with # symbols
        });
      }
      i++;
      continue;
    }

    // Parse code blocks (```language ... ```)
    if (line.startsWith('```')) {
      const language = line.slice(3).trim(); // Extract language from ```lang
      const codeLines: string[] = [];
      i++; // Move to next line

      // Collect all lines until we find the closing ```
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }

      nodes.push({
        type: 'code_block',
        content: codeLines.join('\n') + '\n', // Preserve trailing newline
        language: language || undefined, // Store language if specified
      });
      i++; // Skip the closing ```
      continue;
    }

    // Parse math blocks ($$...$$)
    if (line.startsWith('$$') && line.endsWith('$$') && line.length > 4) {
      nodes.push({
        type: 'equation_block',
        content: line.slice(2, -2), // Remove the $$ delimiters
      });
      i++;
      continue;
    }

    // Parse tables (| col1 | col2 |)
    if (line.includes('|')) {
      const tableRows: string[][] = [];
      let headerRow: string[] | null = null;
      let separatorRow: string[] | null = null;

      // Collect all consecutive table rows
      while (i < lines.length && lines[i].includes('|')) {
        const row = lines[i]
          .split('|') // Split by pipe character
          .map((cell) => cell.trim()) // Trim whitespace from each cell
          .filter((cell) => cell !== ''); // Remove empty cells
        tableRows.push(row);
        i++;
      }

      // Process table if we have at least 2 rows
      if (tableRows.length >= 2) {
        headerRow = tableRows[0]; // First row is potential header
        separatorRow = tableRows[1]; // Second row is separator
        const dataRows = tableRows.slice(2); // Remaining rows are data

        // Check if separator row contains dashes (indicates header)
        const hasHeader = separatorRow.some((cell) => cell.includes('-'));

        nodes.push({
          type: 'table',
          header: hasHeader ? headerRow : undefined, // Include header if detected
          rows: hasHeader ? dataRows : tableRows, // Data rows or all rows
        });
      }
      continue;
    }

    // Parse lists (- item, * item, 1. item)
    const listMatch = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
    if (listMatch) {
      const indent = listMatch[1].length; // Number of leading spaces
      const marker = listMatch[2]; // List marker (-, *, +, or 1.)
      const content = listMatch[3]; // List item content
      const ordered = !isNaN(parseInt(marker)); // Check if it's a numbered list

      nodes.push({
        type: ordered ? 'numbered_list_item' : 'bulleted_list_item',
        content,
        ordered,
        level: Math.floor(indent / 2), // Convert spaces to indentation level
      });
      i++;
      continue;
    }

    // Default to paragraph for any unmatched line
    nodes.push({
      type: 'paragraph',
      content: line,
    });
    i++;
  }

  return nodes;
}

// Pre-compiled regex patterns for better performance
const INLINE_PATTERNS = [
  // Inline code (must come before other patterns to avoid conflicts)
  { regex: /`([^`]+)`/g, type: 'code' as const },
  // Bold text (must come before italic to avoid conflicts)
  { regex: /\*\*([^*]+)\*\*/g, type: 'bold' as const },
  // Italic text
  { regex: /\*([^*]+)\*/g, type: 'italic' as const },
  // Strikethrough text
  { regex: /~~([^~]+)~~/g, type: 'strikethrough' as const },
  // Links [text](url)
  { regex: /\[([^\]]+)\]\(([^)]+)\)/g, type: 'link' as const },
  // Inline math expressions $formula$ (but not $$ which is block math)
  // DISABLED: This regex causes false positives with literal $ characters in text
  // The content contains literal $ characters that are not math expressions
  // Only match $...$ patterns that contain actual mathematical expressions
  // { regex: /\$(?!\$)([^$\n]*?[a-zA-Z0-9\s\+\-\*\/\=\<\>\(\)\[\]\{\}]+?)\$/g, type: 'equation' as const },
] as const;

/**
 * Parse inline markdown formatting within text and convert to Notion Rich Text
 * Handles bold, italic, strikethrough, inline code, links, and math expressions
 *
 * @param text - The markdown text to parse
 * @returns Array of Notion Rich Text objects
 * @throws {Error} If text contains invalid markdown syntax
 */
function parseInlineMarkdown(text: string): NotionRichText[] {
  // Input validation
  if (typeof text !== 'string') {
    throw new Error('Text must be a string');
  }

  // Return empty array for empty or whitespace-only text
  if (!text || text.trim() === '') {
    return [];
  }

  const richText: NotionRichText[] = [];

  // Array to store all found formatting matches
  const matches: Array<{
    start: number; // Start position in text
    end: number; // End position in text
    type: string; // Type of formatting (bold, italic, etc.)
    content: string; // The formatted content
    url?: string; // URL for links
  }> = [];

  // Find all formatting matches using pre-compiled regex patterns
  INLINE_PATTERNS.forEach((pattern) => {
    let match;
    // Reset regex lastIndex to ensure consistent behavior
    pattern.regex.lastIndex = 0;
    while ((match = pattern.regex.exec(text)) !== null) {
      // Prevent infinite loops on zero-length matches
      if (match.index === pattern.regex.lastIndex) {
        pattern.regex.lastIndex++;
        continue;
      }

      matches.push({
        start: match.index, // Start position
        end: match.index + match[0].length, // End position
        type: pattern.type, // Formatting type
        content: match[1], // Captured content
        url: pattern.type === 'link' ? match[2] : undefined, // URL for links
      });
    }
  });

  // Sort matches by start position to process them in order
  matches.sort((a, b) => a.start - b.start);

  // Process text segments in order
  let lastEnd = 0; // Track where we left off processing

  for (const match of matches) {
    // Add any plain text that comes before this match
    if (match.start > lastEnd) {
      const beforeText = text.slice(lastEnd, match.start);
      if (beforeText) {
        richText.push(createRichText({ content: beforeText }));
      }
    }

    // Create annotations object for the formatted text
    const annotations: NotionAnnotations = {};
    if (match.type === 'code') annotations.code = true;
    if (match.type === 'bold') annotations.bold = true;
    if (match.type === 'italic') annotations.italic = true;
    if (match.type === 'strikethrough') annotations.strikethrough = true;

    // Handle special cases that need different Notion Rich Text structures
    if (match.type === 'equation') {
      // Math expressions become equation objects
      richText.push({
        type: 'equation',
        equation: { expression: match.content },
        plain_text: match.content,
        annotations: {},
      });
    } else if (match.type === 'link') {
      // Check if this is a mention (UUID-only href) vs external link
      const isMention = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(match.url!);

      if (isMention) {
        // This is a mention - create mention object
        richText.push({
          type: 'mention',
          mention: {
            page: {
              id: match.url!,
            },
            type: 'page',
          },
          plain_text: match.content,
          href: match.url!,
          annotations,
        });
      } else {
        // This is an external link - use createRichText for consistent annotation handling
        richText.push(
          createRichText({
            content: match.content,
            href: match.url!,
            annotations,
          }),
        );
      }
    } else {
      // Regular formatted text (bold, italic, etc.) - use createRichText for consistency
      richText.push(
        createRichText({
          content: match.content,
          annotations,
        }),
      );
    }

    lastEnd = match.end; // Update our position
  }

  // Add any remaining plain text after the last match
  if (lastEnd < text.length) {
    const remainingText = text.slice(lastEnd);
    if (remainingText) {
      richText.push(createRichText({ content: remainingText }));
    }
  }

  // Return the rich text array, or a single plain text element if no formatting found
  return richText.length > 0 ? richText : [createRichText({ content: text })];
}

/**
 * Helper function to create a Notion Rich Text object
 * Handles both regular text and equation types
 */
function createRichText(options: CreateRichTextOptions): NotionRichText {
  const { content, annotations = {}, href, type = 'text', equation } = options;

  // Don't unescape content - let it pass through as-is
  // This prevents double-escaping issues and maintains consistency
  const unescapedContent = content;

  // Handle equation type specially
  if (type === 'equation') {
    return {
      type: 'equation',
      equation: equation || { expression: unescapedContent },
      plain_text: unescapedContent,
      annotations: {},
    };
  }

  // Normalize annotations to match Notion's explicit default format
  const normalizedAnnotations: NotionAnnotations = {
    bold: annotations.bold || false,
    code: annotations.code || false,
    // Normalize color values - both 'default' and 'default_background' are equivalent
    color: annotations.color === 'default_background' ? 'default' : annotations.color || 'default',
    italic: annotations.italic || false,
    underline: annotations.underline || false,
    strikethrough: annotations.strikethrough || false,
  };

  // Create regular text rich text object
  return {
    type: 'text',
    text: { content: unescapedContent, link: href ? { url: href } : null },
    plain_text: unescapedContent,
    href: href || null,
    annotations: normalizedAnnotations,
  };
}

/**
 * Helper function to create a Notion Block object
 * Handles different block types with their specific properties
 */
function createBlock(options: CreateBlockOptions): NotionBlock {
  const { type, rich_text, language, expression, children, table, table_row } = options;

  const block: NotionBlock = { type };

  // Handle blocks that contain rich text
  if (rich_text) {
    if (type.startsWith('heading_')) {
      // Headings use the type as the property name (heading_1, heading_2, etc.)
      block[type] = { rich_text };
    } else if (type === 'paragraph') {
      block.paragraph = { rich_text };
    } else if (type === 'bulleted_list_item') {
      block.bulleted_list_item = { rich_text, children };
    } else if (type === 'numbered_list_item') {
      block.numbered_list_item = { rich_text, children };
    }
  }

  // Handle code blocks with language specification
  if (type === 'code') {
    block.code = { rich_text: rich_text || [], language };
  }

  // Handle equation blocks
  if (type === 'equation') {
    block.equation = { expression: expression || '' };
  }

  // Handle table blocks
  if (type === 'table') {
    block.table = table;
  }

  // Handle table row blocks
  if (type === 'table_row') {
    block.table_row = table_row;
  }

  return block;
}

/**
 * Convert inline markdown text to Notion Rich Text format
 * Handles formatting like bold, italic, links, inline code, and math
 *
 * @param markdown - The markdown text to convert
 * @returns Array of Notion Rich Text objects
 * @throws {Error} If markdown is invalid or parsing fails
 */
export function convertMarkdownToNotionRichText(markdown: string): NotionRichText[] {
  try {
    // Return empty array for empty input
    if (!markdown || markdown.trim() === '') {
      return [];
    }


    return parseInlineMarkdown(markdown);
  } catch (error) {
    throw new Error(
      `Failed to convert markdown to rich text: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Convert full markdown document to Notion Blocks format
 * Handles all block types including headings, paragraphs, lists, tables, code blocks, and equations
 *
 * @param markdown - The markdown document to convert
 * @returns Array of Notion Block objects
 * @throws {Error} If markdown is invalid or parsing fails
 */
export function convertMarkdownToNotionBlocks(markdown: string): NotionBlock[] {
  try {
    // Return empty array for empty input
    if (!markdown || markdown.trim() === '') {
      return [];
    }

    // Parse the markdown into structured nodes
    const nodes = parseMarkdown(markdown);
    const blocks: NotionBlock[] = [];

    // Convert each parsed node to a Notion block
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      switch (node.type) {
        case 'paragraph': {
          // Parse inline formatting within the paragraph
          const richText = parseInlineMarkdown(node.content || '');
          blocks.push(createBlock({ type: 'paragraph', rich_text: richText }));
          break;
        }

        case 'heading_1':
        case 'heading_2':
        case 'heading_3': {
          // Parse inline formatting within the heading
          const richText = parseInlineMarkdown(node.content || '');
          blocks.push(createBlock({ type: node.type, rich_text: richText }));
          break;
        }

        case 'code_block': {
          // Code blocks contain plain text (no inline formatting)
          const richText = [createRichText({ content: node.content || '' })];
          blocks.push(
            createBlock({
              type: 'code',
              rich_text: richText,
              language: node.language, // Programming language
            }),
          );
          break;
        }

        case 'equation_block': {
          // Math equations become equation blocks
          blocks.push(
            createBlock({
              type: 'equation',
              expression: node.content || '',
            }),
          );
          break;
        }

        case 'bulleted_list_item':
        case 'numbered_list_item': {
          // Parse inline formatting within list items
          const richText = parseInlineMarkdown(node.content || '');
          blocks.push(
            createBlock({
              type: node.type,
              rich_text: richText,
            }),
          );
          break;
        }

        case 'table': {
          const tableRows: NotionBlock[] = [];

          // Create header row if present
          if (node.header) {
            const headerCells = node.header.map((cell) => parseInlineMarkdown(cell));
            tableRows.push(
              createBlock({
                type: 'table_row',
                table_row: { cells: headerCells },
              }),
            );
          }

          // Create data rows
          if (node.rows) {
            for (const row of node.rows) {
              const cells = row.map((cell) => parseInlineMarkdown(cell));
              tableRows.push(
                createBlock({
                  type: 'table_row',
                  table_row: { cells },
                }),
              );
            }
          }

          // Create the table block with all rows
          blocks.push(
            createBlock({
              type: 'table',
              table: {
                has_column_header: !!node.header, // Whether table has headers
                has_row_header: false, // We don't support row headers
                children: tableRows, // All table rows
              },
            }),
          );
          break;
        }

        default: {
          // Fallback: treat unknown types as paragraphs
          const richText = parseInlineMarkdown(node.content || '');
          blocks.push(createBlock({ type: 'paragraph', rich_text: richText }));
          break;
        }
      }
    }

    return blocks;
  } catch (error) {
    throw new Error(
      `Failed to convert markdown to blocks: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

// Export object containing all conversion functions
const MarkdownToNotion = {
  convertMarkdownToNotionRichText,
  convertMarkdownToNotionBlocks,
};

export default MarkdownToNotion;
