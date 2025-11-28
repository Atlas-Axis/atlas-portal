import { describe, expect, it, vi } from 'vitest';
import type { UuidMappings } from '../../atlas/load-uuid-mapping';
import {
  NOTION_RICH_TEXT_MAX_ELEMENTS,
  NOTION_RICH_TEXT_MAX_LENGTH,
  convertMarkdownToNotionRichText,
} from '../markdown-to-rich-text';

// Mock UuidMappings for testing
const mockUuidMappings: UuidMappings = {
  notionPageIDsToAtlasUUIDs: new Map(),
  atlasUUIDsToNotionPageIds: new Map(),
};

describe('convertMarkdownToNotionRichText', () => {
  it('should convert plain text', () => {
    const result = convertMarkdownToNotionRichText('Hello World', mockUuidMappings);
    expect(result).toEqual([
      {
        type: 'text',
        text: { content: 'Hello World', link: null },
        plain_text: 'Hello World',
        href: null,
        annotations: {
          bold: false,
          code: false,
          color: 'default',
          italic: false,
          strikethrough: false,
          underline: false,
        },
      },
    ]);
  });

  it('should convert bold text', () => {
    const result = convertMarkdownToNotionRichText('Hello **World**', mockUuidMappings);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0].text?.content).toBe('Hello ');
    // Find the bold element
    const boldElement = result.find((r) => r.annotations?.bold);
    expect(boldElement).toBeDefined();
    expect(boldElement?.annotations?.bold).toBe(true);
    expect(boldElement?.text?.content).toBe('World');
  });

  it('should convert italic text', () => {
    const result = convertMarkdownToNotionRichText('Hello *World*', mockUuidMappings);
    expect(result).toHaveLength(2);
    expect(result[0].text?.content).toBe('Hello ');
    expect(result[1]).toBeDefined();
    expect(result[1].text?.content).toBe('World');
    expect(result[1].annotations?.italic).toBe(true);
  });

  it('should convert strikethrough text', () => {
    const result = convertMarkdownToNotionRichText('Hello ~~World~~', mockUuidMappings);
    expect(result).toHaveLength(2);
    expect(result[0].text?.content).toBe('Hello ');
    expect(result[1]).toBeDefined();
    expect(result[1].text?.content).toBe('World');
    expect(result[1].annotations?.strikethrough).toBe(true);
  });

  it('should convert inline code', () => {
    const result = convertMarkdownToNotionRichText('Hello `World`', mockUuidMappings);
    expect(result).toHaveLength(2);
    expect(result[0].text?.content).toBe('Hello ');
    expect(result[1]).toBeDefined();
    expect(result[1].text?.content).toBe('World');
    expect(result[1].annotations?.code).toBe(true);
  });

  it('should convert inline code with newlines', () => {
    const result = convertMarkdownToNotionRichText('Hello `code\nwith\nnewlines` world', mockUuidMappings);
    expect(result).toHaveLength(3);
    expect(result[0].text?.content).toBe('Hello ');
    expect(result[1]).toBeDefined();
    expect(result[1].text?.content).toBe('code\nwith\nnewlines');
    expect(result[1].annotations?.code).toBe(true);
    expect(result[2].text?.content).toBe(' world');
  });

  it('should convert links', () => {
    const result = convertMarkdownToNotionRichText('Hello [World](https://example.com)', mockUuidMappings);
    expect(result).toHaveLength(2);
    expect(result[0].text?.content).toBe('Hello ');
    expect(result[1]).toBeDefined();
    expect(result[1].text?.content).toBe('World');
    expect(result[1].href).toBe('https://example.com');
  });

  it('should handle complex combinations', () => {
    const result = convertMarkdownToNotionRichText(
      'Hello **bold** and `code` and [link](https://example.com)',
      mockUuidMappings,
    );
    expect(result.length).toBeGreaterThanOrEqual(6);
    // Find the bold element
    const boldElement = result.find((r) => r.annotations?.bold);
    expect(boldElement).toBeDefined();
    expect(boldElement?.annotations?.bold).toBe(true);
    // Find the code element
    const codeElement = result.find((r) => r.annotations?.code);
    expect(codeElement).toBeDefined();
    expect(codeElement?.annotations?.code).toBe(true);
    expect(codeElement?.text?.content).toBe('code');
    // Find the link element
    const linkElement = result.find((r) => r.href);
    expect(linkElement).toBeDefined();
    expect(linkElement?.href).toBe('https://example.com');
  });

  it('should handle empty input', () => {
    const result = convertMarkdownToNotionRichText('', mockUuidMappings);
    expect(result).toEqual([]);
  });

  it('should handle whitespace-only input', () => {
    const result = convertMarkdownToNotionRichText('   ', mockUuidMappings);
    expect(result).toEqual([]);
  });

  it('should handle edge cases in inline formatting', () => {
    // Test with empty formatting markers
    const result = convertMarkdownToNotionRichText('**', mockUuidMappings);
    expect(result).toHaveLength(1);
    expect(result[0].text?.content).toBe('**');
  });

  it('should handle very long text efficiently', () => {
    const longText = 'A'.repeat(10000) + ' **bold** ' + 'B'.repeat(10000);
    const start = Date.now();
    const result = convertMarkdownToNotionRichText(longText, mockUuidMappings);
    const duration = Date.now() - start;

    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });

  it('should handle special characters in markdown', () => {
    const result = convertMarkdownToNotionRichText(
      'Text with special chars: !@#$%^&*()_+-=[]{}|;:,.<>?',
      mockUuidMappings,
    );
    expect(result).toHaveLength(1);
    expect(result[0].text?.content).toBe('Text with special chars: !@#$%^&*()_+-=[]{}|;:,.<>?');
  });

  it('should handle unicode characters in simple formatting', () => {
    const result = convertMarkdownToNotionRichText('**Hello 世界**', mockUuidMappings);
    expect(result.length).toBeGreaterThanOrEqual(1);
    // Find the bold segment
    const boldSegment = result.find((r) => r.annotations?.bold);
    expect(boldSegment).toBeDefined();
    expect(boldSegment?.annotations?.bold).toBe(true);
    expect(boldSegment?.text?.content).toBe('Hello 世界');
  });

  it('should treat content inside code blocks as plain text without further processing', () => {
    const result = convertMarkdownToNotionRichText('`**bold** and *italic* and ~~strikethrough~~`', mockUuidMappings);
    expect(result).toHaveLength(1);
    expect(result[0].annotations?.code).toBe(true);
    // Content inside code should be treated as plain text, not processed for other formatting
    expect(result[0].text?.content).toBe('**bold** and *italic* and ~~strikethrough~~');
    // Should not have any other annotations applied
    expect(result[0].annotations?.bold).toBe(false);
    expect(result[0].annotations?.italic).toBe(false);
    expect(result[0].annotations?.strikethrough).toBe(false);
  });

  it('should preserve empty lines in plain text content', () => {
    const result = convertMarkdownToNotionRichText('Line 1\n\nLine 3', mockUuidMappings);
    expect(result).toHaveLength(1);
    expect(result[0].text?.content).toBe('Line 1\n\nLine 3');
    expect(result[0].annotations?.bold).toBe(false);
    expect(result[0].annotations?.italic).toBe(false);
  });

  it('should remove leading empty lines when content exists', () => {
    const result = convertMarkdownToNotionRichText('\n\nContent', mockUuidMappings);
    expect(result).toHaveLength(1);
    expect(result[0].text?.content).toBe('Content');
    expect(result[0].annotations?.bold).toBe(false);
    expect(result[0].annotations?.italic).toBe(false);
  });

  it('should remove trailing empty lines when content exists', () => {
    const result = convertMarkdownToNotionRichText('Content\n\n', mockUuidMappings);
    expect(result).toHaveLength(1);
    expect(result[0].text?.content).toBe('Content');
    expect(result[0].annotations?.bold).toBe(false);
    expect(result[0].annotations?.italic).toBe(false);
  });

  it('should handle formatted text with empty lines between them', () => {
    const result = convertMarkdownToNotionRichText('**Bold**\n\n*Italic*', mockUuidMappings);
    expect(result).toHaveLength(3);

    // First item should be bold
    expect(result[0].text?.content).toBe('Bold');
    expect(result[0].annotations?.bold).toBe(true);
    expect(result[0].annotations?.italic).toBe(false);

    // Second item should be the empty line
    expect(result[1].text?.content).toBe('\n\n');
    expect(result[1].annotations?.bold).toBe(false);
    expect(result[1].annotations?.italic).toBe(false);

    // Third item should be italic
    expect(result[2].text?.content).toBe('Italic');
    expect(result[2].annotations?.bold).toBe(false);
    expect(result[2].annotations?.italic).toBe(true);
  });

  it('should handle mixed content with empty lines and formatting', () => {
    const result = convertMarkdownToNotionRichText('Plain text\n\n*Italic*', mockUuidMappings);
    expect(result).toHaveLength(2);

    // First item should be plain text with empty line
    expect(result[0].text?.content).toBe('Plain text\n\n');
    expect(result[0].annotations?.bold).toBe(false);
    expect(result[0].annotations?.italic).toBe(false);

    // Second item should be italic
    expect(result[1].text?.content).toBe('Italic');
    expect(result[1].annotations?.bold).toBe(false);
    expect(result[1].annotations?.italic).toBe(true);
  });

  it('should handle complex formatting with empty lines', () => {
    const result = convertMarkdownToNotionRichText('**Bold**\n\nPlain text\n\n*Italic*', mockUuidMappings);
    expect(result).toHaveLength(3);

    // Should have bold, plain text with empty lines, italic
    const boldItem = result.find((item) => item.annotations?.bold);
    const italicItem = result.find((item) => item.annotations?.italic);
    const plainTextItem = result.find((item) => !item.annotations?.bold && !item.annotations?.italic);

    expect(boldItem).toBeDefined();
    expect(boldItem?.text?.content).toBe('Bold');

    expect(italicItem).toBeDefined();
    expect(italicItem?.text?.content).toBe('Italic');

    expect(plainTextItem).toBeDefined();
    expect(plainTextItem?.text?.content).toBe('\n\nPlain text\n\n');
  });

  it('should convert inline math equations', () => {
    const result = convertMarkdownToNotionRichText('The equation $E=mc^2$ is famous', mockUuidMappings);
    expect(result).toHaveLength(3);

    expect(result[0].text?.content).toBe('The equation ');
    expect(result[0].type).toBe('text');

    expect(result[1].type).toBe('equation');
    expect(result[1].equation?.expression).toBe('E=mc^2');
    expect(result[1].plain_text).toBe('E=mc^2');

    expect(result[2].text?.content).toBe(' is famous');
    expect(result[2].type).toBe('text');
  });

  it('should convert complex mathematical expressions', () => {
    const result = convertMarkdownToNotionRichText(
      'The integral $\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$ is important',
      mockUuidMappings,
    );
    expect(result).toHaveLength(3);

    expect(result[0].text?.content).toBe('The integral ');
    expect(result[1].type).toBe('equation');
    expect(result[1].equation?.expression).toBe('\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}');
    expect(result[2].text?.content).toBe(' is important');
  });

  it('should handle multiple equations in the same text', () => {
    const result = convertMarkdownToNotionRichText('Pythagorean theorem: $a^2$ + $b^2$ = $c^2$', mockUuidMappings);
    expect(result).toHaveLength(6);

    expect(result[0].text?.content).toBe('Pythagorean theorem: ');
    expect(result[1].type).toBe('equation');
    expect(result[1].equation?.expression).toBe('a^2');
    expect(result[2].text?.content).toBe(' + ');
    expect(result[3].type).toBe('equation');
    expect(result[3].equation?.expression).toBe('b^2');
    expect(result[4].text?.content).toBe(' = ');
    expect(result[5].type).toBe('equation');
    expect(result[5].equation?.expression).toBe('c^2');
  });

  it('should handle equations with special characters', () => {
    const result = convertMarkdownToNotionRichText(
      'The formula $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$ is the quadratic formula',
      mockUuidMappings,
    );
    expect(result).toHaveLength(3);

    expect(result[1].type).toBe('equation');
    expect(result[1].equation?.expression).toBe('x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}');
  });

  it('should filter out empty equations (Notion API rejects them)', () => {
    const result = convertMarkdownToNotionRichText('Empty equation: $$', mockUuidMappings);
    // Empty equations are filtered out - only the text before remains
    expect(result).toHaveLength(1);
    expect(result[0].text?.content).toBe('Empty equation: ');
  });

  it('should handle equations mixed with other formatting', () => {
    const result = convertMarkdownToNotionRichText('**Bold** text with $E=mc^2$ and `code`', mockUuidMappings);
    expect(result.length).toBeGreaterThanOrEqual(5);

    // Find the bold element
    const boldElement = result.find((r) => r.annotations?.bold);
    expect(boldElement).toBeDefined();
    expect(boldElement?.text?.content).toBe('Bold');

    // Find the equation element
    const equationElement = result.find((r) => r.type === 'equation');
    expect(equationElement).toBeDefined();
    expect(equationElement?.equation?.expression).toBe('E=mc^2');

    // Find the code element
    const codeElement = result.find((r) => r.annotations?.code);
    expect(codeElement).toBeDefined();
    expect(codeElement?.text?.content).toBe('code');
  });

  it('should not process formatting inside equations', () => {
    const result = convertMarkdownToNotionRichText('$E=mc^2$ and $\\frac{a}{b}$', mockUuidMappings);
    expect(result).toHaveLength(3);

    expect(result[0].type).toBe('equation');
    expect(result[0].equation?.expression).toBe('E=mc^2');
    expect(result[1].text?.content).toBe(' and ');
    expect(result[2].type).toBe('equation');
    expect(result[2].equation?.expression).toBe('\\frac{a}{b}');
  });

  it('should handle equations with dollar signs in content', () => {
    const result = convertMarkdownToNotionRichText('Price: $100$ and $200$', mockUuidMappings);
    expect(result).toHaveLength(4);

    expect(result[0].text?.content).toBe('Price: ');
    expect(result[1].type).toBe('equation');
    expect(result[1].equation?.expression).toBe('100');
    expect(result[2].text?.content).toBe(' and ');
    expect(result[3].type).toBe('equation');
    expect(result[3].equation?.expression).toBe('200');
  });

  describe('complex multiline inline code cases', () => {
    it('should not process markdown links inside multiline inline code', () => {
      const result = convertMarkdownToNotionRichText(
        'Text `with [link](https://example.com) inside\ncode` end',
        mockUuidMappings,
      );
      expect(result).toHaveLength(3);

      // "Text "
      expect(result[0].text?.content).toBe('Text ');
      expect(result[0].annotations?.code).toBe(false);

      // Multiline code with markdown link syntax (should be treated as plain text)
      expect(result[1].text?.content).toBe('with [link](https://example.com) inside\ncode');
      expect(result[1].annotations?.code).toBe(true);
      expect(result[1].href).toBeNull();
      expect(result[1].text?.link).toBeNull();

      // " end"
      expect(result[2].text?.content).toBe(' end');
      expect(result[2].annotations?.code).toBe(false);
    });

    it('should not process any markdown formatting inside multiline inline code with complex table', () => {
      const complexTableMarkdown = '`| Header | [Link](https://example.com) |\n| Row | **Bold** and *Italic* |`';
      const result = convertMarkdownToNotionRichText(complexTableMarkdown, mockUuidMappings);

      expect(result).toHaveLength(1);

      // Should be a single code element with all content as plain text
      expect(result[0].text?.content).toBe('| Header | [Link](https://example.com) |\n| Row | **Bold** and *Italic* |');
      expect(result[0].annotations?.code).toBe(true);
      expect(result[0].annotations?.bold).toBe(false);
      expect(result[0].annotations?.italic).toBe(false);
      expect(result[0].href).toBeNull();
    });

    it('should handle very complex multiline inline code with multiple markdown links', () => {
      const markdown =
        '`Line 1 [link1](https://example1.com) text\nLine 2 [link2](https://example2.com) more\nLine 3 [link3](https://example3.com) end`';
      const result = convertMarkdownToNotionRichText(markdown, mockUuidMappings);

      expect(result).toHaveLength(1);

      // All content should be in a single code block with no link processing
      expect(result[0].text?.content).toBe(
        'Line 1 [link1](https://example1.com) text\nLine 2 [link2](https://example2.com) more\nLine 3 [link3](https://example3.com) end',
      );
      expect(result[0].annotations?.code).toBe(true);
      expect(result[0].href).toBeNull();
    });

    it('should handle single-line inline code followed by multiline inline code on same line', () => {
      const result = convertMarkdownToNotionRichText(
        'Hello `code` and then `multiline\ncode\nhere` world',
        mockUuidMappings,
      );
      expect(result).toHaveLength(5);

      // First part: "Hello "
      expect(result[0].text?.content).toBe('Hello ');
      expect(result[0].annotations?.code).toBe(false);

      // Single-line inline code: "code"
      expect(result[1].text?.content).toBe('code');
      expect(result[1].annotations?.code).toBe(true);

      // Middle part: " and then "
      expect(result[2].text?.content).toBe(' and then ');
      expect(result[2].annotations?.code).toBe(false);

      // Multiline inline code: "multiline\ncode\nhere"
      expect(result[3].text?.content).toBe('multiline\ncode\nhere');
      expect(result[3].annotations?.code).toBe(true);

      // Last part: " world"
      expect(result[4].text?.content).toBe(' world');
      expect(result[4].annotations?.code).toBe(false);
    });

    it('should handle multiple single-line inline codes followed by multiline inline code', () => {
      const result = convertMarkdownToNotionRichText(
        'Hello `code1` and `code2` and `multiline\ncode\nhere` world',
        mockUuidMappings,
      );
      expect(result).toHaveLength(7);

      // "Hello "
      expect(result[0].text?.content).toBe('Hello ');
      expect(result[0].annotations?.code).toBe(false);

      // "code1"
      expect(result[1].text?.content).toBe('code1');
      expect(result[1].annotations?.code).toBe(true);

      // " and "
      expect(result[2].text?.content).toBe(' and ');
      expect(result[2].annotations?.code).toBe(false);

      // "code2"
      expect(result[3].text?.content).toBe('code2');
      expect(result[3].annotations?.code).toBe(true);

      // " and "
      expect(result[4].text?.content).toBe(' and ');
      expect(result[4].annotations?.code).toBe(false);

      // Multiline: "multiline\ncode\nhere"
      expect(result[5].text?.content).toBe('multiline\ncode\nhere');
      expect(result[5].annotations?.code).toBe(true);

      // " world"
      expect(result[6].text?.content).toBe(' world');
      expect(result[6].annotations?.code).toBe(false);
    });

    it('should handle table with inline code (should NOT be treated as multiline)', () => {
      // Note: This test expects 5 elements because:
      // 1. Adjacent plain text elements with same annotations are merged
      // 2. Newlines are embedded in the preceding text object
      // This behavior is intentional for:
      // - Round-trip compatibility
      // - Staying under Notion's 100-element limit for rich text arrays
      const result = convertMarkdownToNotionRichText('| Column | `code` |\n| Another | `more` |', mockUuidMappings);
      expect(result).toHaveLength(5);

      // First line: "| Column | "
      expect(result[0].text?.content).toBe('| Column | ');
      expect(result[0].annotations?.code).toBe(false);

      // Inline code: "code"
      expect(result[1].text?.content).toBe('code');
      expect(result[1].annotations?.code).toBe(true);

      // End of first line merged with start of second line: " |\n| Another | "
      // (adjacent plain text elements are merged to reduce element count)
      expect(result[2].text?.content).toBe(' |\n| Another | ');
      expect(result[2].annotations?.code).toBe(false);

      // Inline code: "more"
      expect(result[3].text?.content).toBe('more');
      expect(result[3].annotations?.code).toBe(true);

      // End of second line: " |"
      expect(result[4].text?.content).toBe(' |');
      expect(result[4].annotations?.code).toBe(false);
    });

    it('should handle text with backticks but no multiline code', () => {
      const result = convertMarkdownToNotionRichText(
        'This has `backticks` in text but no multiline code',
        mockUuidMappings,
      );
      expect(result).toHaveLength(3);

      // "This has "
      expect(result[0].text?.content).toBe('This has ');
      expect(result[0].annotations?.code).toBe(false);

      // "backticks"
      expect(result[1].text?.content).toBe('backticks');
      expect(result[1].annotations?.code).toBe(true);

      // " in text but no multiline code"
      expect(result[2].text?.content).toBe(' in text but no multiline code');
      expect(result[2].annotations?.code).toBe(false);
    });

    it('should handle multiline inline code with formatting inside', () => {
      const result = convertMarkdownToNotionRichText(
        'Here is `code with\n**bold** and *italic*\nmore code` end',
        mockUuidMappings,
      );
      expect(result).toHaveLength(3);

      // "Here is "
      expect(result[0].text?.content).toBe('Here is ');
      expect(result[0].annotations?.code).toBe(false);

      // Multiline code with formatting (should be treated as plain text inside code)
      expect(result[1].text?.content).toBe('code with\n**bold** and *italic*\nmore code');
      expect(result[1].annotations?.code).toBe(true);

      // " end"
      expect(result[2].text?.content).toBe(' end');
      expect(result[2].annotations?.code).toBe(false);
    });

    it('should handle multiple multiline inline code blocks', () => {
      const result = convertMarkdownToNotionRichText(
        'First `multiline\ncode` and second `another\nmultiline` end',
        mockUuidMappings,
      );
      expect(result).toHaveLength(5);

      // "First "
      expect(result[0].text?.content).toBe('First ');
      expect(result[0].annotations?.code).toBe(false);

      // First multiline: "multiline\ncode"
      expect(result[1].text?.content).toBe('multiline\ncode');
      expect(result[1].annotations?.code).toBe(true);

      // " and second "
      expect(result[2].text?.content).toBe(' and second ');
      expect(result[2].annotations?.code).toBe(false);

      // Second multiline: "another\nmultiline"
      expect(result[3].text?.content).toBe('another\nmultiline');
      expect(result[3].annotations?.code).toBe(true);

      // " end"
      expect(result[4].text?.content).toBe(' end');
      expect(result[4].annotations?.code).toBe(false);
    });

    it('should handle edge case with backticks at start and end of line', () => {
      const result = convertMarkdownToNotionRichText('`start\nmiddle\nend`', mockUuidMappings);
      expect(result).toHaveLength(1);

      // Single multiline code block
      expect(result[0].text?.content).toBe('start\nmiddle\nend');
      expect(result[0].annotations?.code).toBe(true);
    });

    it('should handle complex mixed case with single-line, multiline, and regular text', () => {
      const result = convertMarkdownToNotionRichText(
        'Start `single` middle `multiline\ncode` and `another` end',
        mockUuidMappings,
      );
      expect(result).toHaveLength(7);

      // "Start "
      expect(result[0].text?.content).toBe('Start ');
      expect(result[0].annotations?.code).toBe(false);

      // "single"
      expect(result[1].text?.content).toBe('single');
      expect(result[1].annotations?.code).toBe(true);

      // " middle "
      expect(result[2].text?.content).toBe(' middle ');
      expect(result[2].annotations?.code).toBe(false);

      // "multiline\ncode"
      expect(result[3].text?.content).toBe('multiline\ncode');
      expect(result[3].annotations?.code).toBe(true);

      // " and "
      expect(result[4].text?.content).toBe(' and ');
      expect(result[4].annotations?.code).toBe(false);

      // "another"
      expect(result[5].text?.content).toBe('another');
      expect(result[5].annotations?.code).toBe(true);

      // " end"
      expect(result[6].text?.content).toBe(' end');
      expect(result[6].annotations?.code).toBe(false);
    });
  });

  describe('text splitting for Notion 2000-character limit', () => {
    it('should not split text exactly at the limit', () => {
      const text = 'A'.repeat(NOTION_RICH_TEXT_MAX_LENGTH);
      const result = convertMarkdownToNotionRichText(text, mockUuidMappings);

      expect(result).toHaveLength(1);
      expect(result[0].text?.content).toBe(text);
      expect(result[0].text?.content.length).toBe(NOTION_RICH_TEXT_MAX_LENGTH);
    });

    it('should split text exceeding the limit by one character', () => {
      const text = 'A'.repeat(NOTION_RICH_TEXT_MAX_LENGTH + 1);
      const result = convertMarkdownToNotionRichText(text, mockUuidMappings);

      expect(result).toHaveLength(2);
      expect(result[0].text?.content.length).toBeLessThanOrEqual(NOTION_RICH_TEXT_MAX_LENGTH);
      expect(result[1].text?.content.length).toBeLessThanOrEqual(NOTION_RICH_TEXT_MAX_LENGTH);
      // Verify total content is preserved
      const combinedContent = (result[0].text?.content ?? '') + (result[1].text?.content ?? '');
      expect(combinedContent).toBe(text);
    });

    it('should split at word boundaries when possible', () => {
      // Create text with spaces that can be split at word boundaries
      const words = [];
      let totalLength = 0;
      while (totalLength < NOTION_RICH_TEXT_MAX_LENGTH + 500) {
        const word = 'word';
        words.push(word);
        totalLength += word.length + 1; // +1 for space
      }
      const text = words.join(' ');

      const result = convertMarkdownToNotionRichText(text, mockUuidMappings);

      expect(result.length).toBeGreaterThanOrEqual(2);
      // All chunks should be within the limit
      for (const chunk of result) {
        expect(chunk.text?.content.length).toBeLessThanOrEqual(NOTION_RICH_TEXT_MAX_LENGTH);
      }
      // Total content should be preserved exactly
      const combinedContent = result.map((r) => r.text?.content ?? '').join('');
      expect(combinedContent).toBe(text);
    });

    it('should not exceed limit when space is at exactly position 2000 (off-by-one edge case)', () => {
      // Create text where a space falls exactly at position 2000
      // This tests the off-by-one bug fix: when including the space in the chunk,
      // total must still not exceed maxLength
      const beforeSpace = 'A'.repeat(NOTION_RICH_TEXT_MAX_LENGTH); // 2000 A's
      const afterSpace = 'B'.repeat(100); // 100 B's
      const text = beforeSpace + ' ' + afterSpace; // Space at position 2000

      const result = convertMarkdownToNotionRichText(text, mockUuidMappings);

      // Should split into multiple chunks
      expect(result.length).toBeGreaterThanOrEqual(2);

      // CRITICAL: Each chunk must be <= 2000 characters (not 2001!)
      for (const chunk of result) {
        expect(chunk.text?.content.length).toBeLessThanOrEqual(NOTION_RICH_TEXT_MAX_LENGTH);
      }

      // Total content should be preserved
      const combinedContent = result.map((r) => r.text?.content ?? '').join('');
      expect(combinedContent).toBe(text);
    });

    it('should split at max length when no word boundaries are available', () => {
      // Text with no spaces - must split at exact character boundary
      const text = 'A'.repeat(NOTION_RICH_TEXT_MAX_LENGTH * 2 + 100);
      const result = convertMarkdownToNotionRichText(text, mockUuidMappings);

      expect(result).toHaveLength(3);
      expect(result[0].text?.content.length).toBe(NOTION_RICH_TEXT_MAX_LENGTH);
      expect(result[1].text?.content.length).toBe(NOTION_RICH_TEXT_MAX_LENGTH);
      expect(result[2].text?.content.length).toBe(100);
    });

    it('should preserve annotations when splitting bold text', () => {
      // Create bold text exceeding the limit
      const longBoldContent = 'B'.repeat(NOTION_RICH_TEXT_MAX_LENGTH + 500);
      const text = `**${longBoldContent}**`;
      const result = convertMarkdownToNotionRichText(text, mockUuidMappings);

      expect(result.length).toBeGreaterThanOrEqual(2);
      // All split segments should preserve the bold annotation
      for (const chunk of result) {
        expect(chunk.annotations?.bold).toBe(true);
        expect(chunk.text?.content.length).toBeLessThanOrEqual(NOTION_RICH_TEXT_MAX_LENGTH);
      }
    });

    it('should preserve annotations when splitting code text', () => {
      // Create code text exceeding the limit
      const longCodeContent = 'C'.repeat(NOTION_RICH_TEXT_MAX_LENGTH + 500);
      const text = `\`${longCodeContent}\``;
      const result = convertMarkdownToNotionRichText(text, mockUuidMappings);

      expect(result.length).toBeGreaterThanOrEqual(2);
      // All split segments should preserve the code annotation
      for (const chunk of result) {
        expect(chunk.annotations?.code).toBe(true);
        expect(chunk.text?.content.length).toBeLessThanOrEqual(NOTION_RICH_TEXT_MAX_LENGTH);
      }
    });

    it('should handle very long text requiring multiple splits', () => {
      const text = 'A'.repeat(NOTION_RICH_TEXT_MAX_LENGTH * 5 + 123);
      const result = convertMarkdownToNotionRichText(text, mockUuidMappings);

      expect(result).toHaveLength(6);
      // First 5 chunks should be at max length
      for (let i = 0; i < 5; i++) {
        expect(result[i].text?.content.length).toBe(NOTION_RICH_TEXT_MAX_LENGTH);
      }
      // Last chunk should have remaining characters
      expect(result[5].text?.content.length).toBe(123);
    });

    it('should not split mentions (non-text elements)', () => {
      // Create a mention using UUID format link
      const uuid = '12345678-1234-1234-1234-123456789012';
      const mappings: UuidMappings = {
        notionPageIDsToAtlasUUIDs: new Map(),
        atlasUUIDsToNotionPageIds: new Map([[uuid, 'notion-page-id']]),
      };

      const text = `Check [this page](${uuid})`;
      const result = convertMarkdownToNotionRichText(text, mappings);

      // Find the mention element
      const mentionElement = result.find((r) => r.type === 'mention');
      expect(mentionElement).toBeDefined();
      // Mentions should not be split regardless of content length
      expect(mentionElement?.type).toBe('mention');
    });

    it('should not split equations (non-text elements)', () => {
      const text = '$E=mc^2$';
      const result = convertMarkdownToNotionRichText(text, mockUuidMappings);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('equation');
      // Equations should not be split
    });

    it('should handle mixed content with long and short segments', () => {
      const longText = 'A'.repeat(NOTION_RICH_TEXT_MAX_LENGTH + 100);
      const text = `Short **${longText}** end`;
      const result = convertMarkdownToNotionRichText(text, mockUuidMappings);

      // Should have: "Short ", split bold segments, " end"
      expect(result.length).toBeGreaterThanOrEqual(4);

      // First element should be short text
      expect(result[0].text?.content).toBe('Short ');

      // Find all bold elements (should be split)
      const boldElements = result.filter((r) => r.annotations?.bold);
      expect(boldElements.length).toBeGreaterThanOrEqual(2);

      // All bold elements should be within limit
      for (const chunk of boldElements) {
        expect(chunk.text?.content.length).toBeLessThanOrEqual(NOTION_RICH_TEXT_MAX_LENGTH);
      }

      // Last element should be " end"
      expect(result[result.length - 1].text?.content).toBe(' end');
    });

    it('should preserve link href when splitting linked text', () => {
      // Create a long link text
      const longLinkText = 'L'.repeat(NOTION_RICH_TEXT_MAX_LENGTH + 100);
      const text = `[${longLinkText}](https://example.com)`;
      const result = convertMarkdownToNotionRichText(text, mockUuidMappings);

      expect(result.length).toBeGreaterThanOrEqual(2);
      // All split segments should preserve the href
      for (const chunk of result) {
        expect(chunk.href).toBe('https://example.com');
        expect(chunk.text?.link?.url).toBe('https://example.com');
        expect(chunk.text?.content.length).toBeLessThanOrEqual(NOTION_RICH_TEXT_MAX_LENGTH);
      }
    });
  });

  describe('array length limiting for Notion 100-element limit', () => {
    it('should export the max elements constant', () => {
      expect(NOTION_RICH_TEXT_MAX_ELEMENTS).toBe(100);
    });

    it('should not modify arrays under the limit', () => {
      // Generate text with 50 links (each link creates ~2 elements: text before + link)
      const links = Array.from({ length: 25 }, (_, i) => `[link${i}](https://example${i}.com)`).join(' ');
      const result = convertMarkdownToNotionRichText(links, mockUuidMappings);

      // Should have fewer than 100 elements
      expect(result.length).toBeLessThanOrEqual(NOTION_RICH_TEXT_MAX_ELEMENTS);
    });

    it('should merge adjacent text elements with identical annotations', () => {
      // Create text that produces multiple plain text elements after parsing
      // Bold followed by plain text followed by more plain text
      const text = '**bold** plain1 plain2 plain3';
      const result = convertMarkdownToNotionRichText(text, mockUuidMappings);

      // Should merge the plain text elements
      expect(result).toHaveLength(2); // bold + merged plain text
      expect(result[0].annotations?.bold).toBe(true);
      expect(result[1].text?.content).toBe(' plain1 plain2 plain3');
    });

    it('should not merge elements with different annotations', () => {
      // Use bold and code (not italic) to avoid pre-existing italic regex issue
      // where italic pattern matches across spaces like `* test *`
      const text = '**bold** plain `code`';
      const result = convertMarkdownToNotionRichText(text, mockUuidMappings);

      // Should have at least 2 elements with different formatting
      // (bold and code cannot be merged)
      expect(result.length).toBeGreaterThanOrEqual(2);

      const boldElement = result.find((r) => r.annotations?.bold);
      const codeElement = result.find((r) => r.annotations?.code);
      expect(boldElement).toBeDefined();
      expect(boldElement?.text?.content).toBe('bold');
      expect(codeElement).toBeDefined();
      expect(codeElement?.text?.content).toBe('code');
    });

    it('should not merge elements with links', () => {
      const text = '[link1](https://a.com) [link2](https://b.com)';
      const result = convertMarkdownToNotionRichText(text, mockUuidMappings);

      // Links should not be merged
      const linkElements = result.filter((r) => r.href);
      expect(linkElements.length).toBe(2);
    });

    it('should truncate arrays exceeding 100 elements with warning', () => {
      // Create text with many links to generate >100 elements
      // Each row: "| text | [link1](url1) [link2](url2) [link3](url3) |"
      // This creates: text + link + space + link + space + link + more text per row
      const rows = Array.from(
        { length: 20 },
        (_, i) =>
          `Row ${i}: [link${i}a](https://a${i}.com) [link${i}b](https://b${i}.com) [link${i}c](https://c${i}.com) [link${i}d](https://d${i}.com) end`,
      ).join('\n');

      // Spy on console.warn to verify the warning is logged
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = convertMarkdownToNotionRichText(rows, mockUuidMappings);

      // Should be exactly at or below the limit
      expect(result.length).toBeLessThanOrEqual(NOTION_RICH_TEXT_MAX_ELEMENTS);

      // If truncated, should have logged a warning
      if (result.length === NOTION_RICH_TEXT_MAX_ELEMENTS) {
        expect(warnSpy).toHaveBeenCalled();
        // Last element should be the truncation marker
        const lastElement = result[result.length - 1];
        expect(lastElement.text?.content).toContain('truncated');
        expect(lastElement.annotations?.italic).toBe(true);
      }

      warnSpy.mockRestore();
    });

    it('should handle table-like content with many links (real-world case)', () => {
      // Simulates the failing case from the error log
      const tableContent = `
| Delegate | Address | Contract |
|----------|---------|----------|
| User1 | [addr1](https://etherscan.io/address/0x1) [verify1](https://etherscan.io/verifySig/1) | [contract1](https://etherscan.io/address/0xa) |
| User2 | [addr2](https://etherscan.io/address/0x2) [verify2](https://etherscan.io/verifySig/2) | [contract2](https://etherscan.io/address/0xb) |
| User3 | [addr3](https://etherscan.io/address/0x3) [verify3](https://etherscan.io/verifySig/3) | [contract3](https://etherscan.io/address/0xc) |
| User4 | [addr4](https://etherscan.io/address/0x4) [verify4](https://etherscan.io/verifySig/4) | [contract4](https://etherscan.io/address/0xd) |
| User5 | [addr5](https://etherscan.io/address/0x5) [verify5](https://etherscan.io/verifySig/5) | [contract5](https://etherscan.io/address/0xe) |
| User6 | [addr6](https://etherscan.io/address/0x6) [verify6](https://etherscan.io/verifySig/6) | [contract6](https://etherscan.io/address/0xf) |
| User7 | [addr7](https://etherscan.io/address/0x7) [verify7](https://etherscan.io/verifySig/7) | [contract7](https://etherscan.io/address/0x10) |
| User8 | [addr8](https://etherscan.io/address/0x8) [verify8](https://etherscan.io/verifySig/8) | [contract8](https://etherscan.io/address/0x11) |
| User9 | [addr9](https://etherscan.io/address/0x9) [verify9](https://etherscan.io/verifySig/9) | [contract9](https://etherscan.io/address/0x12) |
| User10 | [addr10](https://etherscan.io/address/0xa) [verify10](https://etherscan.io/verifySig/10) | [contract10](https://etherscan.io/address/0x13) |
| User11 | [addr11](https://etherscan.io/address/0xb) [verify11](https://etherscan.io/verifySig/11) | [contract11](https://etherscan.io/address/0x14) |
`;
      const result = convertMarkdownToNotionRichText(tableContent, mockUuidMappings);

      // Must not exceed the 100 element limit
      expect(result.length).toBeLessThanOrEqual(NOTION_RICH_TEXT_MAX_ELEMENTS);
    });

    it('should merge adjacent text elements to stay under limit when possible', () => {
      // Create alternating bold and plain text
      // "**b** p **b** p ..." should merge consecutive plain text
      const parts = [];
      for (let i = 0; i < 30; i++) {
        parts.push(`**b${i}**`);
        parts.push(`plain${i}`);
      }
      const text = parts.join(' ');

      const result = convertMarkdownToNotionRichText(text, mockUuidMappings);

      // Should be well under 100 elements due to merging
      expect(result.length).toBeLessThan(NOTION_RICH_TEXT_MAX_ELEMENTS);
    });
  });
});
