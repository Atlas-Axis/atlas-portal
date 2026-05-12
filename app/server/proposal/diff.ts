/**
 * Word-level and line-level diff utilities for the Atlas Edit Proposal viewer.
 *
 * Uses the `diff` npm package's `diffArrays` to produce equal / insert /
 * delete / replace opcodes, then applies a short-equal-block-merge post-pass
 * to collapse choppy alternating diffs into clean phrase-level replacements.
 *
 * Output: HTML strings that are safe to inject as `dangerouslySetInnerHTML`
 * because every emitted token is HTML-escaped before being wrapped in spans.
 */
import { diffArrays } from 'diff';

// ---------------------------------------------------------------------------
// HTML escaping (mirror Python's `html.escape`).
// ---------------------------------------------------------------------------

const ESCAPE_REGEX = /[&<>"']/g;
const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

export function escapeHtml(s: string): string {
  return s.replace(ESCAPE_REGEX, (c) => ESCAPE_MAP[c]);
}

// ---------------------------------------------------------------------------
// Tokenizer (whitespace + punctuation + words + markdown links).
// ---------------------------------------------------------------------------

/**
 * Tokenize text for word-level diff. Mirrors the Python regex
 *   `\[[^\]]*\]\([^)]*\)|[^\s\[\]();,.:'"]+|[();,.:'"]+|\s+`
 *
 * - Markdown links `[text](url)` are kept as a single token so a URL change
 *   doesn't shred the link.
 * - Punctuation tokens are separated from word tokens so changing
 *   "Wallet" -> "Wallet;" doesn't show up as a whole-word replacement.
 * - Whitespace runs are their own tokens to preserve formatting.
 */
function tokenize(text: string): string[] {
  const regex = /\[[^\]]*\]\([^)]*\)|[^\s\[\]();,.:'"]+|[();,.:'"]+|\s+/g;
  return text.match(regex) ?? [];
}

// ---------------------------------------------------------------------------
// Opcode types — match difflib.get_opcodes() shape (op, i1, i2, j1, j2).
// ---------------------------------------------------------------------------

type Op = 'equal' | 'replace' | 'insert' | 'delete';
interface Opcode {
  op: Op;
  i1: number;
  i2: number;
  j1: number;
  j2: number;
}

/**
 * Build opcodes from `diffArrays` change objects. `diffArrays` emits
 * sequential blocks tagged `added` / `removed` / unchanged. We collapse
 * adjacent add/remove into `replace` so the output matches difflib's
 * opcode vocabulary.
 */
function buildOpcodes(a: string[], b: string[]): Opcode[] {
  const changes = diffArrays(a, b);
  const codes: Opcode[] = [];
  let i = 0;
  let j = 0;
  for (let k = 0; k < changes.length; k++) {
    const c = changes[k];
    const len = c.count ?? c.value.length;
    if (!c.added && !c.removed) {
      codes.push({ op: 'equal', i1: i, i2: i + len, j1: j, j2: j + len });
      i += len;
      j += len;
    } else if (c.removed) {
      // Check if the next block is an addition: pair them into `replace`.
      const next = changes[k + 1];
      if (next && next.added) {
        const nextLen = next.count ?? next.value.length;
        codes.push({ op: 'replace', i1: i, i2: i + len, j1: j, j2: j + nextLen });
        i += len;
        j += nextLen;
        k += 1; // skip the paired addition
      } else {
        codes.push({ op: 'delete', i1: i, i2: i + len, j1: j, j2: j });
        i += len;
      }
    } else if (c.added) {
      codes.push({ op: 'insert', i1: i, i2: i, j1: j, j2: j + len });
      j += len;
    }
  }
  return codes;
}

/**
 * Merge short equal blocks (≤3 non-whitespace tokens) sandwiched between two
 * changes into the surrounding replacement. Without this, single common
 * words like "the" anchor the diff and produce choppy alternation.
 *
 * Iterates until no more merges are possible (matches Python).
 */
function mergeShortEqualBlocks(opcodes: Opcode[], oldTokens: string[]): Opcode[] {
  let merged = opcodes.slice();
  let changed = true;
  while (changed) {
    changed = false;
    const next: Opcode[] = [];
    let i = 0;
    while (i < merged.length) {
      if (
        i + 2 < merged.length &&
        merged[i].op !== 'equal' &&
        merged[i + 1].op === 'equal' &&
        merged[i + 2].op !== 'equal'
      ) {
        const eq = merged[i + 1];
        const eqTokens = oldTokens.slice(eq.i1, eq.i2);
        const nonWsCount = eqTokens.filter((t) => t.trim().length > 0).length;
        if (nonWsCount <= 3) {
          const a = merged[i];
          const c = merged[i + 2];
          next.push({ op: 'replace', i1: a.i1, i2: c.i2, j1: a.j1, j2: c.j2 });
          i += 3;
          changed = true;
          continue;
        }
      }
      next.push(merged[i]);
      i += 1;
    }
    merged = next;
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Public API: word-level diff.
// ---------------------------------------------------------------------------

/**
 * Generate a word-level HTML diff between two strings.
 *
 * - Returns `""` when both inputs are empty.
 * - Returns a single `<span class="added">…</span>` when `oldText` is empty.
 * - Returns a single `<span class="removed">…</span>` when `newText` is empty.
 * - Otherwise, returns the merged diff with `<span class="added">` and
 *   `<span class="removed">` for changed runs.
 */
export function wordDiff(oldText: string, newText: string): string {
  if (!oldText && !newText) return '';
  if (!oldText) return `<span class="added">${escapeHtml(newText)}</span>`;
  if (!newText) return `<span class="removed">${escapeHtml(oldText)}</span>`;

  const oldTokens = tokenize(oldText);
  const newTokens = tokenize(newText);

  const opcodes = buildOpcodes(oldTokens, newTokens);
  const merged = mergeShortEqualBlocks(opcodes, oldTokens);

  const out: string[] = [];
  for (const { op, i1, i2, j1, j2 } of merged) {
    if (op === 'equal') {
      out.push(escapeHtml(oldTokens.slice(i1, i2).join('')));
    } else if (op === 'replace') {
      out.push(`<span class="removed">${escapeHtml(oldTokens.slice(i1, i2).join(''))}</span>`);
      out.push(`<span class="added">${escapeHtml(newTokens.slice(j1, j2).join(''))}</span>`);
    } else if (op === 'insert') {
      out.push(`<span class="added">${escapeHtml(newTokens.slice(j1, j2).join(''))}</span>`);
    } else if (op === 'delete') {
      out.push(`<span class="removed">${escapeHtml(oldTokens.slice(i1, i2).join(''))}</span>`);
    }
  }
  return out.join('');
}

// ---------------------------------------------------------------------------
// Public API: line-level diff with word-level highlighting inside changes.
// ---------------------------------------------------------------------------

/**
 * Generate a line-by-line diff between two strings. Equal lines are emitted
 * as context; insert/delete lines as add/remove; replace pairs run through
 * `wordDiff` so changes inside a line are highlighted at the word level.
 *
 * Returns HTML lines joined by `\n` so callers can drop it into a `<pre>` or
 * a sequence of `<div>`s without extra wrapping.
 */
export function lineDiff(oldText: string, newText: string): string {
  const oldLines = oldText ? oldText.split('\n') : [];
  const newLines = newText ? newText.split('\n') : [];

  const opcodes = buildOpcodes(oldLines, newLines);

  const result: string[] = [];
  for (const { op, i1, i2, j1, j2 } of opcodes) {
    if (op === 'equal') {
      for (const line of newLines.slice(j1, j2)) {
        result.push(`<div class="line context">${escapeHtml(line)}</div>`);
      }
    } else if (op === 'replace') {
      const oldChunk = oldLines.slice(i1, i2);
      const newChunk = newLines.slice(j1, j2);
      const maxLen = Math.max(oldChunk.length, newChunk.length);
      for (let k = 0; k < maxLen; k++) {
        const oldL = k < oldChunk.length ? oldChunk[k] : '';
        const newL = k < newChunk.length ? newChunk[k] : '';
        if (oldL && !newL) {
          result.push(`<div class="line removed-line"><span class="removed">${escapeHtml(oldL)}</span></div>`);
        } else if (newL && !oldL) {
          result.push(`<div class="line added-line"><span class="added">${escapeHtml(newL)}</span></div>`);
        } else {
          result.push(`<div class="line changed-line">${wordDiff(oldL, newL)}</div>`);
        }
      }
    } else if (op === 'insert') {
      for (const line of newLines.slice(j1, j2)) {
        result.push(`<div class="line added-line"><span class="added">${escapeHtml(line)}</span></div>`);
      }
    } else if (op === 'delete') {
      for (const line of oldLines.slice(i1, i2)) {
        result.push(`<div class="line removed-line"><span class="removed">${escapeHtml(line)}</span></div>`);
      }
    }
  }
  return result.join('\n');
}
