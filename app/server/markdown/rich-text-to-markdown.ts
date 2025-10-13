/*
  Notion Rich Text → Markdown converter
  - Supports: inline formatting (bold, italic, strikethrough, code), links, mentions
  - Mentions render as Markdown links
  - Output is Markdown

  Example usage:
  ```ts
  import { convertNotionRichTextToMarkdown } from '@/app/server/markdown';

  // Rich text inline content (from Notion block rich_text)
  const mdInline = convertNotionRichTextToMarkdown([
    { type: 'text', text: { content: 'Hello ' } },
    { type: 'text', text: { content: 'World' }, annotations: { bold: true } },
  ]);
  // => "Hello **World**"
  ```
*/
import { uuidToHyphens } from '@/app/shared/utils/utils';
import { UuidMappings } from '../atlas/load-uuid-mapping';
import { NotionRichText } from './notion-types';

export function notionLinkToMappedUUID(href: string | undefined, uuidMappings: UuidMappings): string | null {
  const isNotionURL = href?.startsWith('https://www.notion.so/');
  if (!isNotionURL) {
    return null;
  }
  const notionIDFromURL = href?.replace('https://www.notion.so/', '').split('?')[0].split('#')[0].split('-').pop();
  if (!notionIDFromURL) {
    console.warn(`Could not extract Notion ID from URL: ${href}`);
    return null;
  }
  const mappedUUID = href ? uuidMappings.notionPageIDsToAtlasUUIDs.get(uuidToHyphens(notionIDFromURL)) : undefined;
  if (!mappedUUID) {
    console.warn(`No mapping found for Notion link: ${href} (${notionIDFromURL}, ${mappedUUID})`);
    return null;
  }
  return mappedUUID;
}

function wrapIf(condition: boolean | undefined, wrapper: (s: string) => string, content: string): string {
  return condition ? wrapper(content) : content;
}

function formatInlineSpan(rt: NotionRichText, uuidMappings?: UuidMappings): string {
  // Handle equation type first - equations should not be processed for formatting
  if (rt.type === 'equation') {
    const expression = rt.equation?.expression ?? rt.plain_text ?? '';
    return `$${expression}$`;
  }

  const textContent = rt.type === 'text' ? (rt.text?.content ?? rt.plain_text ?? '') : (rt.plain_text ?? '');

  // Check if this element has both code annotation and a link
  const href = rt.href || (rt.text && rt.text.link ? rt.text.link.url : undefined);
  const hasLink = !!href;
  const hasCode = !!rt.annotations?.code;

  // Special case: code + link combination
  // Use [`code`](url) format to preserve both code formatting and link
  if (hasCode && hasLink) {
    const escapedBackticks = textContent.replace(/`/g, '\\`');
    const codeFormatted = `\`${escapedBackticks}\``;

    if (!uuidMappings) {
      console.warn('No uuidMappings provided, cannot map Notion links to UUIDs');
      return `[${codeFormatted}](${href})`;
    }
    const mappedUUID = notionLinkToMappedUUID(href, uuidMappings);
    return `[${codeFormatted}](${mappedUUID || href})`;
  }

  // Inline code: don't escape inside backticks, only escape backticks themselves
  const withInlineCode = hasCode
    ? (() => {
        const escapedBackticks = textContent.replace(/`/g, '\\`');
        return `\`${escapedBackticks}\``;
      })()
    : textContent;

  // Bold, then underline (not supported in MD; keep as-is), then italic, then strike
  const withBold = wrapIf(rt.annotations?.bold, (s) => `**${s}**`, withInlineCode);
  const withUnderline = withBold; // Markdown has no underline; leave unchanged
  const withItalic = wrapIf(rt.annotations?.italic, (s) => `_${s}_`, withUnderline);
  const withStrike = wrapIf(rt.annotations?.strikethrough, (s) => `~~${s}~~`, withItalic);
  const formatted = withStrike;

  // Links: explicit href on rich text or text.link.url
  // (code+link case already handled above)
  if (hasLink && !hasCode) {
    if (!uuidMappings) {
      console.warn('No uuidMappings provided, cannot map Notion links to UUIDs');
      return `[${formatted}](${href})`;
    }
    const mappedUUID = notionLinkToMappedUUID(href, uuidMappings);
    return `[${formatted}](${mappedUUID || href})`;
  }

  // Mentions without href: just text
  if (rt.type === 'mention') {
    return formatted;
  }

  return formatted;
}

export function convertNotionRichTextToMarkdown(
  richText: NotionRichText[] | undefined | null,
  uuidMappings?: UuidMappings,
): string {
  if (!richText || richText.length === 0) return '';

  const markdown = richText.map((rt) => formatInlineSpan(rt, uuidMappings)).join('');

  // Normalize line breaks: squash multiple consecutive empty lines into single newlines
  // This includes lines with only whitespace
  return markdown
    .replace(/\n\s*\n\s*\n+/g, '\n\n') // Replace 3+ consecutive newlines with 2
    .replace(/^\n+/, '') // Remove leading newlines
    .replace(/\n+$/, ''); // Remove trailing newlines
}
