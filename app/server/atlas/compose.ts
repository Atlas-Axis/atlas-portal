/**
 * Compose the folder-per-document Atlas tree back into the monolithic Sky Atlas markdown.
 *
 * Faithful TypeScript port of `sync/compose.py` from `sky-ecosystem/next-gen-atlas`
 * (proposed/atomic-atlas branch). Walks `content/`, parses each `document.md`, and
 * reconstructs the linear `Sky Atlas/Sky Atlas.md` byte stream.
 *
 * Source heading level is computed structurally — NOT stored verbatim:
 * - For non-NR documents: count of ancestor folders that have a `document.md`,
 *   capped at 6. Phantom extension folders (e.g. `A/1/4/5/0/4/`) carry only
 *   `_index.md` and don't count, which gives the correct depth for Action
 *   Tenets, Annotations, Scenarios, and Variations without any path
 *   restructure.
 * - For Needed Research documents: their attached Target Document's heading
 *   level + 1, capped at 6. Target attachment is read from frontmatter
 *   (`targets: [<UUID>, ...]`).
 *
 * Emit order: depth-first walk of `content/A/`. At each folder: emit folder's
 * document.md (if present), then any NRs whose `targets[0]` matches this doc's
 * UUID (sorted by NR number ascending), then recurse children.
 *
 * `content/NR/` is intentionally NOT walked — every NR is emitted via its target.
 * Orphan NRs (no resolvable target) are appended at end with a stderr warning.
 */
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------

export interface ParsedDoc {
  /** ('A', '0', '1') for content/A/0/1/document.md */
  folderPath: string[];
  uuid: string;
  docNo: string;
  name: string;
  docType: string;
  depth: number;
  childType: string;
  /** UUIDs of attached Target Documents (NRs only, today). */
  targets: string[];
  /** Verbatim from source — split of content_str by "\n". */
  contentLines: string[];
}

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

/**
 * Inverse of `decompose.yaml_quote_name` — only handles the double-quoted form.
 *
 * Decodes escaped backslash and double-quote (mirror of yaml_quote_name).
 */
export function unquoteYamlName(s: string): string {
  const trimmed = s.trim();
  if (trimmed.length >= 2 && trimmed[0] === '"' && trimmed[trimmed.length - 1] === '"') {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return trimmed;
}

/** Parse a YAML inline list value like `[uuid1, uuid2]` into a list. */
export function parseTargetsValue(v: string): string[] {
  const trimmed = v.trim();
  if (!(trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    throw new Error(`expected YAML inline list, got ${JSON.stringify(v)}`);
  }
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) {
    return [];
  }
  return inner
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * Parse a single `document.md` file.
 *
 * Layout (matches build_document_md in decompose.py):
 *     ---
 *     {frontmatter inner}
 *     ---
 *     [blank line]
 *     {heading line}
 *     {content lines, verbatim from source}
 */
export function parseDocumentMd(text: string, folderPath: string[]): ParsedDoc {
  const lines = text.split('\n');
  if (lines.length === 0 || lines[0] !== '---') {
    throw new Error(`document.md at ${folderPath.join('/')} does not start with ---`);
  }
  // Find the second '---' (closing frontmatter) starting from index 1.
  let endFm = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      endFm = i;
      break;
    }
  }
  if (endFm === -1) {
    throw new Error(`document.md at ${folderPath.join('/')} has unterminated frontmatter`);
  }

  const fmLines = lines.slice(1, endFm);
  const fm: Record<string, string> = {};
  for (const fl of fmLines) {
    const colonIdx = fl.indexOf(':');
    if (colonIdx === -1) {
      continue;
    }
    const key = fl.slice(0, colonIdx).trim();
    const val = fl.slice(colonIdx + 1).trim();
    fm[key] = val;
  }

  let targets: string[] = [];
  if ('targets' in fm) {
    targets = parseTargetsValue(fm.targets);
  }

  // After endFm: blank line(s), then heading line, then content lines.
  const post = lines.slice(endFm + 1);
  // Skip leading blank(s) — exactly one is the convention.
  let idx = 0;
  while (idx < post.length && post[idx] === '') {
    idx += 1;
  }
  let contentLines: string[];
  if (idx >= post.length) {
    // No heading line — doc with empty body.
    contentLines = [];
  } else {
    // idx points at the heading line in document.md (which uses min(depth+1, 6)
    // hashes — we don't trust it; we recompute the source heading level from
    // structure).
    contentLines = post.slice(idx + 1);
  }

  // Required frontmatter fields. If missing, raise — matches Python's KeyError.
  for (const requiredKey of ['id', 'docNo', 'name', 'type', 'depth', 'childType']) {
    if (!(requiredKey in fm)) {
      throw new Error(`document.md at ${folderPath.join('/')} missing required frontmatter key: ${requiredKey}`);
    }
  }

  return {
    folderPath,
    uuid: fm.id,
    docNo: fm.docNo,
    name: unquoteYamlName(fm.name),
    docType: fm.type,
    depth: parseInt(fm.depth, 10),
    childType: fm.childType,
    targets,
    contentLines,
  };
}

// ---------------------------------------------------------------------------
// Tree discovery
// ---------------------------------------------------------------------------

/** Walk content_root, parse every document.md, return list of ParsedDocs. */
export function findAllDocuments(contentRoot: string): ParsedDoc[] {
  const docs: ParsedDoc[] = [];

  function walk(dir: string, relSegments: string[]): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    const hasDocumentMd = entries.some((e) => e.isFile() && e.name === 'document.md');
    if (hasDocumentMd) {
      const fullPath = path.join(dir, 'document.md');
      const text = fs.readFileSync(fullPath, 'utf8');
      docs.push(parseDocumentMd(text, [...relSegments]));
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), [...relSegments, entry.name]);
      }
    }
  }

  walk(contentRoot, []);
  return docs;
}

// ---------------------------------------------------------------------------
// Heading-level computation
// ---------------------------------------------------------------------------

/** Compute source heading level for each document, keyed by UUID. */
export function computeHeadingLevels(docs: ParsedDoc[], contentRoot: string): Map<string, number> {
  const byUuid = new Map<string, ParsedDoc>();
  for (const d of docs) {
    byUuid.set(d.uuid, d);
  }

  // Cache folder→has_document.md to avoid repeated stat calls.
  const hasDocCache = new Map<string, boolean>();

  function hasDocumentMd(pathSegments: string[]): boolean {
    const key = pathSegments.join('/');
    const cached = hasDocCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const fullPath =
      pathSegments.length > 0
        ? path.join(contentRoot, ...pathSegments, 'document.md')
        : path.join(contentRoot, 'document.md');
    let result = false;
    try {
      result = fs.statSync(fullPath).isFile();
    } catch {
      result = false;
    }
    hasDocCache.set(key, result);
    return result;
  }

  const levels = new Map<string, number>();

  function levelOf(doc: ParsedDoc): number {
    const cached = levels.get(doc.uuid);
    if (cached !== undefined) {
      return cached;
    }
    let lv: number;
    if (doc.docNo.startsWith('NR-')) {
      if (doc.targets.length === 0) {
        // Orphan NR — should not happen for valid Atlas, but don't crash.
        lv = 1;
      } else {
        const target = byUuid.get(doc.targets[0]);
        if (target === undefined) {
          lv = 1;
        } else {
          lv = Math.min(levelOf(target) + 1, 6);
        }
      }
    } else {
      // Count ancestor folders that have document.md.
      // folder_path = ('A', '0', '1') means ancestors are ('A',) and ('A', '0').
      let count = 0;
      for (let i = 1; i < doc.folderPath.length; i++) {
        if (hasDocumentMd(doc.folderPath.slice(0, i))) {
          count += 1;
        }
      }
      lv = Math.min(count + 1, 6);
    }
    levels.set(doc.uuid, lv);
    return lv;
  }

  for (const d of docs) {
    levelOf(d);
  }
  return levels;
}

// ---------------------------------------------------------------------------
// Heading line construction
// ---------------------------------------------------------------------------

/** Reconstruct a source heading line: `# A.0 - Name [Type]  <!-- UUID: ... -->`. */
export function buildHeadingLine(doc: ParsedDoc, level: number): string {
  return `${'#'.repeat(level)} ${doc.docNo} - ${doc.name} [${doc.docType}]  <!-- UUID: ${doc.uuid} -->`;
}

// ---------------------------------------------------------------------------
// Sibling sort
// ---------------------------------------------------------------------------

/**
 * Sort key for a child folder so emitted order matches source order.
 *
 * Empirical rules from current Atlas (verified across all 3,537 parents):
 * - All sibling folder names are integer-named, except `var1` (which only
 *   appears as a sole child of a Scenario folder).
 * - `0` folders, when present, are always phantom (no document.md).
 * - Real-doc siblings come before phantom siblings.
 * - Within a bucket, integer ascending order.
 *
 * Sort key tuple: [bucket, numericValue, name]
 *   bucket 0: real-doc with integer name
 *   bucket 1: phantom (no document.md)
 *   bucket 2: var1 / non-integer (rare/unique)
 */
export function childSortKey(parentFullPath: string, childName: string): [number, number, string] {
  const fullChild = path.join(parentFullPath, childName);
  let hasDoc = false;
  try {
    hasDoc = fs.statSync(path.join(fullChild, 'document.md')).isFile();
  } catch {
    hasDoc = false;
  }
  const isInt = /^\d+$/.test(childName);
  if (isInt) {
    return [hasDoc ? 0 : 1, parseInt(childName, 10), childName];
  }
  // var1 (only non-integer in current Atlas) — alone in practice, sort late.
  return [2, 0, childName];
}

function compareSortKeys(a: [number, number, string], b: [number, number, string]): number {
  if (a[0] !== b[0]) {
    return a[0] - b[0];
  }
  if (a[1] !== b[1]) {
    return a[1] - b[1];
  }
  if (a[2] < b[2]) {
    return -1;
  }
  if (a[2] > b[2]) {
    return 1;
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Compose
// ---------------------------------------------------------------------------

/**
 * Walk content_root, emit reconstructed Sky Atlas markdown.
 *
 * Returns the composed markdown as a string. Logs warnings to stderr for
 * orphan NRs / non-emitted docs (parity with Python).
 */
export function compose(contentRoot: string): string {
  const docs = findAllDocuments(contentRoot);
  const byUuid = new Map<string, ParsedDoc>();
  for (const d of docs) {
    byUuid.set(d.uuid, d);
  }
  const byFolder = new Map<string, ParsedDoc>();
  for (const d of docs) {
    byFolder.set(d.folderPath.join('/'), d);
  }
  const levels = computeHeadingLevels(docs, contentRoot);

  // NRs grouped by placement target, sorted numerically.
  const nrByTarget = new Map<string, ParsedDoc[]>();
  const orphanNrs: ParsedDoc[] = [];
  for (const d of docs) {
    if (!d.docNo.startsWith('NR-')) {
      continue;
    }
    if (d.targets.length > 0 && byUuid.has(d.targets[0])) {
      const list = nrByTarget.get(d.targets[0]);
      if (list === undefined) {
        nrByTarget.set(d.targets[0], [d]);
      } else {
        list.push(d);
      }
    } else {
      orphanNrs.push(d);
    }
  }
  const nrNumber = (nr: ParsedDoc): number => parseInt(nr.docNo.split('-')[1], 10);
  for (const list of nrByTarget.values()) {
    list.sort((a, b) => nrNumber(a) - nrNumber(b));
  }
  orphanNrs.sort((a, b) => nrNumber(a) - nrNumber(b));

  const outputLines: string[] = [];
  const emitted = new Set<string>();

  function emitDoc(d: ParsedDoc): void {
    if (emitted.has(d.uuid)) {
      return; // paranoid guard against accidental cycles
    }
    emitted.add(d.uuid);
    const level = levels.get(d.uuid);
    if (level === undefined) {
      throw new Error(`internal: no level computed for ${d.uuid}`);
    }
    outputLines.push(buildHeadingLine(d, level));
    outputLines.push(...d.contentLines);
    // After emitting, emit any NRs attached to this doc.
    const attachedNrs = nrByTarget.get(d.uuid);
    if (attachedNrs !== undefined) {
      for (const nr of attachedNrs) {
        emitDoc(nr);
      }
    }
  }

  function visitFolder(folderPath: string[]): void {
    const fullPath = folderPath.length > 0 ? path.join(contentRoot, ...folderPath) : contentRoot;
    // Emit this folder's doc, if present (and not an NR — NRs come via target lookup).
    const d = byFolder.get(folderPath.join('/'));
    if (d !== undefined && !d.docNo.startsWith('NR-')) {
      emitDoc(d);
    }
    // Recurse into children.
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(fullPath, { withFileTypes: true });
    } catch {
      return;
    }
    const children = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    children.sort((a, b) => compareSortKeys(childSortKey(fullPath, a), childSortKey(fullPath, b)));
    for (const child of children) {
      visitFolder([...folderPath, child]);
    }
  }

  // Start: walk content/A/ depth-first. Scopes (A.0, A.1, ..., A.6) are top docs.
  // content/NR/ is intentionally NOT walked — NRs are emitted via their targets.
  visitFolder(['A']);

  // Sanity: orphan NRs (no resolvable target) get appended at end with a warning.
  if (orphanNrs.length > 0) {
    process.stderr.write(
      `WARNING: ${orphanNrs.length} NR document(s) have no resolvable ` + `target — appending at end of output.\n`,
    );
    for (const nr of orphanNrs) {
      emitDoc(nr);
    }
  }

  // Sanity: every doc should have been emitted exactly once.
  const notEmitted = docs.filter((d) => !emitted.has(d.uuid));
  if (notEmitted.length > 0) {
    process.stderr.write(`WARNING: ${notEmitted.length} document(s) were not emitted by the tree walk:\n`);
    for (const d of notEmitted.slice(0, 10)) {
      process.stderr.write(`  - ${d.docNo} at ${d.folderPath.join('/')}\n`);
    }
  }

  return outputLines.join('\n');
}
