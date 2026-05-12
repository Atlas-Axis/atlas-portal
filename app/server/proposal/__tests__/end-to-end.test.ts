/**
 * End-to-end test against the REAL proposal artifact.
 *
 * Runs the full pipeline (find -> load -> Python scope_data) against
 * `proposal/2026-05-11` on the canonical Atlas repo (PR #242). This is
 * the real-artifact safety net that the synthetic unit tests cannot
 * replace: the synthetic shapes won't catch e.g. a regression in how we
 * resolve a fork's head repo, a mismatch between the convention this
 * code expects and the actual repo structure, or a broken Python
 * renderer subprocess.
 *
 * The test is intentionally a "happy-path" check — it asserts that the
 * pipeline produces non-empty summary + at least one scope with at least
 * one edited doc. It does NOT pin specific document UUIDs because the
 * proposal branch will evolve over time (rebases, additional edits). The
 * shape is the contract.
 *
 * Skipped automatically when `GITHUB_TOKEN` is not set so contributors
 * without local credentials don't get failing tests.
 */
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { findCurrentProposal } from '../find-current-proposal';
import { loadProposalData } from '../load-proposal-data';

const HAS_TOKEN = Boolean(process.env.GITHUB_TOKEN);
const describeIfTokenized = HAS_TOKEN ? describe : describe.skip;

describeIfTokenized('end-to-end against real proposal PR on sky-ecosystem/next-gen-atlas', () => {
  // Real network hits to GitHub + Python subprocess — generous timeout.
  it('finds a proposal/* PR and produces a non-empty summary + at least one scope', async () => {
    const proposal = await findCurrentProposal();
    expect(proposal, 'findCurrentProposal must return a proposal').not.toBeNull();
    expect(proposal!.headRef.startsWith('proposal/')).toBe(true);
    expect(proposal!.baseRepoOwner).toBe('sky-ecosystem');
    expect(proposal!.baseRepoName).toBe('next-gen-atlas');

    const data = await loadProposalData(proposal!);

    // Summary section: PR body should be present and non-empty.
    expect(data.summaryMarkdown.length).toBeGreaterThan(0);
    expect(data.summarySource).toBe('pr-body');

    // scope_data shape from the Python renderer.
    expect(data.scopeData).toBeDefined();
    expect(data.scopeData.title.length).toBeGreaterThan(0);
    expect(data.scopeData.stats.total).toBeGreaterThan(0);

    const scopeKeys = Object.keys(data.scopeData.scopes);
    expect(scopeKeys.length).toBeGreaterThan(0);

    // Every scope has a root node with the expected shape.
    for (const key of scopeKeys) {
      const scope = data.scopeData.scopes[key];
      expect(scope.label.length).toBeGreaterThan(0);
      expect(scope.root).toBeDefined();
      expect(scope.root.uuid.length).toBeGreaterThan(0);
    }

    // At least one document in any scope has a non-null status (the bug
    // we're guarding against: edited docs that rendered with no visible diff).
    const hasEditedDoc = scopeKeys.some((key) => {
      const scope = data.scopeData.scopes[key];
      function walk(n: { status: string | null; children: unknown[] }): boolean {
        if (n.status !== null) return true;
        for (const c of n.children) {
          if (walk(c as { status: string | null; children: unknown[] })) return true;
        }
        return false;
      }
      return walk(scope.root);
    });
    expect(hasEditedDoc, 'at least one doc in scope_data must carry a non-null status').toBe(true);
  }, 240_000);
});
