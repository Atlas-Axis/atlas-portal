/**
 * Load proposal data: fetch base + head tarballs, then call the Python
 * renderer to produce scope_data JSON for the /proposal page.
 *
 * The base ref is fetched from the upstream Atlas repo (`sky-ecosystem/next-gen-atlas`);
 * the head ref is fetched from the head repo (may be a fork) at the PR's head SHA.
 *
 * Both tarballs are extracted, then passed to the Python scope_data builder
 * (scripts/renderer/atlas_preview/) which owns parsing, diff, scope detection,
 * and per-document diff HTML generation. The TypeScript layer (this file +
 * the page component) handles presentation only.
 *
 * Tarballs are fetched fresh for every build of `/proposal`. There is no
 * SHA cache here (unlike `load-atlas-tree-from-github`) because each build
 * only needs two tarballs (base, head) and re-running the load against the
 * same SHAs would be a no-op anyway during a single `next build`.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import * as tar from 'tar';
import { ATLAS_REPO_NAME, ATLAS_REPO_OWNER } from '../atlas/constants';
import type { ProposalRef } from './find-current-proposal';
import { generateScopeData } from './generate-scope-data';
import type { ScopeData } from './scope-data';

export interface ProposalData {
  /** The PR metadata. */
  proposal: ProposalRef;
  /** Pre-computed scope_data from the Python renderer. */
  scopeData: ScopeData;
  /**
   * Summary markdown — from the PR body, or empty string if the body is empty.
   * Always a string (possibly empty) so callers can render unconditionally.
   */
  summaryMarkdown: string;
  /** Where the summary came from. */
  summarySource: 'pr-body' | 'none';
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
 * Download `repos/{owner}/{repo}/tarball/{ref}` and extract to a fresh temp
 * directory. Returns the absolute path to the extracted top-level folder
 * (which contains the repo contents, NOT the wrapping `{owner}-{repo}-{sha}`
 * folder GitHub introduces).
 */
async function downloadAndExtractTarball(owner: string, repo: string, ref: string): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}/tarball/${ref}`;
  const res = await fetch(url, {
    headers: githubAuthHeaders(),
    cache: 'no-store',
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch tarball ${owner}/${repo}@${ref}: ${res.status} ${res.statusText}`);
  }
  if (res.body === null) {
    throw new Error(`Tarball response had no body for ${owner}/${repo}@${ref}`);
  }

  const extractRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'atlas-proposal-tarball-'));
  const nodeStream = Readable.fromWeb(res.body as never);
  await pipeline(nodeStream, createGunzip(), tar.extract({ cwd: extractRoot }));

  const entries = await fsp.readdir(extractRoot, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());
  if (dirs.length !== 1) {
    throw new Error(
      `Expected exactly one top-level folder inside extracted tarball for ${owner}/${repo}@${ref}, found ${dirs.length}`,
    );
  }
  return path.join(extractRoot, dirs[0].name);
}

/**
 * Load proposal data for the given proposal reference.
 *
 * Downloads two tarballs (base and head), passes the `content/` directories
 * to the Python renderer for scope_data computation, returns the JSON +
 * summary metadata.
 *
 * This is build-time-only — caller is the `/proposal` route which is
 * `dynamic = 'force-static'` + `revalidate = false`.
 */
export async function loadProposalData(proposal: ProposalRef): Promise<ProposalData> {
  const [baseRoot, headRoot] = await Promise.all([
    downloadAndExtractTarball(proposal.baseRepoOwner, proposal.baseRepoName, proposal.baseRef),
    downloadAndExtractTarball(proposal.headRepoOwner, proposal.headRepoName, proposal.headSha),
  ]);

  try {
    const baseContentDir = path.join(baseRoot, 'content');
    const headContentDir = path.join(headRoot, 'content');
    if (!fs.existsSync(baseContentDir)) {
      throw new Error(`Base tarball does not contain content/ at ${baseContentDir}`);
    }
    if (!fs.existsSync(headContentDir)) {
      throw new Error(`Head tarball does not contain content/ at ${headContentDir}`);
    }

    const scopeData = await generateScopeData({
      baseContentDir,
      headContentDir,
      branch: proposal.headRef,
      baseRef: proposal.baseRef,
      // The renderer's `repo` field is informational only — we surface the
      // public repo identifier so the field is suitable for public display.
      repo: `${ATLAS_REPO_OWNER}/${ATLAS_REPO_NAME}`,
      prNumber: proposal.prNumber,
      prTitle: proposal.title,
    });

    // Summary source: the PR body.
    const summaryMarkdown = proposal.body.trim();
    const summarySource: ProposalData['summarySource'] = summaryMarkdown ? 'pr-body' : 'none';

    return {
      proposal,
      scopeData,
      summaryMarkdown,
      summarySource,
    };
  } finally {
    // Best-effort cleanup of temp dirs.
    for (const root of [baseRoot, headRoot]) {
      try {
        await fsp.rm(path.dirname(root), { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }
}
