import { NotionBlockContent, NotionBlockListItem, RichText } from './notion-types';

export function extractPlainText(block: NotionBlockListItem): string {
  const blockType = block.type;
  if (!block[blockType]) return '';

  const content = block[blockType] as NotionBlockContent;

  // Handle text-based blocks
  if (content.rich_text && Array.isArray(content.rich_text)) {
    return content.rich_text.map((richText: RichText) => richText.plain_text || '').join('');
  }

  // Handle other block types
  // Docs: https://developers.notion.com/reference/block
  switch (blockType) {
    case 'child_page':
      return content.title || '';
    case 'child_database':
      return content.title || '';
    case 'bookmark':
      return content.url || '';
    case 'image':
      return content.caption?.map((text: RichText) => text.plain_text || '').join('') || '';
    case 'file':
      return content.name || '';
    default:
      console.warn(`Unhandled block type: ${blockType}`);
      return '';
  }
}
