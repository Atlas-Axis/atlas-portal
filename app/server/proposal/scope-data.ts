/**
 * Type definitions for the `scope_data` JSON produced by the Python
 * renderer (scripts/renderer/atlas_preview/renderer.py::build_scope_data).
 *
 * Atomic-Atlas proposal diffs are organized into "scopes" — independent
 * subtrees of edited documents. Each scope has a root document, a lineage
 * to that root (ancestors), surrounding siblings for context, and a tree
 * of changed (and contextual) descendant documents.
 *
 * The Python builder emits HTML for each document's body in two flavours:
 *   - `compareHtml`: paragraph-level diff with <span class="diff-add">
 *     and <span class="diff-del"> highlighting word-level changes.
 *   - `finalHtml`:  the document's body as it appears in the head version
 *     (no diff markup).
 *
 * The /proposal page consumes this JSON; the TypeScript renderer wraps
 * the per-doc HTML payloads with branch headers, doc titles, and CSS.
 */

/** One document in the scope tree. */
export interface ScopeNode {
  /** Document number (e.g. "A.2.2.8.1"). */
  id: string;
  /** Document name (the part after the number, before the type). */
  title: string;
  /** Document UUID. May be empty for some legacy artifacts. */
  uuid: string;
  /**
   * Change status. `null` for unchanged context docs, "Edited" / "Inserted" /
   * "Deleted" for documents that participate in the diff.
   */
  status: 'Edited' | 'Inserted' | 'Deleted' | null;
  /** True if this doc is rendered compactly (unchanged context). */
  compact: boolean;
  /** HTML body in compare mode (with diff highlights when status is set). */
  compareHtml: string;
  /** HTML body in final mode (head version, no diff markup). */
  finalHtml: string;
  /** Line range start (file-local in atom-tree mode). */
  lineStart: number;
  /** Line range end. */
  lineEnd: number;
  /** Visible children (changed, or have changed descendants). */
  children: ScopeNode[];
  /** Hidden context children (unchanged, no changed descendants). */
  hiddenChildren: ScopeNode[];
  /** Word-level diff HTML for the title, if name changed. */
  titleDiff?: string;
  /** Previous document number when the doc was renumbered. Undefined if the
   * doc's number didn't change. */
  oldId?: string;
}

/** Lineage entry — an ancestor of the scope root, for breadcrumb context. */
export interface LineageEntry {
  id: string;
  title: string;
  uuid: string;
  finalHtml: string;
  lineStart: number;
  lineEnd: number;
}

/** Sibling entry — peer of the scope root, included for navigational context. */
export interface SiblingEntry {
  id: string;
  title: string;
  uuid: string;
  finalHtml: string;
  compact: boolean;
  lineStart: number;
  lineEnd: number;
}

/** One scope = one independent edit subtree. */
export interface Scope {
  label: string;
  labelDetail: string;
  displayLabel: string;
  summaryCompare: string;
  summaryFinal: string;
  lineage: LineageEntry[];
  siblingsBefore: SiblingEntry[];
  siblingsAfter: SiblingEntry[];
  root: ScopeNode;
}

/** Top-level scope_data shape. */
export interface ScopeData {
  branch: string;
  base: string;
  title: string;
  repo: string;
  pr_number: number | null;
  stats: {
    new: number;
    modified: number;
    removed: number;
    renumbered: number;
    total: number;
  };
  /** Scopes keyed by slug. */
  scopes: Record<string, Scope>;
  renumbered: Array<{ oldId: string; newId: string; title: string }>;
}
