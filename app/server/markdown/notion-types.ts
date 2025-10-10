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

export type NotionRichText = {
  type: 'text' | 'mention' | 'equation' | string;
  plain_text?: string;
  href?: string | null;
  annotations?: NotionAnnotations;
  text?: { content: string; link?: { url: string } | null };
  mention?: unknown;
  equation?: { expression: string };
};

// Helper type for creating rich text objects
export type CreateRichTextOptions = {
  content: string;
  annotations?: NotionAnnotations;
  href?: string;
  type?: 'text' | 'equation';
  equation?: { expression: string };
};
