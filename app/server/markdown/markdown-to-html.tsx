import markdownit from 'markdown-it';

const md = markdownit();

/**
 * Converts markdown to HTML and preserves line breaks by converting newlines to <br> tags.
 * This handles non-standard markdown patterns like Unicode bullet lists (•).
 */
export const markdownToHTML = (markdown: string) => {
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
