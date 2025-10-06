/*
  Notion Rich Text/Blocks → Markdown converter
  - Supports: paragraph, inline code (annotations.code), code block, equation (rich_text type), link, lists, table/table_row
  - Mentions render as Markdown links when href present
  - Unsupported types fall back to plain_text where available
  - Output is Markdown (GFM for tables)

  Example usage:
  ```ts
  import { convertNotionRichTextToMarkdown, convertNotionBlocksToMarkdown } from '@/app/server/markdown';

  // Rich text inline content (from Notion block rich_text)
  const mdInline = convertNotionRichTextToMarkdown([
    { type: 'text', text: { content: 'Hello ' } },
    { type: 'text', text: { content: 'World' }, annotations: { bold: true } },
    { type: 'equation', equation: { expression: 'x^2' } },
  ]);
  // => "Hello **World**$x^2$"

  // Full blocks (paragraph, list, code, table)
  const mdBlocks = convertNotionBlocksToMarkdown([
    { type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: 'Intro' } }] } },
    { type: 'code', code: { language: 'ts', rich_text: [{ type: 'text', text: { content: 'const x = 1;' } }] } },
  ]);
  // => "Intro\n```ts\nconst x = 1;\n```"
  ```
*/

export type NotionAnnotations = {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  code?: boolean;
  color?: string;
};

export type NotionRichText = {
  type: 'text' | 'mention' | 'equation' | string;
  plain_text?: string;
  href?: string | null;
  annotations?: NotionAnnotations;
  text?: { content: string; link?: { url: string } | null };
  mention?: unknown;
  equation?: { expression: string };
};

export type NotionBlock = {
  type: string;
  paragraph?: { rich_text?: NotionRichText[] };
  heading_1?: { rich_text?: NotionRichText[] };
  heading_2?: { rich_text?: NotionRichText[] };
  heading_3?: { rich_text?: NotionRichText[] };
  bulleted_list_item?: { rich_text?: NotionRichText[]; children?: NotionBlock[] };
  numbered_list_item?: { rich_text?: NotionRichText[]; children?: NotionBlock[] };
  code?: { rich_text?: NotionRichText[]; language?: string };
  equation?: { expression: string };
  table?: {
    table_width?: number;
    has_column_header?: boolean;
    has_row_header?: boolean;
    children?: NotionBlock[]; // expected to be table_row
  };
  table_row?: { cells: NotionRichText[][] };
  // Allow other fields without typing them
  [key: string]: unknown;
};

function escapeMarkdown(input: string): string {
  // Minimal escaping for Markdown special characters outside code spans
  return input
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function escapeMarkdownForTable(input: string): string {
  // For table cells, don't escape pipe characters or underscores as they're handled by table structure
  return input
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function sanitizeHref(href: string | undefined): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('#')
  ) {
    return trimmed;
  }
  return null;
}

function wrapIf(condition: boolean | undefined, wrapper: (s: string) => string, content: string): string {
  return condition ? wrapper(content) : content;
}

function formatInlineSpan(rt: NotionRichText): string {
  const textContent =
    rt.type === 'equation'
      ? (rt.equation?.expression ?? rt.plain_text ?? '')
      : rt.type === 'text'
        ? (rt.text?.content ?? rt.plain_text ?? '')
        : (rt.plain_text ?? '');

  // Inline code: don't escape inside backticks, only escape backticks themselves
  const withInlineCode = rt.annotations?.code
    ? (() => {
        const escapedBackticks = textContent.replace(/`/g, '\\`');
        return `\`${escapedBackticks}\``;
      })()
    : escapeMarkdown(textContent);
  // Bold, then underline (not supported in MD; keep as-is), then italic, then strike
  const withBold = wrapIf(rt.annotations?.bold, (s) => `**${s}**`, withInlineCode);
  const withUnderline = withBold; // Markdown has no underline; leave unchanged
  const withItalic = wrapIf(rt.annotations?.italic, (s) => `_${s}_`, withUnderline);
  const withStrike = wrapIf(rt.annotations?.strikethrough, (s) => `~~${s}~~`, withItalic);

  // Links: explicit href on rich text or text.link.url
  const href = rt.href || (rt.text && rt.text.link ? rt.text.link.url : undefined);
  const sanitized = sanitizeHref(href);
  if (sanitized) {
    const txt = withStrike;
    return `[${txt}](${sanitized})`;
  }

  // Mentions without href: just text
  if (rt.type === 'mention') {
    return withStrike;
  }

  // Equation as inline math
  if (rt.type === 'equation') {
    return `$${textContent}$`;
  }

  return withStrike;
}

function formatInlineSpanForTable(rt: NotionRichText): string {
  const textContent =
    rt.type === 'equation'
      ? (rt.equation?.expression ?? rt.plain_text ?? '')
      : rt.type === 'text'
        ? (rt.text?.content ?? rt.plain_text ?? '')
        : (rt.plain_text ?? '');

  // Inline code: don't escape inside backticks, only escape backticks themselves
  const withInlineCode = rt.annotations?.code
    ? (() => {
        const escapedBackticks = textContent.replace(/`/g, '\\`');
        return `\`${escapedBackticks}\``;
      })()
    : escapeMarkdownForTable(textContent);

  // Bold, then underline (not supported in MD; keep as-is), then italic, then strike
  const withBold = wrapIf(rt.annotations?.bold, (s) => `**${s}**`, withInlineCode);
  const withUnderline = withBold; // Markdown has no underline; leave unchanged
  const withItalic = wrapIf(rt.annotations?.italic, (s) => `_${s}_`, withUnderline);
  const withStrike = wrapIf(rt.annotations?.strikethrough, (s) => `~~${s}~~`, withItalic);

  // Links: explicit href on rich text or text.link.url
  const href = rt.href || (rt.text && rt.text.link ? rt.text.link.url : undefined);
  const sanitized = sanitizeHref(href);
  if (sanitized) {
    const txt = withStrike;
    return `[${txt}](${sanitized})`;
  }

  // Mentions without href: just text
  if (rt.type === 'mention') {
    return withStrike;
  }

  // Equation as inline math
  if (rt.type === 'equation') {
    return `$${textContent}$`;
  }

  return withStrike;
}

export function convertNotionRichTextToMarkdown(richText: NotionRichText[] | undefined | null): string {
  if (!richText || richText.length === 0) return '';
  return richText.map(formatInlineSpan).join('').replace(/\n/g, '  \n');
}

function renderParagraph(block: NotionBlock): string {
  const md = convertNotionRichTextToMarkdown(block.paragraph?.rich_text);
  return md;
}

function renderCodeBlock(block: NotionBlock): string {
  const parts = block.code?.rich_text || [];
  const raw = parts
    .map((rt) => (rt.type === 'text' ? (rt.text?.content ?? rt.plain_text ?? '') : (rt.plain_text ?? '')))
    .join('');
  const lang = block.code?.language || '';
  const fence = '```';
  const language = lang ? lang : '';
  return `${fence}${language ? language : ''}\n${raw}\n${fence}`;
}

function renderEquationBlock(block: NotionBlock): string {
  const expr = block.equation?.expression ?? '';
  return expr ? `$$${expr}$$` : '';
}

function groupListItems(blocks: NotionBlock[]): { html: string; consumed: number } {
  if (blocks.length === 0) return { html: '', consumed: 0 };
  const first = blocks[0];
  const isBullet = first.type === 'bulleted_list_item';
  const isNumber = first.type === 'numbered_list_item';
  if (!isBullet && !isNumber) return { html: '', consumed: 0 };

  const isOrdered = isNumber;
  let i = 0;
  const items: string[] = [];
  let ord = 1;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.type !== first.type) break;
    const rt = (isBullet ? b.bulleted_list_item : b.numbered_list_item) as {
      rich_text?: NotionRichText[];
      children?: NotionBlock[];
    };
    const content = convertNotionRichTextToMarkdown(rt?.rich_text);
    let nested = '';
    if (rt?.children && rt.children.length > 0) {
      // indent nested list by two spaces per GFM common style
      const nestedMd = convertNotionBlocksToMarkdown(rt.children)
        .split('\n')
        .map((line) => (line.length ? `  ${line}` : line))
        .join('\n');
      nested = `\n${nestedMd}`;
    }
    const marker = isOrdered ? `${ord}. ` : `- `;
    items.push(`${marker}${content}${nested}`);
    if (isOrdered) ord += 1;
    i += 1;
  }
  return { html: items.join('\n'), consumed: i };
}

function renderTable(block: NotionBlock): string {
  const rows = (block.table?.children || []).filter((c: NotionBlock) => c.type === 'table_row');
  const mdRows = rows.map((row) => {
    const cells = row.table_row?.cells || [];
    const cellMd = cells.map((cellRt) => cellRt.map(formatInlineSpanForTable).join('')).join(' | ');
    return `| ${cellMd} |`;
  });
  if (mdRows.length === 0) return '';
  const colCount = (rows[0].table_row?.cells || []).length;
  const headerProvided = !!block.table?.has_column_header;
  const header = headerProvided ? mdRows[0] : `| ${Array(colCount).fill(' ').join(' | ')} |`;
  const separator = `| ${Array(colCount).fill('---').join(' | ')} |`;
  const body = headerProvided ? mdRows.slice(1) : mdRows;
  return [header, separator, ...body].join('\n');
}

function renderHeading(block: NotionBlock): string {
  const level = block.type === 'heading_1' ? 1 : block.type === 'heading_2' ? 2 : 3;
  const container = (block as Record<string, unknown>)[block.type] as { rich_text?: NotionRichText[] } | undefined;
  const rich = container?.rich_text;
  const md = convertNotionRichTextToMarkdown(rich);
  return md ? `${'#'.repeat(level)} ${md}` : '';
}

export function convertNotionBlocksToMarkdown(blocks: NotionBlock[] | undefined | null): string {
  if (!blocks || blocks.length === 0) return '';
  const output: string[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    switch (block.type) {
      case 'paragraph':
        output.push(renderParagraph(block));
        break;
      case 'heading_1':
      case 'heading_2':
      case 'heading_3':
        output.push(renderHeading(block));
        break;
      case 'code':
        output.push(renderCodeBlock(block));
        break;
      case 'equation':
        output.push(renderEquationBlock(block));
        break;
      case 'bulleted_list_item':
      case 'numbered_list_item': {
        const { html, consumed } = groupListItems(blocks.slice(i));
        output.push(html);
        i += consumed - 1; // advance past grouped items
        break;
      }
      case 'table':
        output.push(renderTable(block));
        break;
      case 'table_row':
        // handled by parent table
        break;
      default: {
        // Fallback: try common rich_text container, else plain text if available
        const container = (block as Record<string, unknown>)[block.type] as
          | { rich_text?: NotionRichText[] }
          | undefined;
        const rich = container?.rich_text;
        if (rich && Array.isArray(rich)) {
          output.push(convertNotionRichTextToMarkdown(rich));
        } else if (typeof block.plain_text === 'string') {
          output.push(escapeMarkdown(block.plain_text));
        }
        break;
      }
    }
  }
  return output.filter(Boolean).join('\n');
}

const NotionMarkdown = {
  convertNotionRichTextToMarkdown,
  convertNotionBlocksToMarkdown,
};

export default NotionMarkdown;
