import { RichTextItemResponse } from '@notionhq/client';
import { markdownToHTML } from '@/app/server/markdown/render';
import { NotionDatabasePage } from '../database/notion-database-page';
import { convertNotionRichTextToMarkdown } from '../markdown/rich-text-to-markdown';
import { AtlasTreeNode } from './atlas-tree-types';

export function atlasDatabasePageToMarkdown<T extends NotionDatabasePage | AtlasTreeNode>(page: T): string {
  if (page.json_content && Array.isArray(page.json_content)) {
    const richText = page.json_content as RichTextItemResponse[];
    return convertNotionRichTextToMarkdown(richText);
  }
  console.warn(`Page ${page.notion_page_id} has no valid json_content for markdown conversion.`);
  return '';
}

export function atlasDatabasePageToHTML<T extends NotionDatabasePage | AtlasTreeNode>(page: T): string {
  if (page.json_content && Array.isArray(page.json_content)) {
    const richText = page.json_content as RichTextItemResponse[];
    return markdownToHTML(convertNotionRichTextToMarkdown(richText));
  }
  console.warn(`Page ${page.notion_page_id} has no valid json_content for HTML conversion.`);
  return '';
}
