import markdownit from 'markdown-it';
import type { Options } from 'markdown-it';
import type Renderer from 'markdown-it/lib/renderer.mjs';
import type Token from 'markdown-it/lib/token.mjs';
import { isValidUUID } from '@/app/shared/utils/utils';

/**
 * Custom link renderer that converts UUID hrefs to document number anchors
 * @param uuidToDocNoMap - Map for UUID to document number conversion
 * @param defaultRender - The default link_open renderer
 */
function createLinkRenderer(
  uuidToDocNoMap: Map<string, string>,
  defaultRender: (tokens: Token[], idx: number, options: Options, env: unknown, self: Renderer) => string,
): (tokens: Token[], idx: number, options: Options, env: unknown, self: Renderer) => string {
  return function (tokens: Token[], idx: number, options: Options, env: unknown, self: Renderer) {
    const token = tokens[idx];
    const hrefIndex = token.attrIndex('href');

    if (hrefIndex >= 0 && token.attrs) {
      const href = token.attrs[hrefIndex][1];

      // Check if href is a UUID and convert it
      if (isValidUUID(href)) {
        const docNo = uuidToDocNoMap.get(href);
        if (docNo) {
          // Replace UUID with #doc_no format
          token.attrs[hrefIndex][1] = `#${docNo}`;
        }
      }
    }

    return defaultRender(tokens, idx, options, env, self);
  };
}

/**
 * Protects math expressions and code blocks from markdown processing by replacing them with placeholders.
 * This prevents markdown-it from parsing underscores, asterisks, etc. as formatting within these protected regions.
 *
 * Uses unique placeholders with Unicode characters that won't be parsed as markdown formatting.
 *
 * @param markdown - The markdown string to protect
 * @returns Object containing the protected markdown and a map of placeholders to original content
 */
function protectSpecialContent(markdown: string): { protected: string; placeholders: Map<string, string> } {
  const placeholders = new Map<string, string>();
  let counter = 0;
  let protectedText = markdown;

  // Protect display math ($$...$$) first
  // Use [\s\S]*? to match any content including empty (not +? which requires at least one char)
  protectedText = protectedText.replace(/\$\$([\s\S]*?)\$\$/g, (match) => {
    // Use Unicode characters that won't be parsed as markdown
    const placeholder = `\u{FFFD}PROTECTEDDISPLAYMATH${counter++}\u{FFFD}`;
    placeholders.set(placeholder, match);
    return placeholder;
  });

  // Protect inline math ($...$) - but not dollar signs followed by digits (money amounts)
  protectedText = protectedText.replace(/\$(?!\d)([^$]+?)\$/g, (match) => {
    const placeholder = `\u{FFFD}PROTECTEDINLINEMATH${counter++}\u{FFFD}`;
    placeholders.set(placeholder, match);
    return placeholder;
  });

  // Protect code blocks (```...```)
  protectedText = protectedText.replace(/```[\s\S]*?```/g, (match) => {
    const placeholder = `\u{FFFD}PROTECTEDCODEBLOCK${counter++}\u{FFFD}`;
    placeholders.set(placeholder, match);
    return placeholder;
  });

  // Protect inline code (`...`)
  protectedText = protectedText.replace(/`[^`]+?`/g, (match) => {
    const placeholder = `\u{FFFD}PROTECTEDINLINECODE${counter++}\u{FFFD}`;
    placeholders.set(placeholder, match);
    return placeholder;
  });

  return { protected: protectedText, placeholders };
}

/**
 * Restores the original content that was protected before markdown processing.
 *
 * IMPORTANT: Uses a function for replacement to avoid issues with special replacement patterns.
 * In JavaScript's String.replace(), `$$` in the replacement string means "insert a literal $",
 * so we must use a function that returns the original string to avoid this interpretation.
 *
 * @param text - The processed text containing placeholders
 * @param placeholders - Map of placeholders to original content
 * @returns Text with placeholders replaced by original content
 */
function restoreProtectedContent(text: string, placeholders: Map<string, string>): string {
  let restored = text;
  for (const [placeholder, original] of placeholders.entries()) {
    // Use a function to return the original string, avoiding special replacement pattern interpretation
    // (e.g., $$ in replacement string would be interpreted as single $)
    restored = restored.replace(placeholder, () => original);
  }
  return restored;
}

/**
 * Converts markdown to HTML and preserves line breaks by converting newlines to <br> tags.
 * This handles non-standard markdown patterns like Unicode bullet lists (•).
 *
 * Protects math expressions ($$...$$ and $...$) and code blocks (```...``` and `...`)
 * from markdown processing to prevent underscores, asterisks, and other special characters
 * from being interpreted as formatting.
 *
 * @param markdown - The markdown string to convert
 * @param uuidToDocNoMap - Optional map of UUIDs to document numbers for converting internal links.
 *                         If not provided, UUID links will remain unchanged.
 */
export const markdownToHTML = (markdown: string, uuidToDocNoMap?: Map<string, string>) => {
  // Safeguard against extremely large content that could cause performance issues
  if (markdown.length > 1000000) {
    console.warn('Markdown content exceeds 1MB, truncating for safety');
    markdown = markdown.slice(0, 1000000) + '\n\n[Content truncated due to size...]';
  }

  // Step 1: Protect math expressions and code blocks from markdown processing
  const { protected: protectedMarkdown, placeholders } = protectSpecialContent(markdown);

  // Create a new markdown-it instance for each call to avoid global state issues
  const md = markdownit();

  // Configure custom link renderer if UUID map is provided
  if (uuidToDocNoMap) {
    const defaultRender =
      md.renderer.rules.link_open ||
      function (tokens, idx, options, _env, self) {
        return self.renderToken(tokens, idx, options);
      };
    md.renderer.rules.link_open = createLinkRenderer(uuidToDocNoMap, defaultRender);
  }

  // Step 2: Convert markdown to HTML using markdown-it (with protected content)
  let html = md.render(protectedMarkdown);

  // Step 3: Restore the protected content
  html = restoreProtectedContent(html, placeholders);

  // Post-process: Replace newlines within text content with <br> tags
  // This regex finds newlines that are not between block-level closing and opening tags
  // Strategy: Replace single newlines with <br> tags to preserve line breaks in the rendered output
  html = html.replace(/\n/g, '<br>\n');

  // Clean up: Remove <br> tags that appear between block-level elements
  // These patterns would create unwanted spacing
  html = html
    // Remove <br> after opening block tags
    .replace(/(<(?:p|div|ul|ol|li|h[1-6]|blockquote|pre)[^>]*>)\s*<br>\s*/g, '$1')
    // Remove <br> before closing block tags
    .replace(/\s*<br>\s*(<\/(?:p|div|ul|ol|li|h[1-6]|blockquote|pre)>)/g, '$1')
    // Remove <br> between closing and opening block tags
    .replace(
      /(<\/(?:p|div|ul|ol|li|h[1-6]|blockquote|pre)>)\s*<br>\s*(<(?:p|div|ul|ol|li|h[1-6]|blockquote|pre)[^>]*>)/g,
      '$1\n$2',
    )
    // Remove trailing <br> tags at the end of the HTML
    .replace(/(<br>\s*)+$/, '');

  return html;
};
