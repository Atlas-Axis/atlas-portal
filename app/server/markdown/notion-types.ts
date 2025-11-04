/*
  Shared types for Notion Rich Text conversion
  Used by both rich-text-to-markdown.ts and markdown-to-rich-text.ts
*/

export type NotionAnnotations = {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  code?: boolean;
  color?: string;
};

export type NotionMention =
  | {
      type: 'page';
      page: {
        id: string;
      };
    }
  | {
      type: 'database';
      database: {
        id: string;
      };
    }
  | {
      type: 'user';
      user: {
        id: string;
      };
    }
  | {
      type: 'date';
      date: {
        start: string;
        end?: string | null;
      };
    }
  | {
      type: 'link_preview' | 'template_mention' | 'link_mention' | 'custom_emoji';
      [key: string]: unknown;
    };

export type NotionRichText = {
  type: 'text' | 'mention' | 'equation' | string;
  plain_text?: string;
  href?: string | null;
  annotations?: NotionAnnotations;
  text?: { content: string; link?: { url: string } | null };
  mention?: NotionMention;
  equation?: { expression: string };
};

// Helper type for creating rich text objects
export type CreateRichTextOptions = {
  content: string;
  annotations?: NotionAnnotations;
  href?: string;
  type?: 'text';
};

// Notion block types for markdown conversion
export type NotionBlock = {
  type: string;
  paragraph?: { rich_text: NotionRichText[] };
  code?: { language: string; rich_text: NotionRichText[] };
  heading_1?: { rich_text: NotionRichText[] };
  heading_2?: { rich_text: NotionRichText[] };
  heading_3?: { rich_text: NotionRichText[] };
  bulleted_list_item?: { rich_text: NotionRichText[]; children?: NotionBlock[] };
  numbered_list_item?: { rich_text: NotionRichText[]; children?: NotionBlock[] };
  table?: { children?: NotionBlock[]; has_column_header?: boolean };
  table_row?: { children?: NotionBlock[]; cells?: NotionRichText[][] };
  table_cell?: { rich_text: NotionRichText[] };
  plain_text?: string;
};
