/*
  Markdown → Notion Rich Text converter
  - Supports: inline code, bold, italic, strikethrough, links
  - Converts Markdown to Notion's Rich Text format
  - Handles multiline inline code by preserving line breaks
  - Output is Notion Rich Text format for single blocks
  - Automatically splits text exceeding Notion's 2000-character limit per element
  - Automatically limits array to 100 elements (Notion API limit) by merging and truncating

  Example usage:
  ```ts
  import { convertMarkdownToNotionRichText } from '@/app/server/markdown';

  // Convert inline markdown to rich text
  const richText = convertMarkdownToNotionRichText('Hello **World** and `code`');
  // => [{ type: 'text', text: { content: 'Hello ' }, annotations: {} }, ...]
  ```
*/
import { uuidToNoHyphens } from '@/app/shared/utils/utils';
import { UuidMappings } from '../atlas/load-uuid-mapping';
import { CreateRichTextOptions, NotionAnnotations, NotionRichText } from './notion-types';

/**
 * Represents a warning generated during content conversion.
 * These warnings indicate potential data loss or issues that should be surfaced to users.
 */
export interface ContentConversionWarning {
  type: 'truncation' | 'missing_mapping';
  message: string;
  originalCount?: number;
  truncatedTo?: number;
}

/**
 * Maximum character length for a single Notion rich text element's text.content field.
 * Notion API rejects requests where any rich text element exceeds this limit.
 */
export const NOTION_RICH_TEXT_MAX_LENGTH = 2000;

/**
 * Maximum number of elements in a rich_text array.
 * Notion API rejects requests where the array exceeds this limit.
 */
export const NOTION_RICH_TEXT_MAX_ELEMENTS = 100;

/**
 * Splits text into chunks that respect the maximum length limit.
 * Prefers splitting at word boundaries for cleaner results.
 * Preserves all content exactly - no characters are lost during splitting.
 *
 * @param text - The text to split
 * @param maxLength - Maximum length per chunk
 * @returns Array of text chunks
 */
function splitTextIntoChunks(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    // Try to split at word boundary (space)
    const splitIndex = remaining.lastIndexOf(' ', maxLength);
    if (splitIndex <= 0) {
      // No word boundary found within limit, split at max length
      // Preserve all content exactly
      chunks.push(remaining.slice(0, maxLength));
      remaining = remaining.slice(maxLength);
    } else {
      // Split at space - include everything up to and including the space
      // to preserve all content (the space stays at the end of this chunk)
      chunks.push(remaining.slice(0, splitIndex + 1));
      remaining = remaining.slice(splitIndex + 1);
    }
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}

/**
 * Splits rich text elements that exceed Notion's 2000-character limit.
 * Only splits text elements; mentions and equations are passed through unchanged.
 * Preserves annotations for each split segment.
 *
 * @param richText - Array of Notion rich text elements
 * @returns Array of rich text elements with long texts split into multiple elements
 */
function splitLongRichTextElements(richText: NotionRichText[]): NotionRichText[] {
  return richText.flatMap((element) => {
    // Only split text elements (not mentions or equations)
    if (element.type !== 'text' || !element.text?.content) {
      return [element];
    }

    const content = element.text.content;
    if (content.length <= NOTION_RICH_TEXT_MAX_LENGTH) {
      return [element];
    }

    // Split into chunks, preferring word boundaries
    const chunks = splitTextIntoChunks(content, NOTION_RICH_TEXT_MAX_LENGTH);

    // Create new rich text elements for each chunk with same annotations and link
    return chunks.map((chunk) => ({
      ...element,
      text: { ...element.text, content: chunk },
      plain_text: chunk,
    }));
  });
}

/**
 * Checks if two annotations objects are equivalent.
 */
function annotationsAreEqual(a: NotionAnnotations, b: NotionAnnotations): boolean {
  return (
    (a.bold || false) === (b.bold || false) &&
    (a.italic || false) === (b.italic || false) &&
    (a.strikethrough || false) === (b.strikethrough || false) &&
    (a.underline || false) === (b.underline || false) &&
    (a.code || false) === (b.code || false) &&
    (a.color || 'default') === (b.color || 'default')
  );
}

/**
 * Merges adjacent text elements that have identical annotations and no links.
 * This reduces the total element count while preserving all content and formatting.
 * Only merges 'text' type elements; mentions and equations are never merged.
 *
 * @param richText - Array of Notion rich text elements
 * @returns Array with adjacent compatible text elements merged
 */
function mergeAdjacentTextElements(richText: NotionRichText[]): NotionRichText[] {
  if (richText.length <= 1) return richText;

  const merged: NotionRichText[] = [];

  for (const element of richText) {
    const lastElement = merged[merged.length - 1];

    // Can only merge if:
    // 1. Both are text type (not mentions or equations)
    // 2. Neither has a link (href is null)
    // 3. Both have annotations and they are identical
    // 4. Combined length doesn't exceed max
    if (
      lastElement &&
      lastElement.type === 'text' &&
      element.type === 'text' &&
      lastElement.href === null &&
      element.href === null &&
      lastElement.text?.link === null &&
      element.text?.link === null &&
      lastElement.annotations &&
      element.annotations &&
      annotationsAreEqual(lastElement.annotations, element.annotations) &&
      (lastElement.text?.content || '').length + (element.text?.content || '').length <= NOTION_RICH_TEXT_MAX_LENGTH
    ) {
      // Merge: append content to last element
      const combinedContent = (lastElement.text?.content || '') + (element.text?.content || '');
      lastElement.text = { content: combinedContent, link: null };
      lastElement.plain_text = combinedContent;
    } else {
      // Cannot merge, add as new element
      merged.push(element);
    }
  }

  return merged;
}

/**
 * Limits the rich text array to Notion's maximum of 100 elements.
 * First attempts to merge adjacent elements to reduce count.
 * If still over limit, truncates and adds a warning marker.
 *
 * @param richText - Array of Notion rich text elements
 * @param warnings - Optional array to collect truncation warnings
 * @returns Array limited to NOTION_RICH_TEXT_MAX_ELEMENTS elements
 */
function limitRichTextArrayLength(richText: NotionRichText[], warnings?: ContentConversionWarning[]): NotionRichText[] {
  // First, try to reduce count by merging adjacent compatible elements
  let result = mergeAdjacentTextElements(richText);

  // If still under limit, we're done
  if (result.length <= NOTION_RICH_TEXT_MAX_ELEMENTS) {
    return result;
  }

  // Still over limit - need to truncate
  // Reserve last element for truncation marker
  const maxElements = NOTION_RICH_TEXT_MAX_ELEMENTS - 1;
  const originalCount = result.length;

  const warningMessage = `Rich text array has ${originalCount} elements, truncating to ${NOTION_RICH_TEXT_MAX_ELEMENTS}. Content will be lost.`;
  console.warn(`[markdown-to-rich-text] ${warningMessage}`);

  // Add warning to collector if provided
  if (warnings) {
    warnings.push({
      type: 'truncation',
      message: warningMessage,
      originalCount,
      truncatedTo: NOTION_RICH_TEXT_MAX_ELEMENTS,
    });
  }

  // Take first maxElements and add truncation marker
  result = result.slice(0, maxElements);

  // Add truncation marker
  result.push({
    type: 'text',
    text: { content: ' [...content truncated due to Notion limit...]', link: null },
    plain_text: ' [...content truncated due to Notion limit...]',
    href: null,
    annotations: {
      bold: false,
      italic: true,
      strikethrough: false,
      underline: false,
      code: false,
      color: 'default',
    },
  });

  return result;
}

// Simple markdown parser - we'll implement a basic one for now
// In a more complex environment, we might want to use a library like 'remark' or 'marked'

// Pre-compiled regex patterns for better performance
const INLINE_PATTERNS = [
  // Link with code: [`code`](url) - must come first to avoid conflicts
  // Allow empty code blocks: [``](url)
  { regex: /\[`([^`]*)`\]\(([^)]+)\)/g, type: 'code_link' as const },
  // Inline code (must come before other patterns to avoid conflicts)
  // Allow empty code blocks: ``
  { regex: /`([^`]*)`/g, type: 'code' as const },
  // Inline math equations (must come before other patterns to avoid conflicts)
  { regex: /\$([^$]*)\$/g, type: 'equation' as const },
  // Bold text (must come before italic to avoid conflicts)
  { regex: /\*\*([^*]+)\*\*/g, type: 'bold' as const },
  // Italic text - improved to not match across newlines and avoid conflicts with bold
  { regex: /\*([^*\n]+)\*/g, type: 'italic' as const },
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
 * @param uuidMappings - Optional UUID mappings for converting Atlas UUIDs to Notion URLs
 * @returns Array of Notion Rich Text objects
 * @throws {Error} If text contains invalid markdown syntax
 */
function parseInlineMarkdown(text: string, uuidMappings: UuidMappings): NotionRichText[] {
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

      // Check if this match overlaps with any existing match
      // If it does, skip it to prevent conflicts (higher priority patterns are processed first)
      const hasOverlap = matches.some(
        (existingMatch) => !(matchEnd <= existingMatch.start || matchStart >= existingMatch.end),
      );

      if (hasOverlap) {
        continue;
      }

      matches.push({
        start: matchStart, // Start position
        end: matchEnd, // End position
        type: pattern.type, // Formatting type
        content: match[1], // Captured content
        url: pattern.type === 'link' || pattern.type === 'code_link' ? match[2] : undefined, // URL for links and code_links
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

    // Handle equation type first - equations need default annotations to match Notion API
    if (match.type === 'equation') {
      richText.push({
        type: 'equation',
        equation: { expression: match.content },
        plain_text: match.content,
        href: null,
        annotations: {
          bold: false,
          code: false,
          color: 'default',
          italic: false,
          underline: false,
          strikethrough: false,
        },
      });
      lastEnd = match.end;
      continue;
    }

    // Create annotations object for the formatted text
    const annotations: NotionAnnotations = {};
    if (match.type === 'code') annotations.code = true;
    if (match.type === 'bold') annotations.bold = true;
    if (match.type === 'italic') annotations.italic = true;
    if (match.type === 'strikethrough') annotations.strikethrough = true;
    if (match.type === 'code_link') annotations.code = true; // [`code`](url) pattern

    // Handle special cases that need different Notion Rich Text structures
    if (match.type === 'link' || match.type === 'code_link') {
      // For code_link, content is already extracted without backticks
      // For regular link, check if content is wrapped in backticks
      let linkContent = match.content;

      if (match.type === 'link') {
        // Check if the link content is wrapped in backticks: [`code`](url)
        // This represents a link with code annotation
        const codeInLinkMatch = match.content.match(/^`(.+)`$/);

        if (codeInLinkMatch) {
          // Extract content from backticks and unescape any escaped backticks
          linkContent = codeInLinkMatch[1].replace(/\\`/g, '`');
          annotations.code = true;
        }
      } else if (match.type === 'code_link') {
        // Unescape any escaped backticks in code_link content
        linkContent = match.content.replace(/\\`/g, '`');
      }

      // Check if this is a mention (UUID-only href) vs external link
      const isUUIDFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(match.url!);
      const isMention = isUUIDFormat;

      if (isMention) {
        // This is a mention - convert UUID back to Notion URL if mappings are provided
        const notionPageID = uuidMappings.atlasUUIDsToNotionPageIds.get(match.url!);
        if (!notionPageID) {
          // No mapping found - use plain text instead of creating a broken mention
          // This prevents Notion API errors when the Atlas UUID doesn't have a corresponding Notion page
          console.warn(`No mapping found for mention UUID: ${match.url} - using plain text instead`);
          richText.push(
            createRichText({
              content: linkContent,
              annotations,
            }),
          );
        } else {
          // Mapping exists - create proper mention with Notion page ID
          const mentionUrl = `https://www.notion.so/${uuidToNoHyphens(notionPageID)}`;
          richText.push({
            type: 'mention',
            mention: {
              page: {
                id: notionPageID,
              },
              type: 'page',
            },
            plain_text: linkContent,
            href: mentionUrl,
            annotations: {
              bold: annotations.bold || false,
              code: annotations.code || false,
              color: annotations.color === 'default_background' ? 'default' : annotations.color || 'default',
              italic: annotations.italic || false,
              underline: annotations.underline || false,
              strikethrough: annotations.strikethrough || false,
            },
          });
        }
      } else {
        // This is an external link - use createRichText for consistent annotation handling
        richText.push(
          createRichText({
            content: linkContent,
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
  // Always include all annotation properties to match Notion API structure
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
    href: href ?? null, // Always include href field, defaulting to null
    annotations: normalizedAnnotations,
  };
}

/**
 * Convert inline markdown text to Notion Rich Text format
 * Handles formatting like bold, italic, links, inline code
 *
 * @param markdown - The markdown text to convert
 * @param uuidMappings - Optional UUID mappings for converting Atlas UUIDs to Notion URLs
 * @param warnings - Optional array to collect warnings (e.g., truncation warnings)
 * @returns Array of Notion Rich Text objects
 * @throws {Error} If markdown is invalid or parsing fails
 */
export function convertMarkdownToNotionRichText(
  markdown: string,
  uuidMappings: UuidMappings,
  warnings?: ContentConversionWarning[],
): NotionRichText[] {
  try {
    // Return empty array for empty input
    if (!markdown || markdown.trim() === '') {
      return [];
    }

    // Normalize line breaks: squash multiple consecutive empty lines into single newlines
    // This includes lines with only whitespace
    let normalizedMarkdown = markdown
      .replace(/\n\s*\n\s*\n+/g, '\n\n') // Replace 3+ consecutive newlines with 2
      .replace(/^\n+/, '') // Remove leading newlines
      .replace(/\n+$/, ''); // Remove trailing newlines

    // Handle markdown line breaks: convert "  \n" to just "\n" for processing
    // This preserves the line break intent while normalizing the format
    normalizedMarkdown = normalizedMarkdown.replace(/  \n/g, '\n');

    // Round-trip compatibility strategy: Embed newlines within text objects
    // -----------------------------------------------------------------------
    // When converting Notion → Markdown → Notion, we must preserve the original rich text structure.
    // Notion's rich text format typically embeds trailing newlines within text objects rather than
    // creating separate newline-only elements. By maintaining this pattern, we ensure that:
    // 1. The converted rich text matches Notion's native structure
    // 2. Round-trip conversions preserve the exact same element count and boundaries
    // 3. Text formatting is correctly maintained across line boundaries
    //
    // Example: "Hello\n" is stored as one text object with content "Hello\n",
    // not as two objects: "Hello" + "\n"

    // Check if this content contains multiline inline code blocks
    // A multiline inline code block is when we have a backtick that spans multiple lines
    const hasMultilineInlineCode = /`[^`]*\n[^`]*`/.test(normalizedMarkdown);

    if (hasMultilineInlineCode) {
      // For content with multiline inline code blocks, we need to process line by line
      // but merge lines that are part of the same multiline inline code
      const lines = normalizedMarkdown.split('\n');
      const richText: NotionRichText[] = [];

      let i = 0;
      while (i < lines.length) {
        const line = lines[i];

        // Check if this line starts a multiline inline code block
        // We need to parse the line to see if there's an unclosed backtick
        const backtickMatches = line.match(/`/g);
        const backtickCount = backtickMatches ? backtickMatches.length : 0;

        // If we have an odd number of backticks, we have an unclosed inline code block
        const hasUnclosedBacktick = backtickCount % 2 === 1;

        if (hasUnclosedBacktick) {
          // This line starts a multiline inline code block, collect lines until we find the closing backtick
          let multilineContent = line;
          let j = i + 1;

          while (j < lines.length) {
            multilineContent += '\n' + lines[j];
            const closingBacktickCount = (lines[j].match(/`/g) || []).length;

            // If we have an odd number of backticks on this line, it closes our multiline block
            // If we have an even number (including 0), we need to continue
            if (closingBacktickCount % 2 === 1) {
              // Found a line with an odd number of backticks, this closes our multiline block
              break;
            }
            j++;
          }

          // Process the multiline content as one block
          const multilineRichText = parseInlineMarkdown(multilineContent, uuidMappings);

          // Round-trip compatibility: Embed newline in the last text object
          // This prevents creating separate newline-only elements and matches Notion's structure
          if (j < lines.length - 1) {
            // Not the last line
            if (multilineRichText.length > 0) {
              const lastObject = multilineRichText[multilineRichText.length - 1];
              if (lastObject.text) {
                lastObject.text.content += '\n';
                lastObject.plain_text += '\n';
              }
            } else {
              multilineRichText.push(
                createRichText({
                  content: '\n',
                  annotations: {},
                }),
              );
            }
          }

          richText.push(...multilineRichText);

          // Skip the lines we just processed
          i = j + 1;
        } else {
          // Regular line, process normally
          const lineRichText = parseInlineMarkdown(line, uuidMappings);

          // Round-trip compatibility: Embed newline in the last text object
          // This prevents creating separate newline-only elements and matches Notion's structure
          if (i < lines.length - 1) {
            // Not the last line
            // Add newline to the last text object if it exists, otherwise create one
            if (lineRichText.length > 0) {
              const lastObject = lineRichText[lineRichText.length - 1];
              if (lastObject.text) {
                lastObject.text.content += '\n';
                lastObject.plain_text += '\n';
              }
            } else {
              lineRichText.push(
                createRichText({
                  content: '\n',
                  annotations: {},
                }),
              );
            }
          }

          richText.push(...lineRichText);
          i++;
        }
      }

      // Apply Notion API limits: split long elements, then limit array length
      return limitRichTextArrayLength(splitLongRichTextElements(richText), warnings);
    } else {
      // For regular content without multiline inline code, process the entire text as one block
      // Apply Notion API limits: split long elements, then limit array length
      return limitRichTextArrayLength(
        splitLongRichTextElements(parseInlineMarkdown(normalizedMarkdown, uuidMappings)),
        warnings,
      );
    }
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
