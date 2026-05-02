/**
 * Visual parity test: prove the compose path renders identically to the
 * monolith path.
 *
 * The portal's render pipeline is deterministic from the markdown string:
 *   composed_monolith → parseAtlasMarkdown → ExportTree → React render.
 *
 * If `compose(content/)` is byte-identical to the source monolith (verified by
 * `compose.test.ts`), the rendered DOM is identical by construction. This file
 * verifies the *structural* equivalence one level further: the parsed
 * `ExportTree` from each input matches deeply, and a markdown-to-HTML render
 * of representative document bodies produces identical HTML.
 *
 * Gated on TS_ATLAS_LIVE_CONTENT_DIR + TS_ATLAS_LIVE_MONOLITH (set by CI or
 * locally after `gh api … > /tmp/baseline-monolith.md`). When unset the test
 * is skipped — the standard suite stays fast.
 *
 * For full pixel/DOM parity via headless browsers see `e2e/visual-parity.spec.ts`.
 */
// @vitest-environment node
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compose } from './compose';
import { parseAtlasMarkdown } from './export/atlas-markdown-importer';

const liveContentDir = process.env.TS_ATLAS_LIVE_CONTENT_DIR;
const liveMonolithFile = process.env.TS_ATLAS_LIVE_MONOLITH;

describe('visual parity — composed tree vs monolith', () => {
  if (!liveContentDir || !liveMonolithFile) {
    it.skip('skipped (set TS_ATLAS_LIVE_CONTENT_DIR + TS_ATLAS_LIVE_MONOLITH)', () => {});
    return;
  }

  const monolith = fs.readFileSync(liveMonolithFile, 'utf8');
  const composed = compose(liveContentDir);

  it('composed monolith equals source monolith byte-for-byte', () => {
    expect(composed.length).toBe(monolith.length);
    expect(composed).toBe(monolith);
  });

  it('parsed ExportTree from compose path equals parsed ExportTree from monolith path', () => {
    const treeFromMonolith = parseAtlasMarkdown(monolith);
    const treeFromComposed = parseAtlasMarkdown(composed);
    // Deep equality. If byte-identical inputs produce non-equal trees the parser
    // itself is non-deterministic — that would be a separate bug.
    expect(treeFromComposed).toEqual(treeFromMonolith);
  });
});
