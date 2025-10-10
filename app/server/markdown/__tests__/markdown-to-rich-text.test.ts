import { describe, expect, it } from 'vitest';
import type { UuidMappings } from '../../atlas/load-uuid-mapping';
import { convertMarkdownToNotionRichText } from '../markdown-to-rich-text';

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

  // TODO: Verify this is expected behavior - empty equations should be empty strings?
  it('should handle empty equations', () => {
    const result = convertMarkdownToNotionRichText('Empty equation: $$', mockUuidMappings);
    expect(result).toHaveLength(2);

    expect(result[0].text?.content).toBe('Empty equation: ');
    expect(result[1].type).toBe('equation');
    expect(result[1].equation?.expression).toBe('');
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
});
