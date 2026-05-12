/**
 * Find the "current" Atlas Edit Proposal on the canonical Atlas repo.
 *
 * Lookup order:
 *   1. Open PRs against `sky-ecosystem/next-gen-atlas` whose head ref starts with
 *      `proposal/`. If multiple are open, pick the most recently updated.
 *   2. Otherwise, the most recently merged PR with a `proposal/` head ref.
 *
 * The PR's head may live on a fork. We return both `headRepoOwner` and
 * `headRepoName` so the loader can fetch the tarball from the correct repo.
 */
import { ATLAS_REPO_NAME, ATLAS_REPO_OWNER } from '../atlas/constants';

export interface ProposalRef {
  /** PR number on the upstream repo. */
  prNumber: number;
  /** PR title. */
  title: string;
  /** PR body (markdown — used as the summary source). */
  body: string;
  /** Base ref name (typically "main"). */
  baseRef: string;
  /** Head ref name (e.g. "proposal/2026-05-11"). */
  headRef: string;
  /** Head commit SHA — used as the cache key when loading proposal data. */
  headSha: string;
  /** Owner of the repo where the head branch lives (may be a fork). */
  headRepoOwner: string;
  /** Name of the repo where the head branch lives. */
  headRepoName: string;
  /** Owner of the base repo (always `sky-ecosystem`). */
  baseRepoOwner: string;
  /** Name of the base repo (always `next-gen-atlas`). */
  baseRepoName: string;
  /** PR last-updated timestamp (ISO 8601). */
  updatedAt: string;
  /** PR merge timestamp (ISO 8601), if merged. */
  mergedAt: string | null;
}

interface RestPullRequest {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  merged_at: string | null;
  updated_at: string;
  base: {
    ref: string;
    repo: { name: string; owner: { login: string } };
  };
  head: {
    ref: string;
    sha: string;
    repo: { name: string; owner: { login: string } } | null;
  };
}

function githubAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'atlas-portal',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `token ${token}`;
  }
  return headers;
}

/**
 * Fetch up to `perPage` PRs from the canonical Atlas repo for the given state.
 * `state` is the GitHub REST API value: 'open', 'closed', or 'all'.
 */
async function listPullRequests(state: 'open' | 'closed', perPage = 50): Promise<RestPullRequest[]> {
  const url =
    `https://api.github.com/repos/${ATLAS_REPO_OWNER}/${ATLAS_REPO_NAME}/pulls` +
    `?state=${state}&per_page=${perPage}&sort=updated&direction=desc`;
  const res = await fetch(url, {
    headers: githubAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Failed to list ${state} PRs: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as RestPullRequest[];
}

function toProposalRef(pr: RestPullRequest): ProposalRef {
  // The head repo can be null when a fork is deleted; reject those — we can't
  // fetch a tarball from a missing repo.
  if (!pr.head.repo) {
    throw new Error(`PR #${pr.number} head repo is null (fork likely deleted)`);
  }
  return {
    prNumber: pr.number,
    title: pr.title,
    body: pr.body ?? '',
    baseRef: pr.base.ref,
    headRef: pr.head.ref,
    headSha: pr.head.sha,
    headRepoOwner: pr.head.repo.owner.login,
    headRepoName: pr.head.repo.name,
    baseRepoOwner: pr.base.repo.owner.login,
    baseRepoName: pr.base.repo.name,
    updatedAt: pr.updated_at,
    mergedAt: pr.merged_at,
  };
}

/**
 * Find the current Atlas Edit Proposal.
 *
 * Returns `null` if no proposal/* PR exists in either open or recently-merged
 * state on the canonical repo. Callers (the `/proposal` route) should render
 * a "no current proposal" placeholder in that case rather than failing the
 * build.
 */
export async function findCurrentProposal(): Promise<ProposalRef | null> {
  // Step 1: scan open PRs for proposal/* head refs. Pick the most recently
  // updated (the REST list is already sorted by updated desc).
  const open = await listPullRequests('open');
  const openProposals = open.filter((pr) => pr.head.ref.startsWith('proposal/') && pr.head.repo !== null);
  if (openProposals.length > 0) {
    return toProposalRef(openProposals[0]);
  }

  // Step 2: scan closed PRs and pick the most recently merged proposal/*.
  // `state=closed` includes both merged and unmerged-closed PRs; filter to
  // merged ones with the proposal/ prefix.
  const closed = await listPullRequests('closed');
  const mergedProposals = closed
    .filter((pr) => pr.merged_at !== null && pr.head.ref.startsWith('proposal/') && pr.head.repo !== null)
    .sort((a, b) => {
      // Both have merged_at by construction.
      return new Date(b.merged_at as string).getTime() - new Date(a.merged_at as string).getTime();
    });
  if (mergedProposals.length > 0) {
    return toProposalRef(mergedProposals[0]);
  }

  return null;
}
