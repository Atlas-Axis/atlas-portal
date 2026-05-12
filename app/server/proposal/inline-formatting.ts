/**
 * Markdown-lite inline formatting.
 *
 * Handles `code`, **bold**, __underline__, *italic*, ~~strikethrough~~, and
 * [link](url) inside body text. Operates on text that has already been
 * HTML-escaped — order matters (code first, bold before italic, etc.) to
 * avoid `**` being consumed as `*`.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

/** Apply inline formatting to text that has already been HTML-escaped. */
export function applyInlineFormatting(text: string): string {
  // Inline code first — protects contents from other formatting.
  let out = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold (must come before italic since `**` contains `*`).
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Underline (`__text__`) before italic-like patterns.
  out = out.replace(/__(.+?)__/g, '<u>$1</u>');
  // Italic.
  out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Strikethrough.
  out = out.replace(/~~(.+?)~~/g, '<s>$1</s>');
  // Links. UUID-only hrefs are rewritten to the canonical sky-atlas.io anchor
  // so cross-references resolve when readers click them.
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, href: string) => {
    if (isUuid(href)) {
      return `<a href="https://sky-atlas.io/#${href}" target="_blank" rel="noopener">${label}</a>`;
    }
    return `<a href="${href}">${label}</a>`;
  });
  return out;
}

/**
 * Apply inline formatting to HTML that already contains diff `<span>` tags.
 *
 * Splits into tag vs text segments, formats only the text segments, rejoins.
 * Without this, an `[A.x - Name](UUID)` cross-reference inside a diff span
 * would never be converted to an anchor.
 */
export function applyInlineFormattingToHtml(diffHtml: string): string {
  const parts = diffHtml.split(/(<[^>]+>)/);
  const out: string[] = [];
  for (const part of parts) {
    if (part.startsWith('<')) {
      out.push(part);
    } else {
      out.push(applyInlineFormatting(part));
    }
  }
  return out.join('');
}

// ---------------------------------------------------------------------------
// Cross-reference number stripping.
// ---------------------------------------------------------------------------

/**
 * Strip document numbers from cross-reference display text.
 *
 * Converts `[A.2.2.8.1 - Name](UUID)` → `[Name](UUID)` so renumbering of
 * referenced docs doesn't shred the diff. Also handles bold variants
 * `[**A.2.2.8.1 - Name**](UUID)` → `[**Name**](UUID)`. Normalizes
 * non-breaking spaces (U+00A0) to regular spaces.
 */
const XREF_NUMBER_RE = /\[(\*{0,2})([A-Z][\d.]+)\s*-\s*([^\]]+?)\1\]\(([^)]+)\)/g;

export function normalizeBody(text: string): string {
  const nbspNormalized = text.replace(/ /g, ' ');
  return nbspNormalized.replace(XREF_NUMBER_RE, '[$1$3$1]($4)');
}
