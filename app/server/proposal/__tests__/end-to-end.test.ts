/**
 * End-to-end test against the REAL proposal artifact.
 *
 * Runs the full pipeline (find -> load -> diff) against `proposal/2026-05-11`
 * on the canonical Atlas repo (PR #242). This is the real-artifact safety net
 * that the synthetic unit tests cannot replace: the synthetic shapes won't
 * catch e.g. a regression in how we resolve a fork's head repo, or a
 * mismatch between the convention this code expects and the actual repo
 * structure.
 *
 * The test is intentionally a "happy-path" check — it asserts that the
 * pipeline produces non-empty summary + at least one changed document. It
 * does NOT pin specific document UUIDs because the proposal branch will
 * evolve over time (rebases, additional edits). The shape is the
 * contract.
 *
 * Skipped automatically when `GITHUB_TOKEN` is not set so contributors
 * without local credentials don't get failing tests. In CI and local dev
 * with `gh auth` set up, this exercises the real artifact every run.
 */
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { findCurrentProposal } from '../find-current-proposal';
import { loadProposalData } from '../load-proposal-data';

const HAS_TOKEN = Boolean(process.env.GITHUB_TOKEN);
const describeIfTokenized = HAS_TOKEN ? describe : describe.skip;

describeIfTokenized('end-to-end against real proposal PR on sky-ecosystem/next-gen-atlas', () => {
  // Real network hits to GitHub — generous timeout.
  it('finds a proposal/* PR and produces a non-empty summary + at least one changed doc', async () => {
    const proposal = await findCurrentProposal();
    expect(proposal, 'findCurrentProposal must return a proposal').not.toBeNull();
    expect(proposal!.headRef.startsWith('proposal/')).toBe(true);
    expect(proposal!.baseRepoOwner).toBe('sky-ecosystem');
    expect(proposal!.baseRepoName).toBe('next-gen-atlas');

    const data = await loadProposalData(proposal!);

    // Summary section: PR body should be present and non-empty.
    expect(data.summaryMarkdown.length).toBeGreaterThan(0);
    expect(data.summarySource).toMatch(/^(pr-body|tree-file)$/);

    // Diff section: at least one changed document.
    expect(data.changes.length).toBeGreaterThan(0);

    // Every change carries enough metadata to render.
    for (const c of data.changes) {
      if (c.kind === 'added') {
        expect(c.current).toBeDefined();
        expect(c.current!.uuid.length).toBeGreaterThan(0);
      } else if (c.kind === 'removed') {
        expect(c.base).toBeDefined();
        expect(c.base!.uuid.length).toBeGreaterThan(0);
      } else {
        expect(c.current).toBeDefined();
        expect(c.base).toBeDefined();
        expect(c.current!.uuid).toBe(c.base!.uuid);
      }
    }
  }, 180_000);
});
