/**
 * UUID-keyed atom-tree diff for Atlas Edit Proposals.
 *
 * Ports the "atom-tree mode" of `~/repos/atlas-review/renderer/atlas_preview/renderer.py`
 * (line ~1400 onward): post-cutover, every document has a stable UUID and lives
 * in its own file under `content/`. We don't need to do line-based diffing
 * across the composed monolith — we can compare body/name/number directly
 * across UUID-matched documents.
 *
 * This avoids the heading-detection false positives that the legacy line-based
 * path produces (e.g., `# Constants` inside a fenced code block).
 */
import type { ParsedDoc } from '../atlas/compose';

export interface DocChange {
  /** The kind of change. */
  kind: 'added' | 'removed' | 'modified';
  /** The current (head) doc, if it exists. */
  current?: ParsedDoc;
  /** The base doc, if it existed in the base ref. */
  base?: ParsedDoc;
}

/**
 * Recompose a document's body for comparison purposes.
 *
 * `ParsedDoc` stores `contentLines` (the body minus the heading line), which
 * is what we want for body comparison — heading text changes are detected via
 * the `name` field.
 */
function bodyOf(doc: ParsedDoc): string {
  return doc.contentLines.join('\n');
}

/**
 * Detect changed documents between two atom-trees, keyed by UUID.
 *
 * Output is split into three buckets:
 * - `added`: UUID present in head but not in base.
 * - `removed`: UUID present in base but not in head.
 * - `modified`: UUID present in both, but `body` / `name` / `docNo` differ.
 *
 * The `modified` bucket excludes pure renumbering (only `docNo` changes with
 * identical body+name) to avoid drowning the diff in noise when a single
 * insertion shifts the numbering of every sibling. Callers that want to
 * surface renumbering can compare `docNo` themselves.
 *
 * Result is returned in a stable order: added first (by docNo), then
 * modified (by docNo), then removed (by docNo).
 */
export function detectAtomTreeChanges(baseDocs: ParsedDoc[], headDocs: ParsedDoc[]): DocChange[] {
  const baseByUuid = new Map<string, ParsedDoc>();
  for (const d of baseDocs) {
    if (d.uuid) baseByUuid.set(d.uuid, d);
  }
  const headByUuid = new Map<string, ParsedDoc>();
  for (const d of headDocs) {
    if (d.uuid) headByUuid.set(d.uuid, d);
  }

  const added: DocChange[] = [];
  const modified: DocChange[] = [];
  const removed: DocChange[] = [];

  for (const head of headDocs) {
    if (!head.uuid) continue;
    const base = baseByUuid.get(head.uuid);
    if (!base) {
      added.push({ kind: 'added', current: head });
      continue;
    }
    const headBody = bodyOf(head);
    const baseBody = bodyOf(base);
    if (headBody !== baseBody || head.name !== base.name) {
      modified.push({ kind: 'modified', current: head, base });
    }
  }

  for (const base of baseDocs) {
    if (!base.uuid) continue;
    if (!headByUuid.has(base.uuid)) {
      removed.push({ kind: 'removed', base });
    }
  }

  const byDocNo = (a: DocChange, b: DocChange): number => {
    const ka = (a.current?.docNo ?? a.base?.docNo) || '';
    const kb = (b.current?.docNo ?? b.base?.docNo) || '';
    return ka.localeCompare(kb, undefined, { numeric: true });
  };
  added.sort(byDocNo);
  modified.sort(byDocNo);
  removed.sort(byDocNo);

  return [...added, ...modified, ...removed];
}
