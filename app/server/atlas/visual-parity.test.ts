/**
 * Visual parity test: prove the compose path renders identically to the
 * monolith path — from EITHER Atlas layout.
 *
 * The portal's render pipeline is deterministic from the markdown string:
 *   composed_monolith → parseAtlasMarkdown → ExportTree → React render.
 *
 * If `loadComposed(content/)` is byte-identical to the source monolith (verified
 * by `compose.test.ts` and `atlas-source.test.ts` on the vendored fixtures), the
 * rendered DOM is identical by construction. This file verifies the *structural*
 * equivalence one level further against the LIVE Atlas: the parsed `ExportTree`
 * from each input matches deeply.
 *
 * Gates (each block skips when its env vars are unset, so the standard suite
 * stays fast):
 *   - TS_ATLAS_LIVE_CONTENT_DIR      + TS_ATLAS_LIVE_MONOLITH → atomized tree
 *   - TS_ATLAS_LIVE_CONSOLIDATED_DIR + TS_ATLAS_LIVE_MONOLITH → Option C tree
 *
 * Set both content-dir vars to also assert the two layouts agree with each other
 * — the assertion the de-atomization cutover actually rests on.
 *
 * ⛔ WIRING STATUS: these gates are NOT set in `.github/workflows/ci.yml`. Until
 * they are, this file contributes skipped tests only. See the coverage map in
 * `e2e/visual-parity.spec.ts` for what each layer needs.
 *
 * For full pixel/DOM parity via headless browsers see `e2e/visual-parity.spec.ts`.
 */
// @vitest-environment node
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadComposed } from './atlas-source';
import { parseAtlasMarkdown } from './export/atlas-markdown-importer';

const liveContentDir = process.env.TS_ATLAS_LIVE_CONTENT_DIR;
const liveConsolidatedDir = process.env.TS_ATLAS_LIVE_CONSOLIDATED_DIR;
const liveMonolithFile = process.env.TS_ATLAS_LIVE_MONOLITH;

describe('visual parity — atomized tree vs monolith', () => {
  if (!liveContentDir || !liveMonolithFile) {
    it.skip('skipped (set TS_ATLAS_LIVE_CONTENT_DIR + TS_ATLAS_LIVE_MONOLITH)', () => {});
    return;
  }

  const monolith = fs.readFileSync(liveMonolithFile, 'utf8');
  const composed = loadComposed(liveContentDir);

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

describe('visual parity — consolidated (Option C) tree vs monolith', () => {
  if (!liveConsolidatedDir || !liveMonolithFile) {
    it.skip('skipped (set TS_ATLAS_LIVE_CONSOLIDATED_DIR + TS_ATLAS_LIVE_MONOLITH)', () => {});
    return;
  }

  const monolith = fs.readFileSync(liveMonolithFile, 'utf8');
  const reassembled = loadComposed(liveConsolidatedDir);

  it('reassembled monolith equals source monolith byte-for-byte', () => {
    expect(reassembled.length).toBe(monolith.length);
    expect(reassembled).toBe(monolith);
  });

  it('parsed ExportTree from consolidated path equals parsed ExportTree from monolith path', () => {
    expect(parseAtlasMarkdown(reassembled)).toEqual(parseAtlasMarkdown(monolith));
  });
});

describe('visual parity — atomized vs consolidated', () => {
  if (!liveContentDir || !liveConsolidatedDir) {
    it.skip('skipped (set TS_ATLAS_LIVE_CONTENT_DIR + TS_ATLAS_LIVE_CONSOLIDATED_DIR)', () => {});
    return;
  }

  // The cutover assertion: sky-atlas.io must render identically on either side.
  // Everything downstream of this string is shared code, so byte equality here
  // is equality of the rendered page.
  it('both layouts compose to the identical monolith', () => {
    expect(loadComposed(liveConsolidatedDir)).toBe(loadComposed(liveContentDir));
  });

  it('both layouts parse to the identical ExportTree', () => {
    expect(parseAtlasMarkdown(loadComposed(liveConsolidatedDir))).toEqual(
      parseAtlasMarkdown(loadComposed(liveContentDir)),
    );
  });
});
