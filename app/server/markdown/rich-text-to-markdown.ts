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
    { type: 'text', text: { content: 'World $x^2$' }, annotations: { bold: true } },
  ]);
  // => "Hello **World $x^2$**"
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
  const textContent = rt.type === 'text' ? (rt.text?.content ?? rt.plain_text ?? '') : (rt.plain_text ?? '');

  // Inline code: don't escape inside backticks, only escape backticks themselves
  const withInlineCode = rt.annotations?.code
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
  const href = rt.href || (rt.text && rt.text.link ? rt.text.link.url : undefined);
  if (href) {
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
  return richText.map((rt) => formatInlineSpan(rt, uuidMappings)).join('');
  // Removed: .replace(/\n/g, '  \n') - this was causing extra spaces
}


