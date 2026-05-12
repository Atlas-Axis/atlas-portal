// @vitest-environment node
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateScopeData } from '../generate-scope-data';

const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'atlas-content');

/**
 * Smoke test for the Python renderer subprocess bridge.
 *
 * Builds a synthetic head version by copying the fixture and editing one
 * document, then runs the bridge. Verifies the JSON shape and that the
 * edited document carries a non-null status — the core regression we're
 * guarding against from the v2 attempt.
 */
describe('generateScopeData', () => {
  let tmpRoot: string;
  let headContentDir: string;

  beforeAll(async () => {
    tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'atlas-portal-generate-test-'));
    headContentDir = path.join(tmpRoot, 'head', 'content');
    // Copy fixture into a writable temp dir.
    await fsp.cp(FIXTURES_DIR, headContentDir, { recursive: true });

    // Edit one document.md to introduce a substantive body change.
    const target = path.join(headContentDir, 'A', '0', '1', 'document.md');
    const original = await fsp.readFile(target, 'utf-8');
    const edited = original.replace(
      'This Article contains definitions.',
      'This Article contains definitions and additional foundational terms.',
    );
    if (edited === original) {
      throw new Error('Fixture sentinel string not found — fixture may have drifted');
    }
    await fsp.writeFile(target, edited);
  });

  afterAll(async () => {
    if (tmpRoot) {
      await fsp.rm(tmpRoot, { recursive: true, force: true });
    }
  });

  it('produces scope_data with at least one Edited doc and visible diff highlights', async () => {
    const scopeData = await generateScopeData({
      baseContentDir: FIXTURES_DIR,
      headContentDir,
      branch: 'proposal/test',
      baseRef: 'main',
      repo: 'sky-ecosystem/next-gen-atlas',
      prNumber: 999,
      prTitle: 'Test proposal',
    });

    expect(scopeData.title).toBe('Test proposal');
    expect(scopeData.repo).toBe('sky-ecosystem/next-gen-atlas');
    expect(scopeData.stats.modified).toBeGreaterThanOrEqual(1);
    expect(Object.keys(scopeData.scopes).length).toBeGreaterThanOrEqual(1);

    // Walk every scope root looking for the edited doc.
    const allNodes: Array<{ status: string | null; compareHtml: string }> = [];
    function collect(node: { status: string | null; compareHtml: string; children: unknown[] }): void {
      allNodes.push({ status: node.status, compareHtml: node.compareHtml });
      for (const c of node.children) {
        collect(c as Parameters<typeof collect>[0]);
      }
    }
    for (const scope of Object.values(scopeData.scopes)) {
      collect(scope.root as Parameters<typeof collect>[0]);
    }
    const editedNodes = allNodes.filter((n) => n.status === 'Edited');
    expect(editedNodes.length, 'should have at least one Edited node').toBeGreaterThanOrEqual(1);

    // The bug we are guarding against: an Edited doc whose compareHtml
    // is identical to its finalHtml (no diff highlights).
    const anyWithDiff = editedNodes.some(
      (n) => n.compareHtml.includes('diff-add') || n.compareHtml.includes('diff-del'),
    );
    expect(anyWithDiff, 'at least one Edited node must contain diff highlights').toBe(true);
  }, 60_000);
});
