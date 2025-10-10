/*
  Markdown → Notion Rich Text converter
  - Supports: inline code, bold, italic, strikethrough, links
  - Converts Markdown to Notion's Rich Text format
  - Handles multiline inline code by preserving line breaks
  - Output is Notion Rich Text format for single blocks

  Example usage:
  ```ts
  import { convertMarkdownToNotionRichText } from '@/app/server/markdown';

  // Convert inline markdown to rich text
  const richText = convertMarkdownToNotionRichText('Hello **World** and `code`');
  // => [{ type: 'text', text: { content: 'Hello ' }, annotations: {} }, ...]
  ```
*/
import { CreateRichTextOptions, NotionAnnotations, NotionRichText } from './notion-types';

// Simple markdown parser - we'll implement a basic one for now
// In a more complex environment, we might want to use a library like 'remark' or 'marked'

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
] as const;

/**
 * Parse inline markdown formatting within text and convert to Notion Rich Text
 * Handles bold, italic, strikethrough, inline code, links
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

  // First, find all code blocks to exclude other patterns from being processed inside them
  const codeBlocks: Array<{ start: number; end: number }> = [];
  const codePattern = INLINE_PATTERNS.find((p) => p.type === 'code');
  if (codePattern) {
    let match;
    codePattern.regex.lastIndex = 0;
    while ((match = codePattern.regex.exec(text)) !== null) {
      // Prevent infinite loops on zero-length matches
      if (match.index === codePattern.regex.lastIndex) {
        codePattern.regex.lastIndex++;
        continue;
      }

      codeBlocks.push({
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  // Helper function to check if a position is inside any code block
  const isInsideCodeBlock = (start: number, end: number): boolean => {
    return codeBlocks.some((block) => start >= block.start && end <= block.end);
  };

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

      const matchStart = match.index;
      const matchEnd = match.index + match[0].length;

      // Skip this match if it's inside a code block (except for code patterns themselves)
      if (pattern.type !== 'code' && isInsideCodeBlock(matchStart, matchEnd)) {
        continue;
      }

      matches.push({
        start: matchStart, // Start position
        end: matchEnd, // End position
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
    if (match.type === 'link') {
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
 */
function createRichText(options: CreateRichTextOptions): NotionRichText {
  const { content, annotations = {}, href } = options;

  // Don't unescape content - let it pass through as-is
  // This prevents double-escaping issues and maintains consistency
  const unescapedContent = content;

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
 * Convert inline markdown text to Notion Rich Text format
 * Handles formatting like bold, italic, links, inline code
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

// Export object containing all conversion functions
const MarkdownToNotion = {
  convertMarkdownToNotionRichText,
};

export default MarkdownToNotion;
