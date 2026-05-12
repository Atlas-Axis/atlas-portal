// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { ParsedDoc } from '../../atlas/compose';
import type { DocChange } from '../atom-tree-diff';
import { buildHierarchicalBranches, renderBranchToHtml } from '../hierarchical-tree';

function doc(partial: Partial<ParsedDoc>): ParsedDoc {
  return {
    folderPath: ['A'],
    uuid: 'unset',
    docNo: 'A',
    name: 'Doc',
    docType: 'Scope',
    depth: 0,
    childType: 'sections_and_primary_docs',
    targets: [],
    contentLines: [],
    ...partial,
  };
}

describe('buildHierarchicalBranches', () => {
  it('returns empty when nothing changed', () => {
    const docs = [doc({ uuid: 'u1', docNo: 'A' })];
    expect(buildHierarchicalBranches(docs, docs, [])).toEqual([]);
  });

  it('produces one branch for a single modified doc with no changed siblings', () => {
    const base = [
      doc({ uuid: 'a', docNo: 'A', name: 'Root', contentLines: ['root body'] }),
      doc({ uuid: 'a1', docNo: 'A.1', name: 'Child', contentLines: ['old text'] }),
    ];
    const head = [
      doc({ uuid: 'a', docNo: 'A', name: 'Root', contentLines: ['root body'] }),
      doc({ uuid: 'a1', docNo: 'A.1', name: 'Child', contentLines: ['new text'] }),
    ];
    const changes: DocChange[] = [{ kind: 'modified', current: head[1], base: base[1] }];

    const branches = buildHierarchicalBranches(base, head, changes);
    expect(branches).toHaveLength(1);
    expect(branches[0].label).toBe('Child');
    expect(branches[0].summary).toContain('1 edited');

    // Parent-path framing: the outer node is the unchanged "Root" (compact),
    // with the changed "Child" nested inside its children.
    const root = branches[0].root;
    expect(root.id).toBe('A');
    expect(root.compact).toBe(true);
    expect(root.status).toBeNull();
    expect(root.children).toHaveLength(1);
    expect(root.children[0].id).toBe('A.1');
    expect(root.children[0].status).toBe('Edited');
  });

  it('marks added docs as Inserted and renders them as new', () => {
    const base = [doc({ uuid: 'a', docNo: 'A', name: 'Root' })];
    const head = [
      doc({ uuid: 'a', docNo: 'A', name: 'Root' }),
      doc({ uuid: 'a1', docNo: 'A.1', name: 'Brand New', contentLines: ['fresh body'] }),
    ];
    const changes: DocChange[] = [{ kind: 'added', current: head[1] }];

    const branches = buildHierarchicalBranches(base, head, changes);
    expect(branches).toHaveLength(1);
    const root = branches[0].root;
    expect(root.children[0].status).toBe('Inserted');
    expect(root.children[0].bodyHtml).toContain('diff-add');
  });

  it('marks removed docs as Deleted and nests them under the nearest living ancestor', () => {
    const base = [
      doc({ uuid: 'a', docNo: 'A', name: 'Root' }),
      doc({ uuid: 'a1', docNo: 'A.1', name: 'Going Away', contentLines: ['goodbye'] }),
    ];
    const head = [doc({ uuid: 'a', docNo: 'A', name: 'Root' })];
    const changes: DocChange[] = [{ kind: 'removed', base: base[1] }];

    const branches = buildHierarchicalBranches(base, head, changes);
    expect(branches).toHaveLength(1);

    // Branch root is the surviving parent A, with deleted child A.1 inside.
    const root = branches[0].root;
    expect(root.id).toBe('A');
    expect(root.children).toHaveLength(1);
    expect(root.children[0].id).toBe('A.1');
    expect(root.children[0].status).toBe('Deleted');
    expect(root.children[0].bodyHtml).toContain('diff-del');
  });

  it('groups sibling changes under their common parent', () => {
    const base = [
      doc({ uuid: 'a', docNo: 'A', name: 'Root' }),
      doc({ uuid: 'a1', docNo: 'A.1', name: 'One', contentLines: ['v1'] }),
      doc({ uuid: 'a2', docNo: 'A.2', name: 'Two', contentLines: ['v1'] }),
    ];
    const head = [
      doc({ uuid: 'a', docNo: 'A', name: 'Root' }),
      doc({ uuid: 'a1', docNo: 'A.1', name: 'One', contentLines: ['v2'] }),
      doc({ uuid: 'a2', docNo: 'A.2', name: 'Two', contentLines: ['v2'] }),
    ];
    const changes: DocChange[] = [
      { kind: 'modified', current: head[1], base: base[1] },
      { kind: 'modified', current: head[2], base: base[2] },
    ];

    const branches = buildHierarchicalBranches(base, head, changes);
    // Two siblings under one parent → elevated to a single branch rooted at the parent.
    expect(branches).toHaveLength(1);
    expect(branches[0].label).toBe('Root');
    const root = branches[0].root;
    expect(root.children.map((c) => c.id).sort()).toEqual(['A.1', 'A.2']);
  });

  it('produces separate branches for changes in disjoint subtrees', () => {
    const base = [
      doc({ uuid: 'a', docNo: 'A', name: 'Root' }),
      doc({ uuid: 'a1', docNo: 'A.1', name: 'Left Wing' }),
      doc({ uuid: 'a2', docNo: 'A.2', name: 'Right Wing' }),
      doc({ uuid: 'a1c', docNo: 'A.1.1', name: 'Left Leaf', contentLines: ['v1'] }),
      doc({ uuid: 'a2c', docNo: 'A.2.1', name: 'Right Leaf', contentLines: ['v1'] }),
    ];
    const head = [
      doc({ uuid: 'a', docNo: 'A', name: 'Root' }),
      doc({ uuid: 'a1', docNo: 'A.1', name: 'Left Wing' }),
      doc({ uuid: 'a2', docNo: 'A.2', name: 'Right Wing' }),
      doc({ uuid: 'a1c', docNo: 'A.1.1', name: 'Left Leaf', contentLines: ['v2'] }),
      doc({ uuid: 'a2c', docNo: 'A.2.1', name: 'Right Leaf', contentLines: ['v2'] }),
    ];
    const changes: DocChange[] = [
      { kind: 'modified', current: head[3], base: base[3] },
      { kind: 'modified', current: head[4], base: base[4] },
    ];

    const branches = buildHierarchicalBranches(base, head, changes);
    expect(branches).toHaveLength(2);
    expect(branches.map((b) => b.label).sort()).toEqual(['Left Leaf', 'Right Leaf']);
  });

  it('renders a word-level title diff when a doc name changes', () => {
    const base = [
      doc({ uuid: 'a', docNo: 'A', name: 'Root' }),
      doc({ uuid: 'a1', docNo: 'A.1', name: 'Old Name', contentLines: ['same'] }),
    ];
    const head = [
      doc({ uuid: 'a', docNo: 'A', name: 'Root' }),
      doc({ uuid: 'a1', docNo: 'A.1', name: 'New Name', contentLines: ['same'] }),
    ];
    const changes: DocChange[] = [{ kind: 'modified', current: head[1], base: base[1] }];

    const branches = buildHierarchicalBranches(base, head, changes);
    const node = branches[0].root.children[0];
    expect(node.titleDiff).not.toBeNull();
    expect(node.titleDiff).toContain('removed');
    expect(node.titleDiff).toContain('added');
  });

  it('disambiguates branches sharing a root document name', () => {
    const base = [
      doc({ uuid: 'a', docNo: 'A', name: 'Atlas' }),
      doc({ uuid: 's1', docNo: 'A.1', name: 'Sky' }),
      doc({ uuid: 's2', docNo: 'A.2', name: 'Sea' }),
      doc({ uuid: 'c1', docNo: 'A.1.1', name: 'Definitions', contentLines: ['v1'] }),
      doc({ uuid: 'c2', docNo: 'A.2.1', name: 'Definitions', contentLines: ['v1'] }),
    ];
    const head = [
      doc({ uuid: 'a', docNo: 'A', name: 'Atlas' }),
      doc({ uuid: 's1', docNo: 'A.1', name: 'Sky' }),
      doc({ uuid: 's2', docNo: 'A.2', name: 'Sea' }),
      doc({ uuid: 'c1', docNo: 'A.1.1', name: 'Definitions', contentLines: ['v2'] }),
      doc({ uuid: 'c2', docNo: 'A.2.1', name: 'Definitions', contentLines: ['v2'] }),
    ];
    const changes: DocChange[] = [
      { kind: 'modified', current: head[3], base: base[3] },
      { kind: 'modified', current: head[4], base: base[4] },
    ];

    const branches = buildHierarchicalBranches(base, head, changes);
    expect(branches).toHaveLength(2);
    const labels = branches.map((b) => b.displayLabel).sort();
    expect(labels[0]).toMatch(/Definitions — /);
    expect(labels[1]).toMatch(/Definitions — /);
    expect(new Set(branches.map((b) => b.slug)).size).toBe(2);
  });

  it('hides unchanged siblings inside an active branch', () => {
    const base = [
      doc({ uuid: 'a', docNo: 'A', name: 'Root' }),
      doc({ uuid: 'a1', docNo: 'A.1', name: 'Stays', contentLines: ['same'] }),
      doc({ uuid: 'a2', docNo: 'A.2', name: 'Changes', contentLines: ['old'] }),
      doc({ uuid: 'a3', docNo: 'A.3', name: 'Also Stays', contentLines: ['same'] }),
    ];
    const head = [
      doc({ uuid: 'a', docNo: 'A', name: 'Root' }),
      doc({ uuid: 'a1', docNo: 'A.1', name: 'Stays', contentLines: ['same'] }),
      doc({ uuid: 'a2', docNo: 'A.2', name: 'Changes', contentLines: ['new'] }),
      doc({ uuid: 'a3', docNo: 'A.3', name: 'Also Stays', contentLines: ['same'] }),
    ];
    const changes: DocChange[] = [{ kind: 'modified', current: head[2], base: base[2] }];

    const branches = buildHierarchicalBranches(base, head, changes);
    expect(branches).toHaveLength(1);
    // Branch root is the parent-path "Root"; under it, A.2 is the only visible
    // child, and A.1 / A.3 are listed as hidden.
    const root = branches[0].root;
    expect(root.children.map((c) => c.id)).toEqual(['A.2']);
    expect(root.hiddenChildren.map((c) => c.id).sort()).toEqual(['A.1', 'A.3']);
  });

  it('keeps unchanged intermediate ancestors visible when they have changed descendants', () => {
    const base = [
      doc({ uuid: 'a', docNo: 'A', name: 'Root' }),
      doc({ uuid: 'a1', docNo: 'A.1', name: 'Mid' }),
      doc({ uuid: 'a11', docNo: 'A.1.1', name: 'Deep', contentLines: ['v1'] }),
    ];
    const head = [
      doc({ uuid: 'a', docNo: 'A', name: 'Root' }),
      doc({ uuid: 'a1', docNo: 'A.1', name: 'Mid' }),
      doc({ uuid: 'a11', docNo: 'A.1.1', name: 'Deep', contentLines: ['v2'] }),
    ];
    const changes: DocChange[] = [{ kind: 'modified', current: head[2], base: base[2] }];

    const branches = buildHierarchicalBranches(base, head, changes);
    expect(branches).toHaveLength(1);
    const root = branches[0].root;
    expect(root.id).toBe('A');
    expect(root.children).toHaveLength(1);
    expect(root.children[0].id).toBe('A.1');
    expect(root.children[0].children).toHaveLength(1);
    expect(root.children[0].children[0].id).toBe('A.1.1');
  });
});

describe('renderBranchToHtml', () => {
  function buildSingleEditBranch() {
    const base = [
      doc({ uuid: 'a', docNo: 'A', name: 'Root' }),
      doc({ uuid: 'a1', docNo: 'A.1', name: 'Edited Doc', contentLines: ['old paragraph'] }),
    ];
    const head = [
      doc({ uuid: 'a', docNo: 'A', name: 'Root' }),
      doc({ uuid: 'a1', docNo: 'A.1', name: 'Edited Doc', contentLines: ['new paragraph'] }),
    ];
    const changes: DocChange[] = [{ kind: 'modified', current: head[1], base: base[1] }];
    return buildHierarchicalBranches(base, head, changes)[0];
  }

  it('renders the branch as nested .branch / .doc / .doc-body HTML', () => {
    const branch = buildSingleEditBranch();
    const html = renderBranchToHtml(branch);
    expect(html).toContain('class="branch"');
    expect(html).toContain('class="doc compact"'); // Root framing
    expect(html).toContain('class="doc"'); // The edited doc
    expect(html).toContain('class="branch-children"');
    expect(html).toContain('data-doc-id="A.1"');
    expect(html).toContain('data-doc-uuid="a1"');
    expect(html).toContain('class="doc-meta"');
    expect(html).toContain('Edited');
  });

  it('renders word-level diff spans inside changed lines', () => {
    const branch = buildSingleEditBranch();
    const html = renderBranchToHtml(branch);
    expect(html).toMatch(/class="removed[^"]*"/);
    expect(html).toMatch(/class="added[^"]*"/);
  });

  it('does not render a body for compact framing ancestors', () => {
    const branch = buildSingleEditBranch();
    const html = renderBranchToHtml(branch);
    // Root is compact and has no body — body only appears for the edited child.
    const rootSection = html.split('class="branch-children"')[0];
    expect(rootSection).not.toContain('doc-body');
  });
});
