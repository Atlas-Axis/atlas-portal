import { describe, expect, it } from 'vitest';
import type { UuidMappings } from '../../atlas/load-uuid-mapping';
import type { NotionRichText } from '../notion-types';
import { convertNotionRichTextToMarkdown } from '../rich-text-to-markdown';

// Mock UuidMappings for testing
const mockUuidMappings: UuidMappings = {
  notionPageIDsToAtlasUUIDs: new Map(),
  atlasUUIDsToNotionPageIds: new Map(),
};

describe('convertNotionRichTextToMarkdown', () => {
  it('renders paragraph inline formatting (bold/italic/underline/strike/code)', () => {
    const html = convertNotionRichTextToMarkdown(
      [
        { type: 'text', text: { content: 'hello ' }, annotations: { bold: true } },
        { type: 'text', text: { content: 'world' }, annotations: { italic: true, underline: true } },
        { type: 'text', text: { content: '!' }, annotations: { strikethrough: true } },
        { type: 'text', text: { content: 'code' }, annotations: { code: true } },
      ] as NotionRichText[],
      mockUuidMappings,
    );
    expect(html).toBe('**hello **_world_~~!~~`code`');
  });

  it('renders links from href or text.link', () => {
    const html = convertNotionRichTextToMarkdown(
      [
        { type: 'text', text: { content: 'link1', link: { url: 'https://a.com' } } },
        { type: 'text', text: { content: ' ' } },
        { type: 'text', text: { content: 'link2' }, href: 'https://b.com' },
      ] as NotionRichText[],
      mockUuidMappings,
    );
    expect(html).toBe('[link1](https://a.com) [link2](https://b.com)');
  });

  it('preserves newlines as-is', () => {
    const html = convertNotionRichTextToMarkdown(
      [{ type: 'text', text: { content: 'line1\nline2' } }] as NotionRichText[],
      mockUuidMappings,
    );
    expect(html).toBe('line1\nline2');
  });

  it('renders inline code without escaping special characters inside backticks', () => {
    const html = convertNotionRichTextToMarkdown(
      [
        { type: 'text', text: { content: 'f(Utilization)' }, annotations: { code: true } },
        { type: 'text', text: { content: ' is calculated using the formula:\n\n' } },
        {
          type: 'text',
          text: {
            content:
              'f(Utilization) = Utilization * ((SKY Borrow Maximum Rate - SKY Borrow Minimum Rate + Beta) * Utilization + SKY Borrow Minimum Rate - SKY Borrow Rate)',
          },
          annotations: { code: true },
        },
      ] as NotionRichText[],
      mockUuidMappings,
    );
    expect(html).toBe(
      '`f(Utilization)` is calculated using the formula:\n\n`f(Utilization) = Utilization * ((SKY Borrow Maximum Rate - SKY Borrow Minimum Rate + Beta) * Utilization + SKY Borrow Minimum Rate - SKY Borrow Rate)`',
    );
  });

  it('renders equation type as inline math with $ delimiters', () => {
    const html = convertNotionRichTextToMarkdown(
      [{ type: 'equation', equation: { expression: 'E=mc^2' } }] as NotionRichText[],
      mockUuidMappings,
    );
    expect(html).toBe('$E=mc^2$');
  });

  it('renders mixed text and equation content', () => {
    const html = convertNotionRichTextToMarkdown(
      [
        { type: 'text', text: { content: 'The famous equation ' } },
        { type: 'equation', equation: { expression: 'E=mc^2' } },
        { type: 'text', text: { content: ' changed physics.' } },
      ] as NotionRichText[],
      mockUuidMappings,
    );
    expect(html).toBe('The famous equation $E=mc^2$ changed physics.');
  });

  it('renders complex mathematical expressions', () => {
    const html = convertNotionRichTextToMarkdown(
      [
        { type: 'equation', equation: { expression: '\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}' } },
      ] as NotionRichText[],
      mockUuidMappings,
    );
    expect(html).toBe('$\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}$');
  });

  it('handles equation with plain_text fallback', () => {
    const html = convertNotionRichTextToMarkdown(
      [{ type: 'equation', plain_text: 'x^2 + y^2 = z^2' } as NotionRichText] as NotionRichText[],
      mockUuidMappings,
    );
    expect(html).toBe('$x^2 + y^2 = z^2$');
  });

  // TODO: Verify this doesn't collide with block level equations
  it('handles equation with empty expression', () => {
    const html = convertNotionRichTextToMarkdown(
      [{ type: 'equation', equation: { expression: '' } }] as NotionRichText[],
      mockUuidMappings,
    );
    expect(html).toBe('$$');
  });

  it('renders multiple equations in sequence', () => {
    const html = convertNotionRichTextToMarkdown(
      [
        { type: 'equation', equation: { expression: 'a^2' } },
        { type: 'text', text: { content: ' + ' } },
        { type: 'equation', equation: { expression: 'b^2' } },
        { type: 'text', text: { content: ' = ' } },
        { type: 'equation', equation: { expression: 'c^2' } },
      ] as NotionRichText[],
      mockUuidMappings,
    );
    expect(html).toBe('$a^2$ + $b^2$ = $c^2$');
  });

  it('renders equation with formatting annotations (should be ignored)', () => {
    const html = convertNotionRichTextToMarkdown(
      [
        {
          type: 'equation',
          equation: { expression: 'E=mc^2' },
          annotations: { bold: true, italic: true }, // These should be ignored for equations
        },
      ] as NotionRichText[],
      mockUuidMappings,
    );
    expect(html).toBe('$E=mc^2$');
  });
});
