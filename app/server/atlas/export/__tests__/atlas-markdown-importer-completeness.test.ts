// @vitest-environment node
/**
 * Completeness check: every document in the raw markdown must appear
 * in the parsed Export Tree — no silent drops.
 *
 * Counts title lines by document type directly from the markdown string,
 * then walks the parsed tree and counts nodes by type. The two counts
 * must match exactly, both per-type and in total.
 */
import { describe, expect, it } from 'vitest';
import { parseAtlasMarkdown } from '../atlas-markdown-importer';
import { type ExportAtlasTreeDocument, type ExportAtlasTreeScopeTrees, childCollectionNames } from '../types';

const HEADER_REGEX = /^(#+)\s+([^\s]+)\s+-\s+(.*?)\s+\[(.+?)\]\s+<!--\s*UUID:\s*([a-f0-9-]*)\s*-->\s*$/i;

/**
 * Count title lines by document type directly from raw markdown.
 * This is the authoritative count — if a line matches the header regex,
 * it's a document that must appear in the tree.
 */
function countDocumentsInMarkdown(markdown: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const line of markdown.split('\n')) {
    const m = line.match(HEADER_REGEX);
    if (m) {
      const type = m[4];
      counts.set(type, (counts.get(type) || 0) + 1);
    }
  }
  return counts;
}

/**
 * Walk the parsed Export Tree and count nodes by document type.
 */
function countDocumentsInTree(trees: ExportAtlasTreeScopeTrees): Map<string, number> {
  const counts = new Map<string, number>();

  function walk(node: ExportAtlasTreeDocument) {
    counts.set(node.type, (counts.get(node.type) || 0) + 1);
    for (const collName of childCollectionNames) {
      const children = (node as unknown as Record<string, unknown>)[collName];
      if (Array.isArray(children)) {
        for (const child of children as ExportAtlasTreeDocument[]) {
          walk(child);
        }
      }
    }
  }

  for (const tree of trees) {
    walk(tree);
  }
  return counts;
}

function totalCount(map: Map<string, number>): number {
  let total = 0;
  for (const count of map.values()) total += count;
  return total;
}

/**
 * Live test against the real Atlas markdown from GitHub.
 * Run explicitly: npm run test:run -- --testNamePattern "live"
 *
 * Skipped by default to avoid network dependency in CI.
 */
describe('Atlas Markdown Importer — live completeness', () => {
  it.skipIf(!process.env.TEST_LIVE)(
    'parser matches raw document counts from live GitHub markdown',
    async () => {
      const response = await fetch(
        'https://raw.githubusercontent.com/sky-ecosystem/next-gen-atlas/refs/heads/main/Sky%20Atlas/Sky%20Atlas.md',
      );
      expect(response.ok).toBe(true);
      const markdown = await response.text();

      const rawCounts = countDocumentsInMarkdown(markdown);
      const tree = parseAtlasMarkdown(markdown);
      const treeCounts = countDocumentsInTree(tree);

      const rawTotal = totalCount(rawCounts);
      const treeTotal = totalCount(treeCounts);

      console.log(`\nLive Atlas document counts:`);
      console.log(`  Total in markdown: ${rawTotal}`);
      console.log(`  Total in parsed tree: ${treeTotal}`);
      const allTypes = [...new Set([...rawCounts.keys(), ...treeCounts.keys()])].sort();
      for (const type of allTypes) {
        const raw = rawCounts.get(type) || 0;
        const parsed = treeCounts.get(type) || 0;
        const match = raw === parsed ? '✓' : '✗';
        console.log(`  ${match} ${type}: ${raw} → ${parsed}`);
      }

      // Assert totals match
      expect(treeTotal).toBe(rawTotal);

      // Assert per-type
      for (const type of allTypes) {
        const raw = rawCounts.get(type) || 0;
        const parsed = treeCounts.get(type) || 0;
        expect(parsed, `Type "${type}": expected ${raw}, got ${parsed}`).toBe(raw);
      }
    },
    30000,
  );
});

describe('Atlas Markdown Importer — completeness', () => {
  // Use a known sample to keep the test fast and deterministic.
  // This covers the critical structure: Scope → Article → Section → children.
  const sampleMarkdown = `# A.0 - The Immutable Alignment Scope [Scope]  <!-- UUID: 00000000-0000-0000-0000-000000000001 -->

Content for scope.

## A.0.1 - First Article [Article]  <!-- UUID: 00000000-0000-0000-0000-000000000002 -->

Article content.

### A.0.1.1 - First Section [Section]  <!-- UUID: 00000000-0000-0000-0000-000000000003 -->

Section content.

#### A.0.1.1.1 - A Core Document [Core]  <!-- UUID: 00000000-0000-0000-0000-000000000004 -->

Core content.

#### A.0.1.1.0.3.1 - An Annotation [Annotation]  <!-- UUID: 00000000-0000-0000-0000-000000000005 -->

Annotation content.

#### A.0.1.1.0.4.1 - A Tenet [Action Tenet]  <!-- UUID: 00000000-0000-0000-0000-000000000006 -->

Tenet content.

##### A.0.1.1.0.4.1.1.1 - A Scenario [Scenario]  <!-- UUID: 00000000-0000-0000-0000-000000000007 -->

Scenario content.

**Scenario Setup**:

Setup text.

**Scenario Expected Outcome**:

Outcome text.

###### A.0.1.1.0.4.1.1.1.var1 - A Variation [Scenario Variation]  <!-- UUID: 00000000-0000-0000-0000-000000000008 -->

Variation content.

# A.1 - Second Scope [Scope]  <!-- UUID: 00000000-0000-0000-0000-000000000009 -->

Another scope.
`;

  it('parser produces the same document count per type as raw markdown', () => {
    const rawCounts = countDocumentsInMarkdown(sampleMarkdown);
    const tree = parseAtlasMarkdown(sampleMarkdown);
    const treeCounts = countDocumentsInTree(tree);

    // Check total
    expect(totalCount(treeCounts)).toBe(totalCount(rawCounts));

    // Check per type
    const allTypes = new Set([...rawCounts.keys(), ...treeCounts.keys()]);
    for (const type of allTypes) {
      const raw = rawCounts.get(type) || 0;
      const parsed = treeCounts.get(type) || 0;
      expect(parsed, `Type "${type}": expected ${raw} from markdown, got ${parsed} in tree`).toBe(raw);
    }
  });

  it('every UUID from the markdown appears in the tree', () => {
    // Collect UUIDs from raw markdown
    const rawUuids = new Set<string>();
    for (const line of sampleMarkdown.split('\n')) {
      const m = line.match(HEADER_REGEX);
      if (m && m[5]) rawUuids.add(m[5]);
    }

    // Collect UUIDs from tree
    const tree = parseAtlasMarkdown(sampleMarkdown);
    const treeUuids = new Set<string>();
    function walkUuids(node: ExportAtlasTreeDocument) {
      if (node.uuid) treeUuids.add(node.uuid);
      for (const collName of childCollectionNames) {
        const children = (node as unknown as Record<string, unknown>)[collName];
        if (Array.isArray(children)) {
          for (const child of children as ExportAtlasTreeDocument[]) walkUuids(child);
        }
      }
    }
    for (const t of tree) walkUuids(t);

    // Every raw UUID should be in the tree
    for (const uuid of rawUuids) {
      expect(treeUuids.has(uuid), `UUID ${uuid} from markdown is missing in parsed tree`).toBe(true);
    }
    expect(treeUuids.size).toBe(rawUuids.size);
  });

  it('sample has expected type counts', () => {
    // Sanity check: make sure the sample itself has the documents we expect
    const rawCounts = countDocumentsInMarkdown(sampleMarkdown);
    expect(rawCounts.get('Scope')).toBe(2);
    expect(rawCounts.get('Article')).toBe(1);
    expect(rawCounts.get('Section')).toBe(1);
    expect(rawCounts.get('Core')).toBe(1);
    expect(rawCounts.get('Annotation')).toBe(1);
    expect(rawCounts.get('Action Tenet')).toBe(1);
    expect(rawCounts.get('Scenario')).toBe(1);
    expect(rawCounts.get('Scenario Variation')).toBe(1);
    expect(totalCount(rawCounts)).toBe(9);
  });
});
