/**
 * One entry point that yields the composed Atlas from EITHER layout.
 *
 * TypeScript port of `sync/atlas_source.py` + the reassembly half of
 * `sync/decompose_multi.py` from the Atlas repo
 * (branch `infra/option-c-split-composer`).
 *
 * ⭐ THIS IS THE WHOLE BACKWARD-COMPATIBILITY STRATEGY, AND IT IS DELIBERATELY SMALL.
 * De-atomization ("Option C") replaces the ~11,300-file `content/` tree with ~16
 * composed markdown files — one per top-level Scope (`A.0`–`A.6`) plus one per agent
 * artifact (`A.6.1.1.1` Spark … `A.6.1.1.8`, and `A.6.1.2` the Executor list). Every
 * consumer in this repo wants exactly one thing: the composed Atlas markdown for a
 * given checkout. If that single question is answered here, no consumer needs to know
 * that two layouts ever existed, and nothing downstream carries a migration flag.
 *
 * ⛔ DETECTION IS EXPLICIT AND FAILS LOUD. The pre-existing implicit signal — a walk
 * that finds no `document.md` and returns an empty string — is *silently* interpreted
 * downstream as "pre-cutover ref". That sentinel is doing load-bearing work by
 * accident: post-cutover it is also what an EMPTY or BROKEN checkout produces, so a
 * genuine failure and an old ref become indistinguishable. `detectLayout` throws on
 * ambiguity rather than guessing, so a truncated tarball surfaces as an error instead
 * of quietly rendering sky-atlas.io empty.
 */
import fs from 'node:fs';
import path from 'node:path';
import { orderDocuments, restoreAbsoluteLevels } from './partition-order';
import { compose } from './compose';

export const ATOMIZED = 'atomized';
export const CONSOLIDATED = 'consolidated';

export type AtlasLayout = typeof ATOMIZED | typeof CONSOLIDATED;

/** The checkout matches neither layout, or matches both. */
export class LayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LayoutError';
  }
}

// ---------------------------------------------------------------------------
// Bucket filenames and order
// ---------------------------------------------------------------------------

/**
 * Mirror of `partition.FILENAME_RE`. A consolidated file is named
 * `<docNo> - <slug>.md`, e.g. `A.6.1.1.1 - Spark.md`.
 */
const BUCKET_FILENAME_RE = /^(A(?:\.\d+)*) - .*\.md$/;

/** Recover a bucket's doc number from its filename, or null if not a bucket file. */
export function bucketFromFilename(fname: string): string | null {
  const m = BUCKET_FILENAME_RE.exec(fname);
  return m === null ? null : m[1];
}

/**
 * Sort key placing buckets in composed-Atlas order. Deterministic, no stored list.
 *
 * Buckets are doc numbers, so their integer-segment tuple IS their position: a prefix
 * sorts before its extensions (`A.6` before `A.6.1.1.1`) and segment-wise comparison
 * puts `A.6.1.1.8` before `A.6.1.2` because 1 < 2 at the third segment.
 *
 * ⛔ DO NOT SUBSTITUTE FILENAME SORTING. It agrees today and diverges the moment a
 * tenth Star is added: lexicographically `A.6.1.1.10` sorts between `A.6.1.1.1` and
 * `A.6.1.1.2`, silently reordering ~2,000 documents with no error raised anywhere.
 * Sky expects to keep onboarding agents, so this is a matter of when, not if.
 */
export function orderKey(bucket: string): number[] {
  return bucket
    .split('.')
    .slice(1)
    .map((s) => Number.parseInt(s, 10));
}

/** Compare two bucket doc numbers by their integer-segment tuples (see `orderKey`). */
export function compareBuckets(a: string, b: string): number {
  const ka = orderKey(a);
  const kb = orderKey(b);
  const n = Math.min(ka.length, kb.length);
  for (let i = 0; i < n; i++) {
    if (ka[i] !== kb[i]) {
      return ka[i] - kb[i];
    }
  }
  // A prefix sorts before its extensions: A.6 before A.6.1.
  return ka.length - kb.length;
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

/** The consolidated bucket files in `root`, keyed by doc number. Throws on duplicates. */
function bucketFilesIn(root: string): Map<string, string> {
  let names: string[];
  try {
    names = fs.readdirSync(root);
  } catch {
    return new Map();
  }
  names.sort();
  const buckets = new Map<string, string>();
  for (const fname of names) {
    const bucket = bucketFromFilename(fname);
    if (bucket === null) {
      continue;
    }
    const existing = buckets.get(bucket);
    if (existing !== undefined) {
      throw new LayoutError(
        `two files claim bucket ${JSON.stringify(bucket)}: ` +
          `${JSON.stringify(existing)} and ${JSON.stringify(fname)}`,
      );
    }
    buckets.set(bucket, fname);
  }
  return buckets;
}

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

/**
 * Classify a checkout's Atlas content as atomized or consolidated.
 *
 * `root` is the directory that CONTAINS the layout — i.e. the `content/` dir itself
 * under the atomized tree, or the directory holding the composed bucket files under
 * the consolidated one. Use `resolveAtlasRoot` first if you hold a repo root.
 */
export function detectLayout(root: string): AtlasLayout {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(root);
  } catch {
    throw new LayoutError(`${JSON.stringify(root)} is not a directory`);
  }
  if (!stat.isDirectory()) {
    throw new LayoutError(`${JSON.stringify(root)} is not a directory`);
  }

  const hasBuckets = bucketFilesIn(root).size > 0;
  // The atomized tree is identified by its root scope document, not by a recursive
  // scan — a recursive "is there any document.md anywhere" is both slow and true of
  // a partially written tree.
  const hasAtomRoot = isFile(path.join(root, 'A', '0', 'document.md'));

  if (hasBuckets && hasAtomRoot) {
    throw new LayoutError(
      `${JSON.stringify(root)} contains BOTH consolidated Atlas files and an atomized ` +
        'content tree. This is almost certainly a half-finished migration — refusing to guess.',
    );
  }
  if (hasBuckets) {
    return CONSOLIDATED;
  }
  if (hasAtomRoot) {
    return ATOMIZED;
  }

  throw new LayoutError(
    `${JSON.stringify(root)} matches neither Atlas layout: no consolidated ` +
      '"<docNo> - <name>.md" files and no A/0/document.md. An empty or truncated ' +
      'checkout reaches here; it must NOT be treated as a pre-cutover ref, which is ' +
      'what an empty walk result used to imply.',
  );
}

// ---------------------------------------------------------------------------
// Reassembly (consolidated → composed markdown)
// ---------------------------------------------------------------------------

/**
 * Rebuild the single composed markdown stream from the consolidated files.
 *
 * ⭐ NO MANIFEST, BY DESIGN. Every bucket is contiguous in emit order, so the only
 * thing reassembly needs is the ORDER of the buckets — and bucket names ARE doc
 * numbers, so `compareBuckets` derives it. Nothing is stored, so nothing can go
 * stale, nothing conflicts when two edit branches touch different scopes, and
 * onboarding a new Star requires no configuration anywhere.
 *
 * ⛔ THIS NO LONGER CONCATENATES WHOLE FILES IN BUCKET ORDER. That rested on every
 * bucket being contiguous in emit order; upstream 0d36233a removed the guarantee so
 * A.6.1.2 could sit in the A.6 file, while the Prime Agents A.6.1.1.1..8 are separate
 * buckets belonging BETWEEN A.6.1.1 and A.6.1.2. Order now comes from the documents
 * (`orderDocuments`), and absolute heading levels are re-derived from doc numbers
 * (`restoreAbsoluteLevels`) because stored levels are file-relative since 11d0ff1c.
 */
export function reassemble(inputDir: string): string {
  const buckets = bucketFilesIn(inputDir);
  if (buckets.size === 0) {
    throw new LayoutError(`no Atlas bucket files found in ${JSON.stringify(inputDir)}`);
  }

  const linesBySource = new Map<string, string[]>();
  for (const fname of buckets.values()) {
    const text = fs.readFileSync(path.join(inputDir, fname), 'utf8');
    linesBySource.set(fname, text.split('\n'));
  }
  return restoreAbsoluteLevels(orderDocuments(linesBySource)).join('\n');
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Resolve a caller-supplied path to the directory that holds the Atlas layout.
 *
 * Accepts a repo root (which nests the Atlas under `content/`) or the content
 * directory itself, which is what every existing call site already passes.
 * Returns `<root>/content` when that exists as a directory, otherwise `root`.
 */
export function resolveAtlasRoot(root: string): string {
  const nested = path.join(root, 'content');
  try {
    if (fs.statSync(nested).isDirectory()) {
      return nested;
    }
  } catch {
    // fall through
  }
  return root;
}

/** The composed Atlas markdown for this checkout, whichever layout it is in. */
export function loadComposed(root: string): string {
  const layout = detectLayout(root);
  return layout === ATOMIZED ? compose(root) : reassemble(root);
}
