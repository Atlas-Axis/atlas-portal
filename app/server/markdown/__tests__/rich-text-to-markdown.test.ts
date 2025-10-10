import { describe, expect, it } from 'vitest';
import type { UuidMappings } from '../../atlas/load-uuid-mapping';
import type { NotionBlock, NotionRichText } from '../notion-types';
import { convertNotionBlocksToMarkdown, convertNotionRichTextToMarkdown } from '../rich-text-to-markdown';

// Mock UuidMappings for testing
const mockUuidMappings: UuidMappings = {
  notionPageIDsToAtlasUUIDs: new Map(),
  atlasUUIDsToNotionPageIds: new Map(),
};

describe('convertNotionRichTextToHtml', () => {
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

  it('converts newlines to Markdown line breaks', () => {
    const html = convertNotionRichTextToMarkdown(
      [{ type: 'text', text: { content: 'line1\nline2' } }] as NotionRichText[],
      mockUuidMappings,
    );
    expect(html).toBe('line1  \nline2');
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
      '`f(Utilization)` is calculated using the formula:  \n  \n`f(Utilization) = Utilization * ((SKY Borrow Maximum Rate - SKY Borrow Minimum Rate + Beta) * Utilization + SKY Borrow Minimum Rate - SKY Borrow Rate)`',
    );
  });
});

describe('convertNotionBlocksToHtml (Markdown output)', () => {
  it('renders paragraphs', () => {
    const md = convertNotionBlocksToMarkdown(
      [
        { type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: 'Hello' } }] } },
      ] as NotionBlock[],
      mockUuidMappings,
    );
    expect(md).toBe('Hello');
  });

  it('renders code block with language', () => {
    const md = convertNotionBlocksToMarkdown(
      [
        { type: 'code', code: { language: 'ts', rich_text: [{ type: 'text', text: { content: 'const x = 1 < 2' } }] } },
      ] as NotionBlock[],
      mockUuidMappings,
    );
    expect(md).toBe('```ts\nconst x = 1 < 2\n```');
  });

  it('renders lists (bulleted and numbered)', () => {
    const md = convertNotionBlocksToMarkdown(
      [
        { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'a' } }] } },
        { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'b' } }] } },
        { type: 'numbered_list_item', numbered_list_item: { rich_text: [{ type: 'text', text: { content: 'c' } }] } },
        { type: 'numbered_list_item', numbered_list_item: { rich_text: [{ type: 'text', text: { content: 'd' } }] } },
      ] as NotionBlock[],
      mockUuidMappings,
    );
    expect(md).toBe('- a\n- b\n1. c\n2. d');
  });

  it('renders nested list children', () => {
    const md = convertNotionBlocksToMarkdown(
      [
        {
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ type: 'text', text: { content: 'parent' } }],
            children: [
              {
                type: 'bulleted_list_item',
                bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'child' } }] },
              },
            ],
          },
        },
      ] as NotionBlock[],
      mockUuidMappings,
    );
    expect(md).toBe('- parent\n  - child');
  });

  it('renders table with rows and cells (GFM)', () => {
    const md = convertNotionBlocksToMarkdown(
      [
        {
          type: 'table',
          table: {
            has_column_header: true,
            children: [
              {
                type: 'table_row',
                table_row: {
                  cells: [[{ type: 'text', text: { content: 'A' } }], [{ type: 'text', text: { content: 'B' } }]],
                },
              },
              {
                type: 'table_row',
                table_row: {
                  cells: [[{ type: 'text', text: { content: '1' } }], [{ type: 'text', text: { content: '2' } }]],
                },
              },
            ],
          },
        },
      ] as NotionBlock[],
      mockUuidMappings,
    );
    expect(md).toBe(['| A | B |', '| --- | --- |', '| 1 | 2 |'].join('\n'));
  });

  it('renders table without escaping pipe characters in cell content', () => {
    const md = convertNotionBlocksToMarkdown(
      [
        {
          type: 'table',
          table: {
            has_column_header: true,
            children: [
              {
                type: 'table_row',
                table_row: {
                  cells: [
                    [{ type: 'text', text: { content: 'Date' } }],
                    [{ type: 'text', text: { content: 'Conserver Role' } }],
                    [{ type: 'text', text: { content: 'Identity' } }],
                  ],
                },
              },
              {
                type: 'table_row',
                table_row: {
                  cells: [
                    [{ type: 'text', text: { content: '2023-06-08' } }],
                    [{ type: 'text', text: { content: 'AVC Member' } }],
                    [{ type: 'text', text: { content: 'HKUST_EPI_BLOCKCHAIN' } }],
                  ],
                },
              },
            ],
          },
        },
      ] as NotionBlock[],
      mockUuidMappings,
    );
    expect(md).toBe(
      [
        '| Date | Conserver Role | Identity |',
        '| --- | --- | --- |',
        '| 2023-06-08 | AVC Member | HKUST_EPI_BLOCKCHAIN |',
      ].join('\n'),
    );
  });

  it('renders headings as markdown', () => {
    const md = convertNotionBlocksToMarkdown(
      [
        { type: 'heading_1', heading_1: { rich_text: [{ type: 'text', text: { content: 'Title' } }] } },
        { type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: 'Subtitle' } }] } },
        { type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: 'Section' } }] } },
      ] as NotionBlock[],
      mockUuidMappings,
    );
    expect(md).toBe('# Title\n## Subtitle\n### Section');
  });
});
