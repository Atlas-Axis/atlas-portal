/**
 * Parity tests for the TypeScript port of `sync/compose.py`.
 *
 * Mirrors the 76-test suite in `sync/test_compose.py` from
 * `adamgfraser/next-gen-atlas:proposed/atomic-atlas`.
 *
 * Includes:
 * - Frontmatter parsing tests (TestParseDocumentMd)
 * - Sibling sort tests (TestChildSortKey)
 * - Heading-line construction (TestBuildHeadingLine)
 * - Frontmatter helpers (TestUnquoteYamlName, TestParseTargetsValue)
 * - Decompose↔compose roundtrip tests (TestRoundtrip — requires inline decompose)
 *
 * Plus an end-to-end byte-identical roundtrip against the live
 * `proposed/atomic-atlas` content tree (gated on TS_ATLAS_LIVE_CONTENT_DIR /
 * TS_ATLAS_LIVE_MONOLITH being set).
 */
// @vitest-environment node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type ParsedDoc,
  buildHeadingLine,
  childSortKey,
  compose,
  parseDocumentMd,
  parseTargetsValue,
  unquoteYamlName,
} from './compose';

// ---------------------------------------------------------------------------
// Inline decompose helper for roundtrip tests
//
// Faithful TS port of the relevant pieces of `sync/decompose.py` so the tests
// can mirror the Python suite's roundtrip pattern (decompose source → compose
// → assert byte-identical).
// ---------------------------------------------------------------------------

interface DecomposeDoc {
  docNo: string;
  name: string;
  docType: string;
  uuid: string;
  headingLevel: number;
  content: string;
  isNr: boolean;
  segments: string[];
  depth: number;
  childType: string;
  folderPathSegments: string[];
  targets: string[];
}

const HEADING_RE = /^(#{1,6})\s+(\S+)\s+-\s+(.+?)\s+\[([^\]]+)\]\s+<!--\s*UUID:\s*([0-9a-f-]+)\s*-->/;

function computeDepth(docNo: string, docType: string, isNr: boolean, segments: string[]): number {
  if (isNr) return 2;
  if (docType === 'Scope') return segments.length - 1;
  if (segments.length > 0 && segments[segments.length - 1].startsWith('var')) {
    return segments.length - 1;
  }
  return segments.length;
}

function computeChildType(docType: string): string {
  const map: Record<string, string> = {
    Article: 'articles',
    'Active Data': 'active_data',
    Annotation: 'annotations',
    Scenario: 'tenets',
    'Scenario Variation': 'tenets',
    'Needed Research': 'needed_research',
  };
  return map[docType] ?? 'sections_and_primary_docs';
}

function decomposeParseAtlas(text: string): DecomposeDoc[] {
  const lines = text.split('\n');
  const documents: DecomposeDoc[] = [];
  let current: DecomposeDoc | null = null;
  let contentLines: string[] = [];
  let lastNonNrUuid: string | null = null;

  function finalize(): void {
    if (current !== null) {
      current.content = contentLines.join('\n');
      documents.push(current);
    }
    current = null;
    contentLines = [];
  }

  for (const line of lines) {
    const m = line.match(HEADING_RE);
    if (m) {
      finalize();
      const [, hashes, docNo, name, docType, uuid] = m;
      const isNr = docNo.startsWith('NR-');
      const segments = isNr ? docNo.split('-') : docNo.split('.');
      const folderPathSegments = isNr ? docNo.split('-') : docNo.split('.');
      const depth = computeDepth(docNo, docType, isNr, segments);
      const childType = computeChildType(docType);
      const targets: string[] = [];
      if (isNr && lastNonNrUuid !== null) {
        targets.push(lastNonNrUuid);
      }
      current = {
        docNo,
        name,
        docType,
        uuid,
        headingLevel: hashes.length,
        content: '',
        isNr,
        segments,
        depth,
        childType,
        folderPathSegments,
        targets,
      };
      if (!isNr) {
        lastNonNrUuid = uuid;
      }
      contentLines = [];
    } else if (current !== null) {
      contentLines.push(line);
    }
  }
  finalize();
  return documents;
}

function yamlQuoteName(name: string): string {
  const specialChars = ['"', "'", '&', ':', '#', '{', '}', '[', ']', '!', '|', '>', '%', '@', '`'];
  const needsQuoting = specialChars.some((c) => name.includes(c));
  if (!needsQuoting) return name;
  const escaped = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function buildFrontmatter(doc: DecomposeDoc): string {
  const lines = [
    '---',
    `id: ${doc.uuid}`,
    `docNo: ${doc.docNo}`,
    `name: ${yamlQuoteName(doc.name)}`,
    `type: ${doc.docType}`,
    `depth: ${doc.depth}`,
    `childType: ${doc.childType}`,
  ];
  if (doc.isNr && doc.targets.length > 0) {
    lines.push(`targets: [${doc.targets.join(', ')}]`);
  }
  lines.push('---');
  return lines.join('\n');
}

function buildDocumentMd(doc: DecomposeDoc): string {
  const frontmatter = buildFrontmatter(doc);
  const outputLevel = Math.min(doc.depth + 1, 6);
  const heading = `${'#'.repeat(outputLevel)} ${doc.docNo} - ${doc.name} [${doc.docType}]`;
  if (doc.content) {
    return `${frontmatter}\n\n${heading}\n${doc.content}`;
  }
  return `${frontmatter}\n\n${heading}\n`;
}

function decomposeWriteTree(text: string, outputRoot: string): void {
  const docs = decomposeParseAtlas(text);
  for (const doc of docs) {
    const folder = path.join(outputRoot, ...doc.folderPathSegments);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'document.md'), buildDocumentMd(doc), 'utf8');
  }
}

function roundtrip(sourceText: string): { composed: string; expected: string } {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'compose-test-'));
  try {
    const contentPath = path.join(tmpdir, 'content');
    decomposeWriteTree(sourceText, contentPath);
    const composed = compose(contentPath);
    return { composed, expected: sourceText };
  } finally {
    fs.rmSync(tmpdir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Roundtrip fixtures (mirror ROUNDTRIP_FIXTURES in test_compose.py)
// ---------------------------------------------------------------------------

const ROUNDTRIP_FIXTURES: string[] = [
  // Smallest possible: one Scope, one Article, one Section, one Core.
  `# A.0 - Atlas Preamble [Scope]  <!-- UUID: 8650a584-01f8-45d6-882b-c14eab9879c4 -->

This Preamble will be further populated.

## A.0.1 - Atlas Preamble [Article]  <!-- UUID: 56b15d7d-cdd4-4594-bd95-4f094564ac04 -->

This Article contains definitions.

### A.0.1.1 - Definitions [Section]  <!-- UUID: c7d62f28-1d64-4632-8cd8-4f2b44c51bba -->

This Section contains essential definitions.

#### A.0.1.1.1 - Organizational Alignment [Core]  <!-- UUID: 4f6fda1e-7450-4065-8095-e93cb10b3a2a -->

Organizational alignment is a traditional business concept.
`,
  // NR with target attachment + structured-field body.
  `# A.0 - Atlas Preamble [Scope]  <!-- UUID: 8650a584-01f8-45d6-882b-c14eab9879c4 -->

This Preamble.

## A.0.1 - Atlas Preamble [Article]  <!-- UUID: 56b15d7d-cdd4-4594-bd95-4f094564ac04 -->

Article body.

### A.0.1.1 - Definitions [Section]  <!-- UUID: c7d62f28-1d64-4632-8cd8-4f2b44c51bba -->

Section body.

#### NR-1 - Research Topic [Needed Research]  <!-- UUID: 2da58ba2-a172-43bd-b7e7-d3d8e69233bf -->

**Content**:

This is research track content that includes the **Content**: structured field.

It spans multiple paragraphs.

#### A.0.1.1.1 - Organizational Alignment [Core]  <!-- UUID: 4f6fda1e-7450-4065-8095-e93cb10b3a2a -->

Core body.
`,
  // Extension segments attached to a specific sub-Core, with a sibling Core after.
  `# A.0 - Atlas Preamble [Scope]  <!-- UUID: 11111111-1111-1111-1111-111111111111 -->

Scope.

## A.0.1 - Article [Article]  <!-- UUID: 22222222-2222-2222-2222-222222222222 -->

Article.

### A.0.1.1 - Section [Section]  <!-- UUID: 33333333-3333-3333-3333-333333333333 -->

Section.

#### A.0.1.1.1 - First Core [Core]  <!-- UUID: 44444444-4444-4444-4444-444444444444 -->

First core.

##### A.0.1.1.1.0.3.1 - Annotation Of First Core [Annotation]  <!-- UUID: 55555555-5555-5555-5555-555555555555 -->

Annotation body.

##### A.0.1.1.1.0.4.1 - Action Tenet Of First Core [Action Tenet]  <!-- UUID: 66666666-6666-6666-6666-666666666666 -->

Action tenet body.

#### A.0.1.1.2 - Second Core [Core]  <!-- UUID: 77777777-7777-7777-7777-777777777777 -->

Second core.
`,
  // Multiple NRs attached to the same target, in numeric order.
  `# A.0 - Scope [Scope]  <!-- UUID: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa -->

S.

## A.0.1 - Article [Article]  <!-- UUID: bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb -->

A.

### A.0.1.1 - Section [Section]  <!-- UUID: cccccccc-cccc-cccc-cccc-cccccccccccc -->

S body.

#### NR-2 - Second NR [Needed Research]  <!-- UUID: dddddddd-dddd-dddd-dddd-dddddddddddd -->

**Content**:

NR-2 body.

#### NR-3 - Third NR [Needed Research]  <!-- UUID: eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee -->

**Content**:

NR-3 body.

#### A.0.1.1.1 - Core [Core]  <!-- UUID: ffffffff-ffff-ffff-ffff-ffffffffffff -->

Core body.
`,
  // Scenario with Variation — exercises var1 path naming and h6 cap.
  `# A.0 - Scope [Scope]  <!-- UUID: 00000000-0000-0000-0000-000000000001 -->

S.

## A.0.1 - Article [Article]  <!-- UUID: 00000000-0000-0000-0000-000000000002 -->

A.

### A.0.1.1 - Section [Section]  <!-- UUID: 00000000-0000-0000-0000-000000000003 -->

S body.

#### A.0.1.1.0.4.1 - Action Tenet [Action Tenet]  <!-- UUID: 00000000-0000-0000-0000-000000000004 -->

Tenet body.

##### A.0.1.1.0.4.1.1.1 - Scenario [Scenario]  <!-- UUID: 00000000-0000-0000-0000-000000000005 -->

**Description**:

Scenario description.

**Finding**:

Misaligned

###### A.0.1.1.0.4.1.1.1.var1 - Scenario Variation [Scenario Variation]  <!-- UUID: 00000000-0000-0000-0000-000000000006 -->

**Description**:

Variation description.
`,
];

// ---------------------------------------------------------------------------
// TestRoundtrip
// ---------------------------------------------------------------------------

describe('roundtrip', () => {
  it.each(ROUNDTRIP_FIXTURES.map((src, i) => [i, src]))('roundtrip fixture %i is byte-identical', (_idx, source) => {
    const { composed, expected } = roundtrip(source as string);
    expect(composed).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// TestParseDocumentMd
// ---------------------------------------------------------------------------

describe('parseDocumentMd', () => {
  it('parses basic frontmatter', () => {
    const text =
      '---\n' +
      'id: abc-123\n' +
      'docNo: A.0\n' +
      'name: Atlas Preamble\n' +
      'type: Scope\n' +
      'depth: 1\n' +
      'childType: sections_and_primary_docs\n' +
      '---\n' +
      '\n' +
      '## A.0 - Atlas Preamble [Scope]\n' +
      '\n' +
      'Body content.\n';
    const doc = parseDocumentMd(text, ['A', '0']);
    expect(doc.uuid).toBe('abc-123');
    expect(doc.docNo).toBe('A.0');
    expect(doc.name).toBe('Atlas Preamble');
    expect(doc.docType).toBe('Scope');
    expect(doc.depth).toBe(1);
    expect(doc.childType).toBe('sections_and_primary_docs');
    expect(doc.targets).toEqual([]);
    // Content lines exclude the heading itself; they include the trailing blank.
    expect(doc.contentLines).toEqual(['', 'Body content.', '']);
  });

  it('parses NR targets', () => {
    const text =
      '---\n' +
      'id: nr-uuid\n' +
      'docNo: NR-1\n' +
      'name: Topic\n' +
      'type: Needed Research\n' +
      'depth: 2\n' +
      'childType: needed_research\n' +
      'targets: [target-uuid-1]\n' +
      '---\n' +
      '\n' +
      '### NR-1 - Topic [Needed Research]\n' +
      '\n' +
      '**Content**:\n' +
      '\n' +
      'Body.\n';
    const doc = parseDocumentMd(text, ['NR', '1']);
    expect(doc.targets).toEqual(['target-uuid-1']);
    expect(doc.contentLines.join('\n')).toContain('**Content**:');
  });

  it('unescapes a quoted name', () => {
    const text =
      '---\n' +
      'id: u\n' +
      'docNo: A.0\n' +
      'name: "Defining \\"Severe Actions\\""\n' +
      'type: Scope\n' +
      'depth: 1\n' +
      'childType: sections_and_primary_docs\n' +
      '---\n' +
      '\n' +
      '# A.0 - Defining "Severe Actions" [Scope]\n';
    const doc = parseDocumentMd(text, ['A', '0']);
    expect(doc.name).toBe('Defining "Severe Actions"');
  });

  it('throws on missing opening fence', () => {
    expect(() => parseDocumentMd('not frontmatter', ['A'])).toThrow(/does not start with ---/);
  });

  it('throws on unterminated frontmatter', () => {
    expect(() => parseDocumentMd('---\nid: foo\n', ['A'])).toThrow(/unterminated frontmatter/);
  });

  it('handles empty body (heading then trailing newline)', () => {
    // A heading followed by a trailing "\n" splits into ['## A.0 - X [Scope]', ''].
    // After the heading is consumed, contentLines is the single trailing '' element.
    const text =
      '---\n' +
      'id: u\n' +
      'docNo: A.0\n' +
      'name: X\n' +
      'type: Scope\n' +
      'depth: 1\n' +
      'childType: sections_and_primary_docs\n' +
      '---\n' +
      '\n' +
      '## A.0 - X [Scope]\n';
    const doc = parseDocumentMd(text, ['A', '0']);
    expect(doc.contentLines).toEqual(['']);
  });

  it('handles a doc with no body and no trailing newline', () => {
    // Heading + nothing else → contentLines is []
    const text =
      '---\n' +
      'id: u\n' +
      'docNo: A.0\n' +
      'name: X\n' +
      'type: Scope\n' +
      'depth: 1\n' +
      'childType: sections_and_primary_docs\n' +
      '---\n' +
      '\n' +
      '## A.0 - X [Scope]';
    const doc = parseDocumentMd(text, ['A', '0']);
    expect(doc.contentLines).toEqual([]);
  });

  it('handles frontmatter with truly no body section after fence', () => {
    // No heading at all after the fence — content is empty.
    const text =
      '---\n' +
      'id: u\n' +
      'docNo: A.0\n' +
      'name: X\n' +
      'type: Scope\n' +
      'depth: 1\n' +
      'childType: sections_and_primary_docs\n' +
      '---\n';
    const doc = parseDocumentMd(text, ['A', '0']);
    expect(doc.contentLines).toEqual([]);
  });

  it('throws on missing required frontmatter key', () => {
    const text = '---\nid: u\n---\n\n## X [Y]\n';
    expect(() => parseDocumentMd(text, ['A'])).toThrow(/missing required frontmatter key/);
  });

  it('skips frontmatter lines without colons', () => {
    const text =
      '---\n' +
      'id: u\n' +
      'invalidline\n' +
      'docNo: A.0\n' +
      'name: X\n' +
      'type: Scope\n' +
      'depth: 1\n' +
      'childType: sections_and_primary_docs\n' +
      '---\n' +
      '\n' +
      '## A.0 - X [Scope]\n';
    const doc = parseDocumentMd(text, ['A', '0']);
    expect(doc.docNo).toBe('A.0');
  });
});

// ---------------------------------------------------------------------------
// TestChildSortKey
// ---------------------------------------------------------------------------

describe('childSortKey', () => {
  function withTmpDir(fn: (dir: string) => void): void {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sortkey-test-'));
    try {
      fn(dir);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  function compareKeys(a: [number, number, string], b: [number, number, string]): number {
    if (a[0] !== b[0]) return a[0] - b[0];
    if (a[1] !== b[1]) return a[1] - b[1];
    if (a[2] < b[2]) return -1;
    if (a[2] > b[2]) return 1;
    return 0;
  }

  it('places real-doc siblings before phantom siblings', () => {
    withTmpDir((tmp) => {
      const parent = path.join(tmp, 'parent');
      fs.mkdirSync(path.join(parent, '1'), { recursive: true });
      fs.writeFileSync(path.join(parent, '1', 'document.md'), 'doc');
      fs.mkdirSync(path.join(parent, '0'));
      // "0" sorts AFTER "1" (real-doc-first rule), even though numerically smaller.
      const names = ['0', '1'].sort((a, b) => compareKeys(childSortKey(parent, a), childSortKey(parent, b)));
      expect(names).toEqual(['1', '0']);
    });
  });

  it('sorts real docs in numeric ascending order', () => {
    withTmpDir((tmp) => {
      const parent = path.join(tmp, 'p');
      for (const n of ['1', '2', '10']) {
        fs.mkdirSync(path.join(parent, n), { recursive: true });
        fs.writeFileSync(path.join(parent, n, 'document.md'), 'd');
      }
      // 10 must sort after 2 (numeric, not lexicographic).
      const names = ['10', '2', '1'].sort((a, b) => compareKeys(childSortKey(parent, a), childSortKey(parent, b)));
      expect(names).toEqual(['1', '2', '10']);
    });
  });

  it('sorts var1 into bucket 2 (after integers)', () => {
    withTmpDir((tmp) => {
      const parent = path.join(tmp, 'p');
      fs.mkdirSync(path.join(parent, '1'), { recursive: true });
      fs.writeFileSync(path.join(parent, '1', 'document.md'), 'd');
      fs.mkdirSync(path.join(parent, 'var1'));
      const names = ['var1', '1'].sort((a, b) => compareKeys(childSortKey(parent, a), childSortKey(parent, b)));
      expect(names).toEqual(['1', 'var1']);
    });
  });
});

// ---------------------------------------------------------------------------
// TestBuildHeadingLine
// ---------------------------------------------------------------------------

describe('buildHeadingLine', () => {
  function makeDoc(partial: Partial<ParsedDoc>): ParsedDoc {
    return {
      folderPath: ['A', '0'],
      uuid: 'u-1',
      docNo: 'A.0',
      name: 'X',
      docType: 'Scope',
      depth: 1,
      childType: 'sections_and_primary_docs',
      targets: [],
      contentLines: [],
      ...partial,
    };
  }

  it('builds h1 for a Scope', () => {
    const doc = makeDoc({ uuid: 'u-1', docNo: 'A.0', name: 'Atlas Preamble', docType: 'Scope' });
    expect(buildHeadingLine(doc, 1)).toBe('# A.0 - Atlas Preamble [Scope]  <!-- UUID: u-1 -->');
  });

  it('caps at h6', () => {
    const doc = makeDoc({ uuid: 'u-2', docNo: 'A.0.1.1.1.1.1', name: 'X', docType: 'Core', depth: 6 });
    expect(buildHeadingLine(doc, 6).startsWith('###### ')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TestUnquoteYamlName
// ---------------------------------------------------------------------------

describe('unquoteYamlName', () => {
  it('returns unquoted strings unchanged (after trim)', () => {
    expect(unquoteYamlName('Atlas Preamble')).toBe('Atlas Preamble');
  });

  it('unescapes a quoted string with escaped quotes', () => {
    expect(unquoteYamlName('"Defining \\"Severe Actions\\""')).toBe('Defining "Severe Actions"');
  });

  it('unescapes backslashes', () => {
    expect(unquoteYamlName('"a\\\\b"')).toBe('a\\b');
  });

  it('handles a string with only one quote (returns as-is after trim)', () => {
    expect(unquoteYamlName('"unbalanced')).toBe('"unbalanced');
  });
});

// ---------------------------------------------------------------------------
// TestParseTargetsValue
// ---------------------------------------------------------------------------

describe('parseTargetsValue', () => {
  it('parses a single-element list', () => {
    expect(parseTargetsValue('[abc]')).toEqual(['abc']);
  });

  it('parses a multi-element list', () => {
    expect(parseTargetsValue('[abc, def, ghi]')).toEqual(['abc', 'def', 'ghi']);
  });

  it('parses an empty list', () => {
    expect(parseTargetsValue('[]')).toEqual([]);
  });

  it('throws on a non-list value', () => {
    expect(() => parseTargetsValue('not a list')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Vendored fixture: small decomposed tree → expected composed monolith
// ---------------------------------------------------------------------------

describe('vendored fixture', () => {
  const fixtureRoot = path.join(__dirname, '..', '..', '..', 'tests', 'fixtures', 'atlas-content');
  const expectedPath = path.join(__dirname, '..', '..', '..', 'tests', 'fixtures', 'atlas-content-expected.md');

  it('composes the vendored small tree to the expected monolith', () => {
    if (!fs.existsSync(fixtureRoot) || !fs.existsSync(expectedPath)) {
      console.warn('vendored fixture missing — skipping (run scripts/regenerate-atlas-fixture.ts)');
      return;
    }
    const composed = compose(fixtureRoot);
    const expected = fs.readFileSync(expectedPath, 'utf8');
    expect(composed).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Live byte-identical roundtrip (gated)
// ---------------------------------------------------------------------------

describe('live byte-identical roundtrip', () => {
  const liveContentDir = process.env.TS_ATLAS_LIVE_CONTENT_DIR;
  const liveMonolithFile = process.env.TS_ATLAS_LIVE_MONOLITH;

  if (!liveContentDir || !liveMonolithFile) {
    it.skip('skipped (set TS_ATLAS_LIVE_CONTENT_DIR + TS_ATLAS_LIVE_MONOLITH to enable)', () => {});
    return;
  }

  it('compose against live atomic-atlas tree matches the post-#235 monolith byte-for-byte', () => {
    const composed = compose(liveContentDir);
    const expected = fs.readFileSync(liveMonolithFile, 'utf8');
    const composedSha = crypto.createHash('sha1').update(composed).digest('hex');
    const expectedSha = crypto.createHash('sha1').update(expected).digest('hex');
    expect(`${composed.length}/${composedSha}`).toBe(`${expected.length}/${expectedSha}`);
  });
});
