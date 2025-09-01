// This is exported from the original Notion API types
export type TextRichTextItemRequest = {
  type?: 'text';
  text: {
    content: string;
    link?: {
      url: string;
    } | null;
  };
};
