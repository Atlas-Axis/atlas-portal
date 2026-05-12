/**
 * Paragraph-and-line-level diff HTML for a single document body.
 *
 * The hierarchical doc-stream renders three flavors of body:
 * - "added" — wrap every paragraph as `diff-add`.
 * - "removed" — wrap every paragraph as `diff-del`.
 * - "modified" — split by blank lines, diff paragraph pairs; within each
 *   modified paragraph, diff by line and run `wordDiff` inside each changed
 *   line so the user sees what changed at the word level.
 *
 * Bullet lines (lines starting with `- `) are emitted as `<li>` inside a
 * `<ul>` so the body reads as proper markdown rather than a wall of `<p>`.
 */
import { diffArrays } from 'diff';
import { escapeHtml, wordDiff } from './diff';
import { applyInlineFormatting, applyInlineFormattingToHtml, normalizeBody } from './inline-formatting';

// ---------------------------------------------------------------------------
// Block rendering — paragraphs and bullet lists.
// ---------------------------------------------------------------------------

type LineFormatter = (text: string) => string;

function defaultFormatter(text: string): string {
  return applyInlineFormatting(escapeHtml(text));
}

/**
 * Render a body block as HTML, recognising `- ` bullet lines as `<li>` items
 * grouped into `<ul>`. Other non-empty lines become `<p>` tags.
 */
function renderBlock(text: string, formatLine: LineFormatter = defaultFormatter): string {
  const lines = text.split('\n');
  const parts: string[] = [];
  let listItems: string[] = [];

  const flushList = (): void => {
    if (listItems.length > 0) {
      const itemsHtml = listItems.map((it) => `<li>${it}</li>`).join('');
      parts.push(`<ul>${itemsHtml}</ul>`);
      listItems = [];
    }
  };

  for (const line of lines) {
    const stripped = line.trim();
    if (stripped.startsWith('- ')) {
      listItems.push(formatLine(stripped.slice(2).trim()));
    } else {
      flushList();
      if (stripped) {
        parts.push(`<p>${formatLine(stripped)}</p>`);
      }
    }
  }
  flushList();
  return parts.length > 0 ? parts.join('') : '<p></p>';
}

/** Clean (non-diff) HTML rendering of a body — used when a doc is unchanged. */
export function makeFinalHtml(body: string): string {
  if (!body) {
    return '<p></p>';
  }
  return renderBlock(normalizeBody(body));
}

// ---------------------------------------------------------------------------
// Opcode helpers (paragraph and line level).
// ---------------------------------------------------------------------------

type Op = 'equal' | 'replace' | 'insert' | 'delete';

interface Opcode {
  op: Op;
  i1: number;
  i2: number;
  j1: number;
  j2: number;
}

function buildOpcodes<T>(a: T[], b: T[]): Opcode[] {
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
      const next = changes[k + 1];
      if (next && next.added) {
        const nextLen = next.count ?? next.value.length;
        codes.push({ op: 'replace', i1: i, i2: i + len, j1: j, j2: j + nextLen });
        i += len;
        j += nextLen;
        k += 1;
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

// ---------------------------------------------------------------------------
// Compare HTML — paragraph-level, with word-level diff inside changed lines.
// ---------------------------------------------------------------------------

interface CompareOptions {
  isNew?: boolean;
  isDeleted?: boolean;
}

/**
 * Produce the compare HTML for a body pair.
 *
 * Mirrors Atlas Review's renderer: normalize cross-reference numbers, split
 * bodies by blank lines, then for each modified paragraph fall back to a
 * line-level diff with `wordDiff` per changed line. Bullet structure is
 * preserved across diff states.
 */
export function makeCompareHtml(oldBody: string, newBody: string, opts: CompareOptions = {}): string {
  const { isNew = false, isDeleted = false } = opts;

  const newDisplay = newBody ? normalizeBody(newBody) : '';

  if (isDeleted) {
    const delFormat: LineFormatter = (t) => `<span class="diff-del">${applyInlineFormatting(escapeHtml(t))}</span>`;
    return renderBlock(newDisplay, delFormat);
  }

  if (isNew || !oldBody) {
    const addFormat: LineFormatter = (t) => `<span class="diff-add">${applyInlineFormatting(escapeHtml(t))}</span>`;
    return renderBlock(newDisplay, addFormat);
  }

  const oldNorm = normalizeBody(oldBody);
  const newNorm = newDisplay;
  const newDisplayParas = splitParagraphs(newDisplay);

  const oldParas = splitParagraphs(oldNorm);
  const newParas = splitParagraphs(newNorm);

  const maxLen = Math.max(oldParas.length, newParas.length);
  const parts: string[] = [];
  for (let i = 0; i < maxLen; i++) {
    const oldP = i < oldParas.length ? oldParas[i] : '';
    const newP = i < newParas.length ? newParas[i] : '';

    if (oldP === newP) {
      const displayP = i < newDisplayParas.length ? newDisplayParas[i] : newP;
      parts.push(renderBlock(displayP));
    } else if (!oldP) {
      const displayP = i < newDisplayParas.length ? newDisplayParas[i] : newP;
      const addFmt: LineFormatter = (t) => `<span class="diff-add">${applyInlineFormatting(escapeHtml(t))}</span>`;
      parts.push(renderBlock(displayP, addFmt));
    } else if (!newP) {
      const delFmt: LineFormatter = (t) => `<span class="diff-del">${applyInlineFormatting(escapeHtml(t))}</span>`;
      parts.push(renderBlock(oldP, delFmt));
    } else {
      parts.push(renderModifiedParagraph(oldP, newP, newDisplayParas[i] ?? newP));
    }
  }

  return parts.length > 0 ? parts.join('') : '<p></p>';
}

function splitParagraphs(text: string): string[] {
  return text
    .split('\n\n')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Line-level diff for a single paragraph pair, with word-level highlight
 * inside replaced lines. Preserves bullet structure across opcodes.
 */
function renderModifiedParagraph(oldPara: string, newPara: string, displayPara: string): string {
  const oldLines = oldPara.split('\n');
  const newLines = newPara.split('\n');
  const displayLines = displayPara.split('\n');

  const opcodes = buildOpcodes(oldLines, newLines);
  const blockParts: string[] = [];
  let listItems: string[] = [];

  const flushList = (): void => {
    if (listItems.length > 0) {
      const itemsHtml = listItems.map((it) => `<li>${it}</li>`).join('');
      blockParts.push(`<ul>${itemsHtml}</ul>`);
      listItems = [];
    }
  };

  const emitLine = (content: string, isListItem: boolean): void => {
    if (isListItem) {
      listItems.push(content);
    } else {
      flushList();
      blockParts.push(`<p>${content}</p>`);
    }
  };

  const isListLine = (line: string): boolean => line.trim().startsWith('- ');
  const stripListPrefix = (line: string): string => line.trim().replace(/^-\s*/, '');

  const formatLine = (text: string): string => applyInlineFormatting(escapeHtml(text));

  const diffLine = (oldL: string, newL: string): string => {
    // wordDiff emits class="added" / class="removed". The Atlas Review CSS
    // also targets `.diff-add` / `.diff-del` for the heavier paragraph-level
    // states; we duplicate the classes here so styling can live in one place.
    let d = wordDiff(oldL, newL);
    d = d.replace(/class="added"/g, 'class="added diff-add"');
    d = d.replace(/class="removed"/g, 'class="removed diff-del"');
    return applyInlineFormattingToHtml(d);
  };

  for (const { op, i1, i2, j1, j2 } of opcodes) {
    if (op === 'equal') {
      for (let k = 0; k < j2 - j1; k++) {
        const line = newLines[j1 + k];
        const displayIdx = j1 + k;
        const displayLine = displayIdx < displayLines.length ? displayLines[displayIdx] : line;
        const isLi = isListLine(displayLine);
        const content = formatLine(isLi ? stripListPrefix(displayLine) : displayLine.trim());
        emitLine(content, isLi);
      }
    } else if (op === 'replace') {
      const span = Math.max(i2 - i1, j2 - j1);
      for (let k = 0; k < span; k++) {
        const oldL = i1 + k < i2 ? oldLines[i1 + k].trim() : '';
        const newL = j1 + k < j2 ? newLines[j1 + k].trim() : '';
        const isLi = newL ? isListLine(newL) : oldL ? isListLine(oldL) : false;
        const oldFinal = isLi && oldL ? stripListPrefix(oldL) : oldL;
        const newFinal = isLi && newL ? stripListPrefix(newL) : newL;
        let content: string;
        if (oldFinal && !newFinal) {
          content = `<span class="diff-del">${formatLine(oldFinal)}</span>`;
        } else if (newFinal && !oldFinal) {
          content = `<span class="diff-add">${formatLine(newFinal)}</span>`;
        } else {
          content = diffLine(oldFinal, newFinal);
        }
        emitLine(content, isLi);
      }
    } else if (op === 'insert') {
      for (let k = j1; k < j2; k++) {
        const line = newLines[k];
        const isLi = isListLine(line);
        const text = isLi ? stripListPrefix(line) : line.trim();
        emitLine(`<span class="diff-add">${formatLine(text)}</span>`, isLi);
      }
    } else if (op === 'delete') {
      for (let k = i1; k < i2; k++) {
        const line = oldLines[k];
        const isLi = isListLine(line);
        const text = isLi ? stripListPrefix(line) : line.trim();
        emitLine(`<span class="diff-del">${formatLine(text)}</span>`, isLi);
      }
    }
  }

  flushList();
  return blockParts.length > 0 ? blockParts.join('') : '<p></p>';
}
