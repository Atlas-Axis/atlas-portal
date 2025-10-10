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
});

