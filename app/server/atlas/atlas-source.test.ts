/**
 * Layer 1 of the visual-parity ladder, extended to the consolidated layout.
 *
 * `compose.test.ts` proves byte equality for the ATOMIZED vendored fixture. This
 * file proves the same byte equality for the CONSOLIDATED vendored fixture, and —
 * the load-bearing assertion for the cutover — that the two layouts produce the
 * *identical* monolith. Since the portal's render pipeline is deterministic from
 * that string (monolith → parseAtlasMarkdown → ExportTree → React), byte equality
 * between layouts means sky-atlas.io renders identically on either side of the
 * cutover, by construction.
 *
 * `tests/fixtures/atlas-content-consolidated/` was generated from
 * `tests/fixtures/atlas-content/` by the reference `sync/partition.py` on the
 * Atlas repo's `infra/option-c-split-composer` branch — not hand-written — so the
 * fixture cannot drift from what the real split tool emits.
 */
// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ATOMIZED,
  CONSOLIDATED,
  LayoutError,
  bucketFromFilename,
  compareBuckets,
  detectLayout,
  loadComposed,
  orderKey,
  reassemble,
  resolveAtlasRoot,
} from './atlas-source';
import { compose } from './compose';

const FIXTURE_DIR = path.join(__dirname, '..', '..', '..', 'tests', 'fixtures');
const ATOMIZED_FIXTURE = path.join(FIXTURE_DIR, 'atlas-content');
const CONSOLIDATED_FIXTURE = path.join(FIXTURE_DIR, 'atlas-content-consolidated');
const EXPECTED_MONOLITH = path.join(FIXTURE_DIR, 'atlas-content-expected.md');

function withTmpDir(fn: (dir: string) => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-source-test-'));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Layout detection
// ---------------------------------------------------------------------------

describe('detectLayout', () => {
  it('classifies the vendored atomized fixture', () => {
    expect(detectLayout(ATOMIZED_FIXTURE)).toBe(ATOMIZED);
  });

  it('classifies the vendored consolidated fixture', () => {
    expect(detectLayout(CONSOLIDATED_FIXTURE)).toBe(CONSOLIDATED);
  });

  it('throws on a directory matching NEITHER layout rather than composing empty', () => {
    withTmpDir((dir) => {
      // The regression this guards: an empty walk used to return '' and be read
      // downstream as "pre-cutover ref", making a truncated checkout and a valid
      // old ref indistinguishable.
      expect(() => detectLayout(dir)).toThrow(LayoutError);
      expect(() => detectLayout(dir)).toThrow(/matches neither Atlas layout/);
    });
  });

  it('throws on a directory matching BOTH layouts (half-finished migration)', () => {
    withTmpDir((dir) => {
      fs.mkdirSync(path.join(dir, 'A', '0'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'A', '0', 'document.md'), 'x');
      fs.writeFileSync(path.join(dir, 'A.0 - Atlas-Preamble.md'), 'x');
      expect(() => detectLayout(dir)).toThrow(/BOTH consolidated Atlas files and an atomized/);
    });
  });

  it('throws when the path is not a directory', () => {
    expect(() => detectLayout(EXPECTED_MONOLITH)).toThrow(/is not a directory/);
    expect(() => detectLayout(path.join(FIXTURE_DIR, 'does-not-exist'))).toThrow(/is not a directory/);
  });

  it('ignores non-bucket .md files at the root', () => {
    withTmpDir((dir) => {
      fs.writeFileSync(path.join(dir, 'README.md'), 'x');
      fs.writeFileSync(path.join(dir, '_index.md'), 'x');
      expect(() => detectLayout(dir)).toThrow(/matches neither Atlas layout/);
    });
  });
});

// ---------------------------------------------------------------------------
// Byte equality across both layouts — the parity assertion
// ---------------------------------------------------------------------------

describe('loadComposed — byte parity across layouts', () => {
  const expected = fs.readFileSync(EXPECTED_MONOLITH, 'utf8');

  it('composes the atomized fixture to the expected monolith', () => {
    expect(loadComposed(ATOMIZED_FIXTURE)).toBe(expected);
  });

  it('composes the consolidated fixture to the expected monolith', () => {
    expect(loadComposed(CONSOLIDATED_FIXTURE)).toBe(expected);
  });

  it('produces byte-identical output from both layouts', () => {
    expect(loadComposed(CONSOLIDATED_FIXTURE)).toBe(compose(ATOMIZED_FIXTURE));
  });

  it('resolves a repo root that nests the Atlas under content/, in either layout', () => {
    for (const fixture of [ATOMIZED_FIXTURE, CONSOLIDATED_FIXTURE]) {
      withTmpDir((dir) => {
        fs.cpSync(fixture, path.join(dir, 'content'), { recursive: true });
        expect(resolveAtlasRoot(dir)).toBe(path.join(dir, 'content'));
        expect(loadComposed(resolveAtlasRoot(dir))).toBe(expected);
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Bucket filenames
// ---------------------------------------------------------------------------

describe('bucketFromFilename', () => {
  it('recovers the doc number from a bucket filename', () => {
    expect(bucketFromFilename('A.0 - Atlas-Preamble.md')).toBe('A.0');
    expect(bucketFromFilename('A.6.1.1.1 - Spark.md')).toBe('A.6.1.1.1');
    expect(bucketFromFilename('A.6.1.2 - List-Of-Executor-Artifacts.md')).toBe('A.6.1.2');
  });

  it('rejects files that are not buckets', () => {
    expect(bucketFromFilename('_index.md')).toBeNull();
    expect(bucketFromFilename('README.md')).toBeNull();
    expect(bucketFromFilename('document.md')).toBeNull();
    expect(bucketFromFilename('A.0 - Atlas-Preamble.txt')).toBeNull();
    expect(bucketFromFilename('B.0 - Not-The-Atlas.md')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Bucket ORDER — the silent-reordering hazard
// ---------------------------------------------------------------------------

describe('bucket order', () => {
  it('orders by integer segments, not by filename', () => {
    // ⛔ THE REGRESSION THIS EXISTS FOR. Lexicographically `A.6.1.1.10` sorts
    // between `.1` and `.2`. Sky expects to keep onboarding Stars, so the tenth
    // agent artifact would silently reorder ~2,000 documents with no error
    // raised anywhere if bucket order ever became a filename sort.
    const buckets = ['A.6.1.1.10', 'A.6.1.1.2', 'A.6.1.1.1', 'A.6.1.2', 'A.6.1.1.9'];
    expect([...buckets].sort(compareBuckets)).toEqual(['A.6.1.1.1', 'A.6.1.1.2', 'A.6.1.1.9', 'A.6.1.1.10', 'A.6.1.2']);
    // The naive alternative gets it wrong — asserted so the difference is not
    // theoretical.
    expect([...buckets].sort()).not.toEqual([...buckets].sort(compareBuckets));
  });

  it('sorts a prefix before its extensions', () => {
    const buckets = ['A.6.1.1.1', 'A.6', 'A.6.1', 'A.6.1.1'];
    expect([...buckets].sort(compareBuckets)).toEqual(['A.6', 'A.6.1', 'A.6.1.1', 'A.6.1.1.1']);
  });

  it('orders the full 16-bucket Option C partition', () => {
    const buckets = [
      'A.0',
      'A.1',
      'A.2',
      'A.3',
      'A.4',
      'A.5',
      'A.6',
      'A.6.1.1.1',
      'A.6.1.1.2',
      'A.6.1.1.3',
      'A.6.1.1.4',
      'A.6.1.1.5',
      'A.6.1.1.6',
      'A.6.1.1.7',
      'A.6.1.1.8',
      'A.6.1.2',
    ];
    expect([...buckets].reverse().sort(compareBuckets)).toEqual(buckets);
  });

  it('derives the order key as an integer tuple', () => {
    expect(orderKey('A.6.1.1.10')).toEqual([6, 1, 1, 10]);
    expect(orderKey('A.0')).toEqual([0]);
  });
});

// ---------------------------------------------------------------------------
// Reassembly failure modes
// ---------------------------------------------------------------------------

describe('reassemble', () => {
  it('throws when two files claim the same bucket', () => {
    withTmpDir((dir) => {
      fs.writeFileSync(path.join(dir, 'A.0 - Atlas-Preamble.md'), 'x');
      fs.writeFileSync(path.join(dir, 'A.0 - Atlas-Preamble-Copy.md'), 'x');
      expect(() => reassemble(dir)).toThrow(/two files claim bucket/);
    });
  });

  it('throws when there are no bucket files at all', () => {
    withTmpDir((dir) => {
      expect(() => reassemble(dir)).toThrow(/no Atlas bucket files found/);
    });
  });

  it('orders by document, not by bucket — a later bucket can hold an earlier document', () => {
    // The regression this guards: A.6.1.2 lives in the A.6 bucket while the Prime
    // Agents A.6.1.1.x are their own buckets and belong BETWEEN A.6.1.1 and A.6.1.2.
    // Concatenating whole files in bucket order emitted A.6.1.2 first, and the
    // importer then attached every Prime Agent to A.6.1 instead of A.6.1.1.
    withTmpDir((dir) => {
      const h = (n: string, name: string, type: string, uuid: string) =>
        `# ${n} - ${name} [${type}]  <!-- UUID: ${uuid} -->`;
      fs.writeFileSync(
        path.join(dir, 'A.6 - Agents.md'),
        [
          h('A.6', 'The Agent Scope', 'Scope', '00000000-0000-4000-8000-000000000006'),
          h('A.6.1', 'Agent Artifacts', 'Article', '00000000-0000-4000-8000-000000000061'),
          h('A.6.1.1', 'List Of Prime Agent Artifacts', 'Section', '00000000-0000-4000-8000-000000000611'),
          h('A.6.1.2', 'List Of Executor Agent Artifacts', 'Section', '00000000-0000-4000-8000-000000000612'),
        ].join('\n'),
      );
      fs.writeFileSync(
        path.join(dir, 'A.6.1.1.2 - Second.md'),
        h('A.6.1.1.2', 'Second', 'Section', '00000000-0000-4000-8000-000000006112'),
      );
      fs.writeFileSync(
        path.join(dir, 'A.6.1.1.10 - Tenth.md'),
        h('A.6.1.1.10', 'Tenth', 'Section', '00000000-0000-4000-8000-000000061110'),
      );

      const docNos = reassemble(dir)
        .split('\n')
        .map((l) => /^#+\s+(\S+)\s+-\s+/.exec(l)?.[1])
        .filter((x): x is string => Boolean(x));

      // 10 after 2 (numeric, not lexicographic), and both BEFORE A.6.1.2.
      expect(docNos).toEqual([
        'A.6', 'A.6.1', 'A.6.1.1', 'A.6.1.1.2', 'A.6.1.1.10', 'A.6.1.2',
      ]);
    });
  });
});

// ---------------------------------------------------------------------------
// Consolidated fixture shape (guards the fixture itself)
// ---------------------------------------------------------------------------

describe('vendored consolidated fixture', () => {
  it('is a flat directory of bucket files only', () => {
    const entries = fs.readdirSync(CONSOLIDATED_FIXTURE, { withFileTypes: true });
    expect(entries.every((e) => e.isFile())).toBe(true);
    // A.6 + A.6.1.1.1 are deliberately present: without a bucket whose root sits below
    // absolute depth 1, the fixture cannot exercise file-relative heading levels, and
    // without a document that belongs between two other buckets it cannot exercise
    // document ordering. With only A.0/A.1 this suite passed against broken code.
    expect(entries.map((e) => e.name).sort()).toEqual([
      'A.0 - Atlas-Preamble.md',
      'A.1 - Foundational-Principles.md',
      'A.6 - The-Agent-Scope.md',
      'A.6.1.1.1 - Spark.md',
    ]);
  });

  it('carries no _index.md files — Option C retires them entirely', () => {
    expect(fs.readdirSync(CONSOLIDATED_FIXTURE)).not.toContain('_index.md');
  });

  it('is classified as CONSOLIDATED, not as an unrecognised layout', () => {
    expect(detectLayout(CONSOLIDATED_FIXTURE)).toBe(CONSOLIDATED);
    expect(detectLayout(CONSOLIDATED_FIXTURE)).not.toBe(ATOMIZED);
  });
});
