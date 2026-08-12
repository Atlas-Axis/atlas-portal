/**
 * Document-level reassembly: the order and heading levels of the composed Atlas.
 *
 * ⛔ WHY THIS EXISTS. `reassemble` used to concatenate whole bucket files in bucket
 * order, resting on the guarantee that every bucket is contiguous in emit order.
 * Upstream removed that guarantee (`0d36233a`) so `A.6.1.2` could live in the `A.6`
 * file alongside the other list Sections — but the Prime Agents `A.6.1.1.1..8` are
 * their own buckets and belong BETWEEN `A.6.1.1` and `A.6.1.2`. File-order
 * concatenation emitted `A.6.1.2` before them, and `parseAtlasMarkdown` then attached
 * all eight Prime Agents to `A.6.1` instead of `A.6.1.1` (11 "Parent document ... is
 * missing" warnings). Order must come from the DOCUMENTS, not the files.
 *
 * Separately (`11d0ff1c`) bucket files now store heading levels relative to their own
 * root document. The composed Atlas wants absolute levels, so they are re-derived from
 * doc numbers. They cannot be recovered from the stored hashes: most documents sit at
 * the six-hash cap, so a hash count no longer says how deep its document is.
 *
 * This is a port of the read side of upstream `sync/partition.py` @ 11d0ff1c —
 * canonical_sort_key, structural_depth, set_heading_level, restore_absolute_levels,
 * Block, split_into_blocks, _assert_source_order_preserved, order_documents. Keep it
 * behaviourally identical; the test asserts byte equality against upstream output.
 */

/** Upstream `sync/decompose.py` HEADING_RE. Group 2 is the document number. */
export const HEADING_RE =
  /^(#{1,6})\s+(\S+)\s+-\s+(.+?)\s+\[([^\]]+)\]\s+<!--\s*UUID:\s*([0-9a-f-]+)\s*-->/;

const MAX_HEADING_LEVEL = 6;
const HASHES_RE = /^#+/;

/** One numbered document plus any Needed Research emitted under it. */
interface Block {
  docNo: string;
  source: string;
  index: number;
  lines: string[];
}

type SortKey = Array<[number, number, string]>;

/**
 * Compose's emit position for a numbered document, from its doc number alone.
 *
 * Naive doc-number sorting is wrong in ~410 places: compose emits a parent's real
 * children before any subtree rooted at a phantom extension folder (the `0` segments
 * that hold no document). A segment is phantom precisely when no document claims that
 * prefix. Rank 0 = real child, 1 = phantom, 2 = the non-integer `var1` folder.
 */
export function canonicalSortKey(docNo: string, realDocNos: Set<string>): SortKey {
  const parts = docNo.split('.');
  const key: SortKey = [];
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    if (/^\d+$/.test(seg)) {
      const prefix = parts.slice(0, i + 1).join('.');
      key.push([realDocNos.has(prefix) ? 0 : 1, parseInt(seg, 10), '']);
    } else {
      key.push([2, 0, seg]);
    }
  }
  return key;
}

/** Python tuple comparison: element-wise, and a shorter prefix sorts first. */
function compareKeys(a: SortKey, b: SortKey): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i][0] !== b[i][0]) return a[i][0] - b[i][0];
    if (a[i][1] !== b[i][1]) return a[i][1] - b[i][1];
    if (a[i][2] !== b[i][2]) return a[i][2] < b[i][2] ? -1 : 1;
  }
  return a.length - b.length;
}

/** How many documents sit above this one. Segment count is not depth. */
export function structuralDepth(docNo: string, realDocNos: Set<string>): number {
  const parts = docNo.split('.');
  let n = 0;
  for (let i = 1; i < parts.length; i++) {
    if (realDocNos.has(parts.slice(0, i).join('.'))) n++;
  }
  return n;
}

/** Rewrite a heading line's hashes to `level`, leaving the rest untouched. */
export function setHeadingLevel(line: string, level: number): string {
  return line.replace(HASHES_RE, '#'.repeat(level));
}

/**
 * Give every heading in a reassembled stream its level in the composed Atlas.
 *
 * Re-derived, not adjusted: `min(structuralDepth + 1, 6)`. Needed Research has no
 * position of its own and takes its target's level plus one, under the same cap.
 */
export function restoreAbsoluteLevels(lines: string[]): string[] {
  const heads: Array<[number, string]> = [];
  const realDocNos = new Set<string>();
  lines.forEach((line, i) => {
    const m = HEADING_RE.exec(line);
    if (m) {
      heads.push([i, m[2]]);
      if (!m[2].startsWith('NR-')) realDocNos.add(m[2]);
    }
  });

  const out = [...lines];
  let previous = 0;
  for (const [i, docNo] of heads) {
    let level: number;
    if (docNo.startsWith('NR-')) {
      level = Math.min(previous + 1, MAX_HEADING_LEVEL);
    } else {
      level = Math.min(structuralDepth(docNo, realDocNos) + 1, MAX_HEADING_LEVEL);
      previous = level;
    }
    out[i] = setHeadingLevel(lines[i], level);
  }
  return out;
}

/** Cut one file's lines into blocks at Atlas document headings. */
function splitIntoBlocks(source: string, lines: string[]): Block[] {
  const heads: Array<[number, string]> = [];
  lines.forEach((line, i) => {
    const m = HEADING_RE.exec(line);
    if (m) heads.push([i, m[2]]);
  });
  if (heads.length === 0) {
    throw new Error(`${JSON.stringify(source)} contains no Atlas document headings`);
  }
  if (heads[0][0] !== 0) {
    throw new Error(
      `${JSON.stringify(source)} has ${heads[0][0]} line(s) before its first document ` +
        `heading. Bucket files must begin with a heading, or that text belongs to no ` +
        `document and would be silently dropped at reassembly.`,
    );
  }
  if (heads[0][1].startsWith('NR-')) {
    throw new Error(
      `${JSON.stringify(source)} begins with Needed Research document ${heads[0][1]}, ` +
        `which has no numbered document in this file to travel with.`,
    );
  }

  const starts = heads.filter(([, dn]) => !dn.startsWith('NR-'));
  const blocks: Block[] = [];
  for (let k = 0; k < starts.length; k++) {
    const [start, docNo] = starts[k];
    const end = k + 1 < starts.length ? starts[k + 1][0] : lines.length;
    blocks.push({ docNo, source, index: k, lines: lines.slice(start, end) });
  }
  return blocks;
}

/** The derived order must never move a document backwards within its own file. */
function assertSourceOrderPreserved(ordered: Block[]): void {
  const last = new Map<string, number>();
  for (const b of ordered) {
    const prev = last.get(b.source) ?? -1;
    if (b.index <= prev) {
      throw new Error(
        `document ordering moved ${b.docNo} backwards within ${JSON.stringify(b.source)} ` +
          `(position ${b.index} after position ${prev}). Within a file the order is ` +
          `compose's own emit order and is authoritative.`,
      );
    }
    last.set(b.source, b.index);
  }
}

/** Merge split files into the single composed line stream, ordered by document. */
export function orderDocuments(linesBySource: Map<string, string[]>): string[] {
  const blocks: Block[] = [];
  for (const source of [...linesBySource.keys()].sort()) {
    blocks.push(...splitIntoBlocks(source, linesBySource.get(source) as string[]));
  }

  const origin = new Map<string, string>();
  for (const b of blocks) {
    const existing = origin.get(b.docNo);
    if (existing !== undefined) {
      throw new Error(
        `document ${b.docNo} appears in both ${JSON.stringify(existing)} and ` +
          `${JSON.stringify(b.source)} — a document must live in exactly one file.`,
      );
    }
    origin.set(b.docNo, b.source);
  }

  const real = new Set(origin.keys());
  const keyed = blocks.map((b) => ({ b, k: canonicalSortKey(b.docNo, real) }));
  keyed.sort((x, y) => compareKeys(x.k, y.k));
  const ordered = keyed.map((x) => x.b);
  assertSourceOrderPreserved(ordered);
  return ordered.flatMap((b) => b.lines);
}
