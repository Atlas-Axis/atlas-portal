/**
 * Hierarchical doc-stream builder.
 *
 * Takes the full base / head atom-trees and produces a list of "branch" nodes
 * — one per natural scope root (a changed doc with no changed ancestor) —
 * each laying out the document hierarchy beneath it: parent path, changed
 * descendants, deleted descendants nested in place. Renders unchanged
 * intermediate ancestors as "compact" framing so the reader can see where a
 * change sits in the tree without drowning in unchanged context.
 *
 * Output is plain server-rendered HTML; no client-side scripting required.
 */
import { type ParsedDoc } from '../atlas/compose';
import { type DocChange } from './atom-tree-diff';
import { makeCompareHtml, makeFinalHtml } from './compare-html';
import { escapeHtml, wordDiff } from './diff';

// ---------------------------------------------------------------------------
// Tree node shape.
// ---------------------------------------------------------------------------

export type NodeStatus = 'Edited' | 'Inserted' | 'Deleted' | null;

export interface TreeNode {
  /** Document number (e.g. "A.1.2.3"), or empty for synthetic roots. */
  id: string;
  /** Display name. */
  title: string;
  /** UUID — empty string for deleted-only synthetic nodes that lack one. */
  uuid: string;
  /** Change status — null means unchanged framing. */
  status: NodeStatus;
  /** True when the node is unchanged framing (no body shown). */
  compact: boolean;
  /** Body HTML for the doc — diff'd when status is set, clean otherwise. */
  bodyHtml: string;
  /** Word-level diff of the doc name when it changed. */
  titleDiff: string | null;
  /** Visible children — changed docs and ancestors-of-changed docs. */
  children: TreeNode[];
  /** Hidden children — unchanged siblings collapsed into a summary. */
  hiddenChildren: TreeNode[];
}

/** One independent change "branch" rooted at a scope root document. */
export interface ScopeBranch {
  /**
   * Display label — the scope root's name, with a uniqueness suffix appended
   * if multiple branches share the same name.
   */
  label: string;
  /** Optional suffix shown in muted type after the label. */
  labelDetail: string;
  /** Combined label (label + detail), suitable as a section title. */
  displayLabel: string;
  /** Plain-text summary of what changed inside this branch. */
  summary: string;
  /** Stable id used as an HTML anchor. */
  slug: string;
  /** The scope root's tree, with parent path prepended. */
  root: TreeNode;
}

// ---------------------------------------------------------------------------
// Parent-uuid assignment (number-prefix → uuid).
// ---------------------------------------------------------------------------

/**
 * For each doc, find the doc whose number is the nearest prefix and record
 * its UUID. Walks up segment by segment so Action Data numbering
 * (e.g. `X.0.6.1` whose parent is `X`) resolves correctly.
 */
function assignParentUuids(docs: ParsedDoc[]): Map<string, string | null> {
  const numToDoc = new Map<string, ParsedDoc>();
  for (const d of docs) {
    if (d.docNo) {
      numToDoc.set(d.docNo, d);
    }
  }
  const parentByUuid = new Map<string, string | null>();
  for (const doc of docs) {
    if (!doc.docNo) {
      parentByUuid.set(doc.uuid, null);
      continue;
    }
    const parts = doc.docNo.split('.');
    let parentUuid: string | null = null;
    for (let i = parts.length - 1; i > 0; i--) {
      const parentNum = parts.slice(0, i).join('.');
      const parent = numToDoc.get(parentNum);
      if (parent && parent.uuid) {
        parentUuid = parent.uuid;
        break;
      }
    }
    parentByUuid.set(doc.uuid, parentUuid);
  }
  return parentByUuid;
}

// ---------------------------------------------------------------------------
// Doc-number sort key — handles A.10.2 > A.9.1 correctly.
// ---------------------------------------------------------------------------

function docNoSortKey(num: string): Array<[number, number, string]> {
  const parts = num.split('.');
  return parts.map((p) => {
    if (/^\d+$/.test(p)) {
      return [0, parseInt(p, 10), p] as [number, number, string];
    }
    return [1, 0, p] as [number, number, string];
  });
}

function compareDocNos(a: string, b: string): number {
  const ka = docNoSortKey(a);
  const kb = docNoSortKey(b);
  for (let i = 0; i < Math.min(ka.length, kb.length); i++) {
    const [a0, a1, a2] = ka[i];
    const [b0, b1, b2] = kb[i];
    if (a0 !== b0) return a0 - b0;
    if (a1 !== b1) return a1 - b1;
    if (a2 !== b2) return a2 < b2 ? -1 : 1;
  }
  return ka.length - kb.length;
}

// ---------------------------------------------------------------------------
// Slugify — for anchor ids.
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// Scope detection — find independent change roots.
// ---------------------------------------------------------------------------

interface ScopeDef {
  rootDoc: ParsedDoc;
  rootNumber: string;
}

function detectScopes(changedDocs: ParsedDoc[], allCurrentDocs: ParsedDoc[]): ScopeDef[] {
  const changedNumbers = new Set<string>();
  for (const d of changedDocs) {
    if (d.docNo) changedNumbers.add(d.docNo);
  }

  const numToDoc = new Map<string, ParsedDoc>();
  for (const d of allCurrentDocs) {
    if (d.docNo) numToDoc.set(d.docNo, d);
  }

  // Scope root: a changed doc with no changed ancestor by number prefix.
  const scopeRoots: ParsedDoc[] = [];
  for (const doc of changedDocs) {
    if (!doc.docNo) continue;
    const parts = doc.docNo.split('.');
    let hasChangedAncestor = false;
    for (let i = 1; i < parts.length; i++) {
      const ancestorNum = parts.slice(0, i).join('.');
      if (changedNumbers.has(ancestorNum)) {
        hasChangedAncestor = true;
        break;
      }
    }
    if (!hasChangedAncestor) {
      scopeRoots.push(doc);
    }
  }

  if (scopeRoots.length === 0) {
    return [];
  }

  // Group siblings by immediate parent and elevate where safe.
  const allRootNums = new Set(scopeRoots.map((r) => r.docNo));
  const parentGroups = new Map<string, ParsedDoc[]>();
  for (const root of scopeRoots) {
    const parts = root.docNo.split('.');
    const parentNum = parts.length > 1 ? parts.slice(0, -1).join('.') : '';
    if (!parentGroups.has(parentNum)) parentGroups.set(parentNum, []);
    parentGroups.get(parentNum)!.push(root);
  }

  const groupedRoots: ParsedDoc[] = [];
  for (const [parentNum, roots] of parentGroups) {
    if (roots.length === 1) {
      groupedRoots.push(roots[0]);
      continue;
    }
    const groupNums = new Set(roots.map((r) => r.docNo));
    const wouldOverlap = Array.from(allRootNums).some(
      (otherNum) =>
        otherNum !== parentNum && parentNum !== '' && otherNum.startsWith(parentNum + '.') && !groupNums.has(otherNum),
    );
    if (wouldOverlap || parentNum === '') {
      groupedRoots.push(...roots);
      continue;
    }
    const parentDoc = numToDoc.get(parentNum);
    if (parentDoc) {
      groupedRoots.push(parentDoc);
    } else {
      groupedRoots.push(...roots);
    }
  }

  // Drop roots that have a descendant which is also a root.
  const keptRoots = groupedRoots.filter(
    (root) => !groupedRoots.some((other) => other.docNo !== root.docNo && other.docNo.startsWith(root.docNo + '.')),
  );

  // Dedupe by docNo (parent elevation can pick the same parent twice).
  const seen = new Set<string>();
  const unique: ParsedDoc[] = [];
  for (const r of keptRoots) {
    if (seen.has(r.docNo)) continue;
    seen.add(r.docNo);
    unique.push(r);
  }

  unique.sort((a, b) => compareDocNos(a.docNo, b.docNo));

  return unique.map((rootDoc) => ({ rootDoc, rootNumber: rootDoc.docNo }));
}

// ---------------------------------------------------------------------------
// Label disambiguation — multiple branches with the same name.
// ---------------------------------------------------------------------------

interface ScopeLabel {
  label: string;
  labelDetail: string;
  displayLabel: string;
  slug: string;
}

function findAncestorNames(rootDoc: ParsedDoc, allDocs: ParsedDoc[]): string[] {
  if (!rootDoc.docNo) return [];
  const numToDoc = new Map<string, ParsedDoc>();
  for (const d of allDocs) {
    if (d.docNo) numToDoc.set(d.docNo, d);
  }
  const parts = rootDoc.docNo.split('.');
  const ancestors: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    const parentNum = parts.slice(0, i).join('.');
    const parent = numToDoc.get(parentNum);
    if (parent) {
      ancestors.push(parent.name);
    }
  }
  return ancestors;
}

function buildScopeLabels(scopeDefs: ScopeDef[], allCurrentDocs: ParsedDoc[]): Map<string, ScopeLabel> {
  const labels = new Map<string, ScopeLabel>();

  const groupKey = (name: string): string =>
    name
      .toLowerCase()
      .replace(/[-‐-―]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const grouped = new Map<string, ScopeDef[]>();
  for (const def of scopeDefs) {
    const key = groupKey(def.rootDoc.name);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(def);
  }

  const slugCount = new Map<string, number>();
  const allocSlug = (base: string): string => {
    const candidate = base || 'scope';
    let n = slugCount.get(candidate) ?? 0;
    if (n === 0) {
      slugCount.set(candidate, 1);
      return candidate;
    }
    while (slugCount.has(`${candidate}-${n + 1}`)) {
      n += 1;
    }
    n += 1;
    slugCount.set(candidate, n);
    return `${base || 'scope'}-${n}`;
  };

  for (const defs of grouped.values()) {
    if (defs.length === 1) {
      const def = defs[0];
      const slug = allocSlug(slugify(def.rootDoc.name));
      labels.set(def.rootNumber, {
        label: def.rootDoc.name,
        labelDetail: '',
        displayLabel: def.rootDoc.name,
        slug,
      });
      continue;
    }

    // Multiple branches share a name — disambiguate via shortest unique ancestor chain.
    const ancestorChains = new Map<string, string[]>();
    for (const def of defs) {
      ancestorChains.set(def.rootNumber, findAncestorNames(def.rootDoc, allCurrentDocs).reverse());
    }
    for (const def of defs) {
      const chain = ancestorChains.get(def.rootNumber) ?? [];
      let detail = '';
      for (let depth = 1; depth <= chain.length; depth++) {
        const candidate = chain.slice(0, depth);
        const unique = defs.every((other) => {
          if (other.rootNumber === def.rootNumber) return true;
          const otherChain = ancestorChains.get(other.rootNumber) ?? [];
          if (otherChain.length < depth) return true;
          return otherChain.slice(0, depth).join(' / ') !== candidate.join(' / ');
        });
        if (unique) {
          detail = candidate.join(' / ');
          break;
        }
      }
      if (!detail) {
        detail = def.rootNumber;
      }
      const slug = allocSlug(slugify(`${def.rootDoc.name} ${detail}`));
      labels.set(def.rootNumber, {
        label: def.rootDoc.name,
        labelDetail: detail,
        displayLabel: `${def.rootDoc.name} — ${detail}`,
        slug,
      });
    }
  }

  return labels;
}

// ---------------------------------------------------------------------------
// Tree building — the core hierarchy assembly.
// ---------------------------------------------------------------------------

interface ChangeIndex {
  changedNumbers: Set<string>;
  newUuids: Set<string>;
  baseByUuid: Map<string, ParsedDoc>;
  currentByUuid: Map<string, ParsedDoc>;
  currentUuids: Set<string>;
  currentChildrenByParent: Map<string, ParsedDoc[]>;
  baseChildrenByParent: Map<string, ParsedDoc[]>;
  baseParentByUuid: Map<string, string | null>;
}

function buildDeletedNode(doc: ParsedDoc, idx: ChangeIndex): TreeNode {
  const childNodes: TreeNode[] = [];
  if (doc.uuid) {
    const children = idx.baseChildrenByParent.get(doc.uuid) ?? [];
    for (const d of children) {
      if (d.uuid && !idx.currentUuids.has(d.uuid)) {
        childNodes.push(buildDeletedNode(d, idx));
      }
    }
  }
  childNodes.sort((a, b) => compareDocNos(a.id, b.id));

  return {
    id: doc.docNo,
    title: doc.name,
    uuid: doc.uuid || '',
    status: 'Deleted',
    compact: false,
    bodyHtml: makeCompareHtml('', doc.contentLines.join('\n'), { isDeleted: true }),
    titleDiff: null,
    children: childNodes,
    hiddenChildren: [],
  };
}

function hasVisibleDescendants(node: TreeNode): boolean {
  for (const child of node.children) {
    if (child.status) return true;
    if (hasVisibleDescendants(child)) return true;
  }
  for (const child of node.hiddenChildren) {
    if (child.status) return true;
    if (hasVisibleDescendants(child)) return true;
  }
  return false;
}

function buildNode(doc: ParsedDoc, isChanged: boolean, idx: ChangeIndex): TreeNode {
  const oldDoc = doc.uuid ? idx.baseByUuid.get(doc.uuid) : undefined;

  let status: NodeStatus = null;
  let isNew = false;

  if (doc.uuid && idx.newUuids.has(doc.uuid)) {
    status = 'Inserted';
    isNew = true;
  } else if (isChanged && oldDoc) {
    const newBody = doc.contentLines.join('\n');
    const oldBody = oldDoc.contentLines.join('\n');
    if (oldBody !== newBody || oldDoc.name !== doc.name) {
      status = 'Edited';
    }
  } else if (isChanged && !oldDoc) {
    status = 'Inserted';
    isNew = true;
  }

  const newBody = doc.contentLines.join('\n');
  const oldBody = oldDoc ? oldDoc.contentLines.join('\n') : '';

  const bodyHtml = status ? makeCompareHtml(oldBody, newBody, { isNew }) : makeFinalHtml(newBody);

  const directChildren = doc.uuid ? (idx.currentChildrenByParent.get(doc.uuid) ?? []) : [];

  const deletedChildren: ParsedDoc[] = [];
  if (doc.uuid) {
    const baseChildren = idx.baseChildrenByParent.get(doc.uuid) ?? [];
    for (const d of baseChildren) {
      if (d.uuid && !idx.currentUuids.has(d.uuid)) {
        deletedChildren.push(d);
      }
    }
  }

  const sortedDirect = directChildren.slice().sort((a, b) => compareDocNos(a.docNo, b.docNo));

  const children: TreeNode[] = [];
  const hiddenChildren: TreeNode[] = [];
  for (const child of sortedDirect) {
    const childChanged = idx.changedNumbers.has(child.docNo);
    const childNode = buildNode(child, childChanged, idx);
    if (childChanged || hasVisibleDescendants(childNode)) {
      children.push(childNode);
    } else {
      hiddenChildren.push(childNode);
    }
  }
  for (const delChild of deletedChildren) {
    children.push(buildDeletedNode(delChild, idx));
  }
  children.sort((a, b) => compareDocNos(a.id, b.id));

  const titleDiff = oldDoc && oldDoc.name !== doc.name ? wordDiff(oldDoc.name, doc.name) : null;

  return {
    id: doc.docNo,
    title: doc.name,
    uuid: doc.uuid || '',
    status,
    // No status means the doc was only pulled in as framing for deleted
    // descendants — render it compact so it reads as context, not as a change.
    compact: status === null,
    bodyHtml,
    titleDiff,
    children,
    hiddenChildren,
  };
}

function buildIndex(
  baseDocs: ParsedDoc[],
  headDocs: ParsedDoc[],
  changes: DocChange[],
): { idx: ChangeIndex; changedDocs: ParsedDoc[]; deletedDocs: ParsedDoc[] } {
  const baseByUuid = new Map<string, ParsedDoc>();
  for (const d of baseDocs) {
    if (d.uuid) baseByUuid.set(d.uuid, d);
  }
  const currentByUuid = new Map<string, ParsedDoc>();
  for (const d of headDocs) {
    if (d.uuid) currentByUuid.set(d.uuid, d);
  }
  const currentUuids = new Set(currentByUuid.keys());

  const currentParentByUuid = assignParentUuids(headDocs);
  const baseParentByUuid = assignParentUuids(baseDocs);

  const currentChildrenByParent = new Map<string, ParsedDoc[]>();
  for (const d of headDocs) {
    const p = currentParentByUuid.get(d.uuid);
    if (p) {
      if (!currentChildrenByParent.has(p)) currentChildrenByParent.set(p, []);
      currentChildrenByParent.get(p)!.push(d);
    }
  }
  const baseChildrenByParent = new Map<string, ParsedDoc[]>();
  for (const d of baseDocs) {
    const p = baseParentByUuid.get(d.uuid);
    if (p) {
      if (!baseChildrenByParent.has(p)) baseChildrenByParent.set(p, []);
      baseChildrenByParent.get(p)!.push(d);
    }
  }

  const changedDocs: ParsedDoc[] = [];
  const deletedDocs: ParsedDoc[] = [];
  const newUuids = new Set<string>();
  const changedNumbers = new Set<string>();

  for (const c of changes) {
    if (c.kind === 'added' && c.current) {
      changedDocs.push(c.current);
      if (c.current.uuid) newUuids.add(c.current.uuid);
      if (c.current.docNo) changedNumbers.add(c.current.docNo);
    } else if (c.kind === 'modified' && c.current) {
      changedDocs.push(c.current);
      if (c.current.docNo) changedNumbers.add(c.current.docNo);
    } else if (c.kind === 'removed' && c.base) {
      deletedDocs.push(c.base);
    }
  }

  // Pull each deleted doc's nearest *living* ancestor into the changed set
  // so its branch surfaces in the all-branches view.
  for (const d of deletedDocs) {
    let ancestorUuid: string | null | undefined = baseParentByUuid.get(d.uuid);
    while (ancestorUuid) {
      const live = currentByUuid.get(ancestorUuid);
      if (live) {
        if (live.docNo && !changedNumbers.has(live.docNo)) {
          changedNumbers.add(live.docNo);
          changedDocs.push(live);
        }
        break;
      }
      ancestorUuid = baseParentByUuid.get(ancestorUuid) ?? null;
    }
  }

  changedDocs.sort((a, b) => compareDocNos(a.docNo, b.docNo));

  return {
    idx: {
      changedNumbers,
      newUuids,
      baseByUuid,
      currentByUuid,
      currentUuids,
      currentChildrenByParent,
      baseChildrenByParent,
      baseParentByUuid,
    },
    changedDocs,
    deletedDocs,
  };
}

// ---------------------------------------------------------------------------
// Parent-path framing — prepend ancestor chain so the branch reads top-down.
// ---------------------------------------------------------------------------

function prependParentPath(root: TreeNode, rootDoc: ParsedDoc, headDocs: ParsedDoc[], idx: ChangeIndex): TreeNode {
  if (!rootDoc.docNo) return root;
  const numToDoc = new Map<string, ParsedDoc>();
  for (const d of headDocs) {
    if (d.docNo) numToDoc.set(d.docNo, d);
  }
  const parts = rootDoc.docNo.split('.');
  const ancestors: ParsedDoc[] = [];
  for (let i = 1; i < parts.length; i++) {
    const parentNum = parts.slice(0, i).join('.');
    const parent = numToDoc.get(parentNum);
    if (parent) ancestors.push(parent);
  }

  // Immediate parent (the doc directly above the scope root) carries the
  // scope root's unchanged siblings as hidden children — gives the reader
  // a one-line "n unedited sibling documents" affordance per branch.
  const immediateParentNum = parts.length > 1 ? parts.slice(0, -1).join('.') : '';
  const immediateParent = immediateParentNum ? numToDoc.get(immediateParentNum) : undefined;
  const siblingHidden: TreeNode[] = [];
  if (immediateParent && immediateParent.uuid) {
    const siblings = idx.currentChildrenByParent.get(immediateParent.uuid) ?? [];
    for (const sib of siblings) {
      if (sib.docNo === rootDoc.docNo) continue;
      if (idx.changedNumbers.has(sib.docNo)) continue;
      siblingHidden.push({
        id: sib.docNo,
        title: sib.name,
        uuid: sib.uuid || '',
        status: null,
        compact: true,
        bodyHtml: '',
        titleDiff: null,
        children: [],
        hiddenChildren: [],
      });
    }
    siblingHidden.sort((a, b) => compareDocNos(a.id, b.id));
  }

  let branch = root;
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const anc = ancestors[i];
    const isImmediate = i === ancestors.length - 1;
    branch = {
      id: anc.docNo,
      title: anc.name,
      uuid: anc.uuid || '',
      status: null,
      compact: true,
      bodyHtml: '',
      titleDiff: null,
      children: [branch],
      hiddenChildren: isImmediate ? siblingHidden : [],
    };
  }
  return branch;
}

// ---------------------------------------------------------------------------
// Public entry point.
// ---------------------------------------------------------------------------

interface BranchSummaryStats {
  edited: number;
  inserted: number;
  deleted: number;
}

function summarizeBranch(node: TreeNode): BranchSummaryStats {
  const stats: BranchSummaryStats = { edited: 0, inserted: 0, deleted: 0 };
  function walk(n: TreeNode): void {
    if (n.status === 'Edited') stats.edited += 1;
    else if (n.status === 'Inserted') stats.inserted += 1;
    else if (n.status === 'Deleted') stats.deleted += 1;
    for (const c of n.children) walk(c);
  }
  walk(node);
  return stats;
}

function formatSummary(stats: BranchSummaryStats): string {
  const parts: string[] = [];
  if (stats.edited > 0) {
    parts.push(`${stats.edited} edited document${stats.edited === 1 ? '' : 's'}`);
  }
  if (stats.inserted > 0) {
    parts.push(`${stats.inserted} new document${stats.inserted === 1 ? '' : 's'}`);
  }
  if (stats.deleted > 0) {
    parts.push(`${stats.deleted} removed document${stats.deleted === 1 ? '' : 's'}`);
  }
  return parts.length > 0 ? parts.join(', ') : 'Changes in this branch';
}

/**
 * Build the full set of branches for the proposal page.
 *
 * Each branch is independently rooted at a "scope root" (a changed doc with
 * no changed ancestor), with the parent path prepended as compact framing.
 * Within each branch, descendants are nested using UUID-based parent links;
 * deleted docs nest under their original parent.
 */
export function buildHierarchicalBranches(
  baseDocs: ParsedDoc[],
  headDocs: ParsedDoc[],
  changes: DocChange[],
): ScopeBranch[] {
  const { idx, changedDocs } = buildIndex(baseDocs, headDocs, changes);
  if (changedDocs.length === 0) {
    // Even when there are no modified-or-added docs (deletion-only edit),
    // detectScopes returns nothing. Fall back to surfacing deleted-doc
    // ancestors directly — buildIndex already pulled them into changedDocs.
    return [];
  }

  const scopeDefs = detectScopes(changedDocs, headDocs);
  const labels = buildScopeLabels(scopeDefs, headDocs);

  const branches: ScopeBranch[] = [];
  for (const def of scopeDefs) {
    const isRootChanged = idx.changedNumbers.has(def.rootNumber);
    const innerRoot = buildNode(def.rootDoc, isRootChanged, idx);
    const framed = prependParentPath(innerRoot, def.rootDoc, headDocs, idx);
    const stats = summarizeBranch(innerRoot);
    const labelMeta = labels.get(def.rootNumber) ?? {
      label: def.rootDoc.name,
      labelDetail: '',
      displayLabel: def.rootDoc.name,
      slug: slugify(def.rootDoc.name) || 'scope',
    };
    branches.push({
      label: labelMeta.label,
      labelDetail: labelMeta.labelDetail,
      displayLabel: labelMeta.displayLabel,
      summary: formatSummary(stats),
      slug: labelMeta.slug,
      root: framed,
    });
  }
  return branches;
}

// ---------------------------------------------------------------------------
// HTML rendering.
// ---------------------------------------------------------------------------

function renderNodeHtml(node: TreeNode): string {
  const statusClass =
    node.status === 'Edited'
      ? 'status-edited'
      : node.status === 'Inserted'
        ? 'status-inserted'
        : node.status === 'Deleted'
          ? 'status-deleted'
          : '';

  const metaHtml = node.status
    ? `<div class="doc-meta"><span class="${statusClass}">${escapeHtml(node.status)}</span></div>`
    : '';

  const titleHtml = node.titleDiff ?? escapeHtml(node.title);
  const compactClass = node.compact ? ' compact' : '';
  const idAttr = node.id ? ` data-doc-id="${escapeHtml(node.id)}"` : '';
  const uuidAttr = node.uuid ? ` data-doc-uuid="${escapeHtml(node.uuid)}"` : '';
  const bodyHtml = node.compact && !node.status ? '' : `<div class="doc-body">${node.bodyHtml}</div>`;

  return (
    `<section class="doc${compactClass}"${idAttr}${uuidAttr}>` +
    `<div class="doc-content">` +
    `<div class="doc-head"><div>` +
    metaHtml +
    `<h3>${titleHtml}</h3>` +
    (node.id ? `<p class="doc-id">${escapeHtml(node.id)}</p>` : '') +
    `</div></div>` +
    bodyHtml +
    `</div></section>`
  );
}

function renderBranchHtml(node: TreeNode): string {
  const childBranches = node.children.map(renderBranchHtml).join('');
  const collapsedGroup =
    node.hiddenChildren.length > 0
      ? `<div class="collapsed-group"><p>${node.hiddenChildren.length} unedited child document${node.hiddenChildren.length === 1 ? '' : 's'} omitted</p></div>`
      : '';
  const childrenWrap =
    childBranches || node.hiddenChildren.length > 0
      ? `<div class="branch-children">${collapsedGroup}${childBranches}</div>`
      : '';
  return `<div class="branch">${renderNodeHtml(node)}${childrenWrap}</div>`;
}

/** Render a single branch as HTML — used to embed in the page. */
export function renderBranchToHtml(branch: ScopeBranch): string {
  return renderBranchHtml(branch.root);
}
