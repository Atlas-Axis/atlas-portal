import { MarkdownFormatter, MarkdownNode } from './markdown-formatter';

/**
 * Utility functions for creating and formatting markdown content
 */

/**
 * Quick function to format a markdown document from nodes
 */
export function formatMarkdown(nodes: MarkdownNode[]): string {
  const formatter = new MarkdownFormatter();
  const document: MarkdownNode = {
    type: 'document',
    children: nodes,
  };
  return formatter.format(document).trim();
}

/**
 * Create a simple text paragraph
 */
export function paragraph(text: string): MarkdownNode {
  return MarkdownFormatter.paragraph([MarkdownFormatter.text(text)]);
}

/**
 * Create a heading with text content
 */
export function heading(level: number, text: string): MarkdownNode {
  return MarkdownFormatter.heading(level, text);
}

/**
 * Create bold text
 */
export function bold(text: string): MarkdownNode {
  return MarkdownFormatter.bold([MarkdownFormatter.text(text)]);
}

/**
 * Create a link with text
 */
export function link(url: string, text: string): MarkdownNode {
  return MarkdownFormatter.link(url, [MarkdownFormatter.text(text)]);
}

/**
 * Create an unordered list from string array
 */
export function unorderedList(items: string[]): MarkdownNode {
  const listItems = items.map((item) => MarkdownFormatter.text(item));
  return MarkdownFormatter.list(false, listItems);
}

/**
 * Create an ordered list from string array
 */
export function orderedList(items: string[]): MarkdownNode {
  const listItems = items.map((item) => MarkdownFormatter.text(item));
  return MarkdownFormatter.list(true, listItems);
}

/**
 * Create a code block
 */
export function codeBlock(content: string, language?: string): MarkdownNode {
  return MarkdownFormatter.codeBlock(content, language);
}

/**
 * Create inline code
 */
export function inlineCode(content: string): MarkdownNode {
  return MarkdownFormatter.inlineCode(content);
}

/**
 * Helper to create mixed content paragraphs with formatting
 */
export function richParagraph(content: (string | MarkdownNode)[]): MarkdownNode {
  const children = content.map((item) => (typeof item === 'string' ? MarkdownFormatter.text(item) : item));
  return MarkdownFormatter.paragraph(children);
}

/**
 * Helper to create a document with multiple sections
 */
export function document(...sections: MarkdownNode[]): string {
  return formatMarkdown(sections);
}
