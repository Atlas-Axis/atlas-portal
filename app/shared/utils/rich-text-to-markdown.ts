import type { RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints.js';
import { NotionToMarkdown } from 'notion-to-md';
import type { NotionToMarkdownOptions } from 'notion-to-md/build/types/index.js';

const n2m = new NotionToMarkdown({} as NotionToMarkdownOptions);

export function richTextToMarkdown(richText: RichTextItemResponse[]): Promise<string> {
  if (!richText || !Array.isArray(richText)) {
    return Promise.resolve('');
  }

  // Log a warning if there are any unsupported types in the rich text array
  richText.forEach((item: RichTextItemResponse) => {
    if (item.type === 'mention') {
      console.warn('Mention type in rich text is not supported for markdown conversion.');
    }
  });

  return n2m.blockToMarkdown({
    type: 'paragraph',
    paragraph: {
      rich_text: richText,
      color: 'default',
    },
    object: 'block',
    id: '',
  });
}
