import katex from 'katex';

/**
 * Processes HTML string to find and replace TeX math expressions with KaTeX-rendered HTML.
 *
 * Supports two delimiter types:
 * - Display math: $$...$$
 * - Inline math: $...$
 *
 * Smart delimiter detection:
 * - Dollar signs followed by digits (e.g., $50, $1,000) are NOT treated as math (money amounts)
 * - Dollar signs followed by letters or symbols are treated as math (e.g., $x$, $\alpha$)
 * - <br> tags within math expressions are removed and replaced with spaces
 *
 * @param html - HTML string that may contain math expressions
 * @returns HTML string with math expressions replaced by KaTeX-rendered HTML
 *
 * @example
 * ```ts
 * const input = '<p>The equation $x = 5$ is simple.</p>';
 * const output = processKaTeXInHTML(input);
 * // Returns: '<p>The equation <span class="katex">...</span> is simple.</p>'
 *
 * const money = '<p>Price: $50</p>';
 * const output2 = processKaTeXInHTML(money);
 * // Returns: '<p>Price: $50</p>' (unchanged - not treated as math)
 * ```
 */
export function processKaTeXInHTML(html: string): string {
  // Process display math ($$...$$) first to avoid matching as two inline delimiters
  // Match everything between $$ delimiters, including <br> tags and any other HTML
  // Use [\s\S] instead of . to match across newlines, and use non-greedy +? to stop at first $$
  let processed = html.replace(/\$\$([\s\S]+?)\$\$/g, (match, mathContent: string) => {
    try {
      // Remove any <br> tags (with or without /) and excessive whitespace from the math content
      const cleanContent = mathContent
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return katex.renderToString(cleanContent, {
        throwOnError: false,
        displayMode: true,
      });
    } catch (error: unknown) {
      // This shouldn't happen with throwOnError: false, but handle it just in case
      console.error('KaTeX rendering error (display):', error);
      return match; // Return original if rendering fails
    }
  });

  // Process inline math ($...$)
  // Use negative lookahead (?!\d) to avoid matching dollar signs followed by digits (money amounts)
  // This prevents "$50" or "$1,000" from being treated as math
  processed = processed.replace(/\$(?!\d)([^$]+)\$/g, (match, mathContent: string) => {
    try {
      return katex.renderToString(mathContent.trim(), {
        throwOnError: false,
        displayMode: false,
      });
    } catch (error: unknown) {
      // This shouldn't happen with throwOnError: false, but handle it just in case
      console.error('KaTeX rendering error (inline):', error);
      return match; // Return original if rendering fails
    }
  });

  return processed;
}
