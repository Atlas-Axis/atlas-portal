import { BlockObjectResponse } from '@notionhq/client';
import {
  BookmarkBlockObjectResponse,
  ChildDatabaseBlockObjectResponse,
  ChildPageBlockObjectResponse,
  EquationBlockObjectResponse,
  FileBlockObjectResponse,
  ImageBlockObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';

interface RichTextObject {
  plain_text: string;
}

export function extractPlainText(block: BlockObjectResponse): string {
  const blockType = block.type;

  // If `rich_text` property exists, extract plain text
  const content = (block as Record<string, unknown>)[blockType] as Record<string, unknown>;
  const richTextObject = content?.rich_text as RichTextObject[] | null;

  // Handle text-based blocks
  if (richTextObject && Array.isArray(richTextObject)) {
    return richTextObject.map((richText: RichTextObject) => richText.plain_text || '').join(' ');
  }

  // Handle other block types that may contain text in different properties
  // Docs: https://developers.notion.com/reference/block
  switch (blockType) {
    case 'bookmark':
      return (block as BookmarkBlockObjectResponse).bookmark.url || '';
    case 'equation':
      return (block as EquationBlockObjectResponse).equation.expression || '';
    case 'image':
      return (
        (block as ImageBlockObjectResponse).image.caption
          ?.map((text: RichTextObject) => text.plain_text || '')
          .join('') || ''
      );
    case 'table':
      return '[TABLE]';
    case 'table_row':
      return '[TABLE ROW]';
    case 'file':
      return (block as FileBlockObjectResponse).file.name || '';
    case 'child_page':
      return (block as ChildPageBlockObjectResponse).child_page.title || '';
    case 'child_database':
      return (block as ChildDatabaseBlockObjectResponse).child_database.title || '';
    default:
      console.warn(`Unhandled block type: ${blockType}`);
      return '';
  }
}
