import { RichTextItemResponse } from '@notionhq/client';
import { markdownToHTML } from '@/app/server/markdown/markdown-to-html';
import { NotionDatabasePage } from '../database/notion-database-page';
import { convertNotionRichTextToMarkdown } from '../markdown/rich-text-to-markdown';
import { AtlasTreeNode } from './atlas-tree-types';

export function atlasDatabasePageToMarkdown<T extends NotionDatabasePage | AtlasTreeNode>(page: T): string {
  if (page.json_content && Array.isArray(page.json_content)) {
    const richText = page.json_content as RichTextItemResponse[];
    const result = convertRichTextToMarkdown(richText);

    if (
      page.notion_page_id === 'c518c0b4-dea2-4c6f-8ef8-231d61dd375c' ||
      page.notion_page_id === '151f2ff0-8d73-806a-b3c8-d334d3fb5e0f'
    ) {
      console.log('Markdown conversion for page c518c0b4-dea2-4c6f-8ef8-231d61dd375c');
      console.log(result);
    }
    return result;
  }
  console.warn(`Page ${page.notion_page_id} has no valid json_content for markdown conversion.`);
  return '';
}

export function atlasDatabasePageToHTML<T extends NotionDatabasePage | AtlasTreeNode>(page: T): string {
  if (page.json_content && Array.isArray(page.json_content)) {
    const richText = page.json_content as RichTextItemResponse[];
    const markdown = convertRichTextToMarkdown(richText);
    if (
      page.notion_page_id === 'c518c0b4-dea2-4c6f-8ef8-231d61dd375c' ||
      page.notion_page_id === '151f2ff0-8d73-806a-b3c8-d334d3fb5e0f'
    ) {
      console.log('HTML conversion for page c518c0b4-dea2-4c6f-8ef8-231d61dd375c');
      console.log(markdownToHTML(markdown));
    }
    return markdownToHTML(markdown);
  }
  console.warn(`Page ${page.notion_page_id} has no valid json_content for HTML conversion.`);
  return '';
}

function convertRichTextToMarkdown(richText: RichTextItemResponse[]): string {
  // For table content, we need to avoid escaping pipe characters and underscores
  // This is a simplified approach that detects table-like patterns and handles them specially
  const plainText = richText.map((rt) => rt.plain_text || '').join('');
  const isTable = hasTableLikePattern(plainText);

  if (isTable) {
    return convertTableRichTextToMarkdown(richText);
  }

  // For non-table content, use the regular converter
  return convertNotionRichTextToMarkdown(richText);
}

// Specialized function to handle table content in rich text without escaping
function convertTableRichTextToMarkdown(richText: RichTextItemResponse[]): string {
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
      if (
        href &&
        (href.startsWith('https://') ||
          href.startsWith('http://') ||
          href.startsWith('mailto:') ||
          href.startsWith('tel:') ||
          href.startsWith('/') ||
          href.startsWith('#'))
      ) {
        formatted = `[${formatted}](${href})`;
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
