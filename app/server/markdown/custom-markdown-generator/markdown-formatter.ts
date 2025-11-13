/**
 * Simple Markdown formatter for common formatting cases
 * Handles headings, lists, inline code, links, bold formatting, code blocks, etc.
 */

export interface MarkdownNode {
  type: string;
  content?: string;
  children?: MarkdownNode[];
  level?: number; // for headings
  ordered?: boolean; // for lists
  url?: string; // for links
  language?: string; // for code blocks
}

export class MarkdownFormatter {
  /**
   * Format a markdown node and its children into a markdown string
   */
  format(node: MarkdownNode): string {
    switch (node.type) {
      case 'document':
        return this.formatDocument(node);
      case 'heading':
        return this.formatHeading(node);
      case 'paragraph':
        return this.formatParagraph(node);
      case 'list':
        return this.formatList(node);
      case 'list_item':
        return this.formatListItem(node);
      case 'code_block':
        return this.formatCodeBlock(node);
      case 'text':
        return this.formatText(node);
      case 'bold':
        return this.formatBold(node);
      case 'inline_code':
        return this.formatInlineCode(node);
      case 'link':
        return this.formatLink(node);
      case 'line_break':
        return '\n';
      default:
        return this.formatChildren(node);
    }
  }

  private formatDocument(node: MarkdownNode): string {
    return this.formatChildren(node);
  }

  private formatHeading(node: MarkdownNode): string {
    const level = node.level || 1;
    const hashes = '#'.repeat(Math.min(level, 6));
    const content = this.formatChildren(node);
    return `${hashes} ${content}\n\n`;
  }

  private formatParagraph(node: MarkdownNode): string {
    const content = this.formatChildren(node);
    return `${content}\n\n`;
  }

  private formatList(node: MarkdownNode): string {
    const items = this.formatChildren(node);
    return `${items}\n`;
  }

  private formatListItem(node: MarkdownNode, listContext?: { ordered: boolean; index: number }): string {
    const content = this.formatChildren(node);

    if (listContext?.ordered) {
      return `${listContext.index}. ${content}\n`;
    } else {
      return `- ${content}\n`;
    }
  }

  private formatCodeBlock(node: MarkdownNode): string {
    const language = node.language || '';
    const content = node.content || '';
    return `\`\`\`${language}\n${content}\n\`\`\`\n\n`;
  }

  private formatText(node: MarkdownNode): string {
    return node.content || '';
  }

  private formatBold(node: MarkdownNode): string {
    const content = this.formatChildren(node);
    return `**${content}**`;
  }

  private formatInlineCode(node: MarkdownNode): string {
    const content = node.content || this.formatChildren(node);
    return `\`${content}\``;
  }

  private formatLink(node: MarkdownNode): string {
    const content = this.formatChildren(node);
    const url = node.url || '';
    return `[${content}](${url})`;
  }

  private formatChildren(node: MarkdownNode): string {
    if (!node.children || node.children.length === 0) {
      return '';
    }

    // Special handling for list items to pass context
    if (node.type === 'list') {
      return node.children
        .map((child, index) => {
          if (child.type === 'list_item') {
            return this.formatListItem(child, {
              ordered: node.ordered || false,
              index: index + 1,
            });
          }
          return this.format(child);
        })
        .join('');
    }

    return node.children.map((child) => this.format(child)).join('');
  }

  /**
   * Utility method to create common markdown nodes
   */
  static createNode(type: string, options: Partial<MarkdownNode> = {}): MarkdownNode {
    return {
      type,
      ...options,
    };
  }

  /**
   * Helper methods to create specific types of nodes
   */
  static heading(level: number, content: string): MarkdownNode {
    return {
      type: 'heading',
      level,
      children: [{ type: 'text', content }],
    };
  }

  static paragraph(children: MarkdownNode[]): MarkdownNode {
    return {
      type: 'paragraph',
      children,
    };
  }

  static text(content: string): MarkdownNode {
    return {
      type: 'text',
      content,
    };
  }

  static bold(children: MarkdownNode[]): MarkdownNode {
    return {
      type: 'bold',
      children,
    };
  }

  static inlineCode(content: string): MarkdownNode {
    return {
      type: 'inline_code',
      content,
    };
  }

  static link(url: string, children: MarkdownNode[]): MarkdownNode {
    return {
      type: 'link',
      url,
      children,
    };
  }

  static list(ordered: boolean, items: MarkdownNode[]): MarkdownNode {
    return {
      type: 'list',
      ordered,
      children: items.map((item) => ({
        type: 'list_item',
        children: [item],
      })),
    };
  }

  static codeBlock(content: string, language?: string): MarkdownNode {
    return {
      type: 'code_block',
      content,
      language,
    };
  }
}
