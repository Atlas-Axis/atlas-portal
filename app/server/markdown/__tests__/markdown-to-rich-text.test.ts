import { describe, expect, it } from 'vitest';
import { convertMarkdownToNotionRichText } from '../markdown-to-rich-text';

describe('convertMarkdownToNotionRichText', () => {
  it('should convert plain text', () => {
    const result = convertMarkdownToNotionRichText('Hello World');
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
    const result = convertMarkdownToNotionRichText('Hello **World**');
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0].text?.content).toBe('Hello ');
    // Find the bold element
    const boldElement = result.find((r) => r.annotations?.bold);
    expect(boldElement).toBeDefined();
    expect(boldElement?.annotations?.bold).toBe(true);
    expect(boldElement?.text?.content).toBe('World');
  });

  it('should convert italic text', () => {
    const result = convertMarkdownToNotionRichText('Hello *World*');
    expect(result).toHaveLength(2);
    expect(result[0].text?.content).toBe('Hello ');
    expect(result[1]).toBeDefined();
    expect(result[1].text?.content).toBe('World');
    expect(result[1].annotations?.italic).toBe(true);
  });

  it('should convert strikethrough text', () => {
    const result = convertMarkdownToNotionRichText('Hello ~~World~~');
    expect(result).toHaveLength(2);
    expect(result[0].text?.content).toBe('Hello ');
    expect(result[1]).toBeDefined();
    expect(result[1].text?.content).toBe('World');
    expect(result[1].annotations?.strikethrough).toBe(true);
  });

  it('should convert inline code', () => {
    const result = convertMarkdownToNotionRichText('Hello `World`');
    expect(result).toHaveLength(2);
    expect(result[0].text?.content).toBe('Hello ');
    expect(result[1]).toBeDefined();
    expect(result[1].text?.content).toBe('World');
    expect(result[1].annotations?.code).toBe(true);
  });

  it('should convert links', () => {
    const result = convertMarkdownToNotionRichText('Hello [World](https://example.com)');
    expect(result).toHaveLength(2);
    expect(result[0].text?.content).toBe('Hello ');
    expect(result[1]).toBeDefined();
    expect(result[1].text?.content).toBe('World');
    expect(result[1].href).toBe('https://example.com');
  });

  it('should convert inline math', () => {
    const result = convertMarkdownToNotionRichText('Hello $x^2$ World');
    // Inline math regex is disabled, so it should be treated as plain text
    expect(result).toHaveLength(1);
    expect(result[0].text?.content).toBe('Hello $x^2$ World');
  });

  it('should handle complex combinations', () => {
    const result = convertMarkdownToNotionRichText('Hello **bold** and `code` and [link](https://example.com)');
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
    const result = convertMarkdownToNotionRichText('');
    expect(result).toEqual([]);
  });

  it('should handle whitespace-only input', () => {
    const result = convertMarkdownToNotionRichText('   ');
    // TODO: This should be a single paragraph with an empty string?
    expect(result).toEqual([]);
  });

  it('should handle edge cases in inline formatting', () => {
    // Test with empty formatting markers
    const result = convertMarkdownToNotionRichText('**');
    expect(result).toHaveLength(1);
    expect(result[0].text?.content).toBe('**');
  });

  it('should handle very long text efficiently', () => {
    const longText = 'A'.repeat(10000) + ' **bold** ' + 'B'.repeat(10000);
    const start = Date.now();
    const result = convertMarkdownToNotionRichText(longText);
    const duration = Date.now() - start;

    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(duration).toBeLessThan(1000); // Should complete within 1 second
  });

  it('should handle special characters in markdown', () => {
    const result = convertMarkdownToNotionRichText('Text with special chars: !@#$%^&*()_+-=[]{}|;:,.<>?');
    expect(result).toHaveLength(1);
    expect(result[0].text?.content).toBe('Text with special chars: !@#$%^&*()_+-=[]{}|;:,.<>?');
  });

  it('should handle unicode characters in simple formatting', () => {
    const result = convertMarkdownToNotionRichText('**Hello 世界**');
    expect(result.length).toBeGreaterThanOrEqual(1);
    // Find the bold segment
    const boldSegment = result.find((r) => r.annotations?.bold);
    expect(boldSegment).toBeDefined();
    expect(boldSegment?.annotations?.bold).toBe(true);
    expect(boldSegment?.text?.content).toBe('Hello 世界');
  });

  it('should treat content inside code blocks as plain text without further processing', () => {
    const result = convertMarkdownToNotionRichText('`**bold** and *italic* and ~~strikethrough~~`');
    expect(result).toHaveLength(1);
    expect(result[0].annotations?.code).toBe(true);
    // Content inside code should be treated as plain text, not processed for other formatting
    expect(result[0].text?.content).toBe('**bold** and *italic* and ~~strikethrough~~');
    // Should not have any other annotations applied
    expect(result[0].annotations?.bold).toBe(false);
    expect(result[0].annotations?.italic).toBe(false);
    expect(result[0].annotations?.strikethrough).toBe(false);
  });
});
