/*
  Shared types for Notion Rich Text and Block conversion
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

export type NotionRichText = {
  type: 'text' | 'mention' | 'equation' | string;
  plain_text?: string;
  href?: string | null;
  annotations?: NotionAnnotations;
  text?: { content: string; link?: { url: string } | null };
  mention?: unknown;
  equation?: { expression: string };
};

export type NotionBlock = {
  type: string;
  paragraph?: { rich_text?: NotionRichText[] };
  heading_1?: { rich_text?: NotionRichText[] };
  heading_2?: { rich_text?: NotionRichText[] };
  heading_3?: { rich_text?: NotionRichText[] };
  bulleted_list_item?: { rich_text?: NotionRichText[]; children?: NotionBlock[] };
  numbered_list_item?: { rich_text?: NotionRichText[]; children?: NotionBlock[] };
  code?: { rich_text?: NotionRichText[]; language?: string };
  equation?: { expression: string };
  table?: {
    table_width?: number;
    has_column_header?: boolean;
    has_row_header?: boolean;
    children?: NotionBlock[]; // expected to be table_row
  };
  table_row?: { cells: NotionRichText[][] };
  // Allow other fields without typing them
  [key: string]: unknown;
};

// Helper type for creating rich text objects
export type CreateRichTextOptions = {
  content: string;
  annotations?: NotionAnnotations;
  href?: string;
  type?: 'text' | 'equation';
  equation?: { expression: string };
};

// Helper type for creating block objects
export type CreateBlockOptions = {
  type: string;
  rich_text?: NotionRichText[];
  language?: string;
  expression?: string;
  children?: NotionBlock[];
  table?: {
    table_width?: number;
    has_column_header?: boolean;
    has_row_header?: boolean;
    children?: NotionBlock[];
  };
  table_row?: { cells: NotionRichText[][] };
};
