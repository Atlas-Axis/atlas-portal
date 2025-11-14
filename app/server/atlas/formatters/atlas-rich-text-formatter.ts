import { RichTextItemResponse } from '@notionhq/client';
import { markdownToHTML } from '@/app/server/markdown/markdown-to-html';
import { NotionDatabasePage } from '../../database/notion-database-page';
import { convertNotionRichTextToMarkdown, notionLinkToMappedUUID } from '../../markdown/rich-text-to-markdown';
import { UuidMappings } from '../load-uuid-mapping';
import { AtlasTreeNode } from '../tree/atlas-tree-system';

export function atlasDatabasePageToMarkdown<T extends NotionDatabasePage | AtlasTreeNode>(
  page: T,
  uuidMappings: UuidMappings,
): string {
  if (page.json_content && Array.isArray(page.json_content)) {
    const richText = page.json_content as RichTextItemResponse[];
    const result = convertRichTextToMarkdown(richText, uuidMappings);

    return result;
  }
  console.warn(`Page ${page.notion_page_id} has no valid json_content for markdown conversion.`);
  return '';
}

// TODO: This is not used anywhere, and should be removed
export function atlasDatabasePageToHTML<T extends NotionDatabasePage | AtlasTreeNode>(
  page: T,
  uuidMappings: UuidMappings,
): string {
  if (page.json_content && Array.isArray(page.json_content)) {
    const richText = page.json_content as RichTextItemResponse[];
    const markdown = convertRichTextToMarkdown(richText, uuidMappings);

    return markdownToHTML(markdown);
  }
  console.warn(`Page ${page.notion_page_id} has no valid json_content for HTML conversion.`);
  return '';
}

function convertRichTextToMarkdown(richText: RichTextItemResponse[], uuidMappings: UuidMappings): string {
  // Handle non-array or null/undefined inputs
  if (!richText || !Array.isArray(richText)) {
    return '';
  }

  // For table content, we need to avoid escaping pipe characters and underscores
  // This is a simplified approach that detects table-like patterns and handles them specially
  const plainText = richText.map((rt) => rt.plain_text || '').join('');
  const isTable = hasTableLikePattern(plainText);

  if (isTable) {
    return convertTableRichTextToMarkdown(richText, uuidMappings);
  }

  // For non-table content, use the regular converter
  return convertNotionRichTextToMarkdown(richText, uuidMappings);
}

// Specialized function to handle table content in rich text without escaping
function convertTableRichTextToMarkdown(richText: RichTextItemResponse[], uuidMappings: UuidMappings): string {
  // For table content, manually construct the markdown without escaping
  return richText
    .map((rt) => {
      const text = rt.plain_text || '';
      // Apply basic formatting but don't escape pipe characters or underscores
      let formatted = text;

      if (rt.annotations?.bold) {
        formatted = `**${formatted}**`;
      }
      if (rt.annotations?.italic) {
        formatted = `_${formatted}_`;
      }
      if (rt.annotations?.strikethrough) {
        formatted = `~~${formatted}~~`;
      }
      if (rt.annotations?.code) {
        // For inline code, only escape backticks
        const escapedBackticks = formatted.replace(/`/g, '\\`');
        formatted = `\`${escapedBackticks}\``;
      }

      // Handle links
      const href = rt.href || (rt.type === 'text' && 'text' in rt && rt.text?.link ? rt.text.link.url : undefined);
      if (href) {
        const mappedUUID = notionLinkToMappedUUID(href, uuidMappings);
        formatted = `[${formatted}](${mappedUUID || href})`;
      }

      return formatted;
    })
    .join('')
    .replace(/\n/g, '  \n');
}

function hasTableLikePattern(text: string): boolean {
  // For table content, we need to avoid escaping pipe characters and underscores
  // This is a simplified approach that detects table-like patterns and handles them specially
  const pipeCount = (text.match(/\|/g) || []).length;
  const dashCount = (text.match(/---/g) || []).length;
  return pipeCount >= 2 && dashCount >= 1;
}
