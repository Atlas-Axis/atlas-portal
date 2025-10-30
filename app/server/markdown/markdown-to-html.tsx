import markdownit from 'markdown-it';
import type Renderer from 'markdown-it/lib/renderer.mjs';
import type Token from 'markdown-it/lib/token.mjs';
import { isValidUUID } from '@/app/shared/utils/utils';

const md = markdownit();

/**
 * Custom link renderer that converts UUID hrefs to document number anchors
 * @param uuidToDocNoMap - Map for UUID to document number conversion
 */
function createLinkRenderer(
  uuidToDocNoMap: Map<string, string>,
): (tokens: Token[], idx: number, options: object, env: unknown, self: Renderer) => string {
  const defaultRender =
    md.renderer.rules.link_open ||
    function (tokens, idx, options, _env, self) {
      return self.renderToken(tokens, idx, options);
    };

  return function (tokens: Token[], idx: number, options: object, env: unknown, self: Renderer) {
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
 * Converts markdown to HTML and preserves line breaks by converting newlines to <br> tags.
 * This handles non-standard markdown patterns like Unicode bullet lists (•).
 *
 * @param markdown - The markdown string to convert
 * @param uuidToDocNoMap - Optional map of UUIDs to document numbers for converting internal links.
 *                         If not provided, UUID links will remain unchanged.
 */
export const markdownToHTML = (markdown: string, uuidToDocNoMap?: Map<string, string>) => {
  // Configure custom link renderer if UUID map is provided
  if (uuidToDocNoMap) {
    md.renderer.rules.link_open = createLinkRenderer(uuidToDocNoMap);
  } else {
    // Reset to default renderer if no map provided
    delete md.renderer.rules.link_open;
  }

  // First, convert markdown to HTML using markdown-it
  let html = md.render(markdown);

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
