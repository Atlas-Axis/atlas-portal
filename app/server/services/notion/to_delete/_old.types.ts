// This is exported from the original Notion API types
// TODO: Remove this. Replace with a readPlainTextValueFromProperty() call
export type _delete_TextRichTextItemRequest = {
  type?: 'text';
  text: {
    content: string;
    link?: {
      url: string;
    } | null;
  };
};
