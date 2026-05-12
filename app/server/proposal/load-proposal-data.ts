/**
 * Load proposal data: fetch base + head tarballs, parse atoms, detect changes.
 *
 * The base ref is fetched from the upstream Atlas repo (`sky-ecosystem/next-gen-atlas`),
 * specifically the SHA of the PR's base ref at the moment the PR was opened
 * (we use `origin/main`'s current tip as a practical approximation — it's
 * what the PR would merge against today). The head ref is fetched from the
 * head repo (typically a fork) at the PR's head SHA.
 *
 * Both tarballs are extracted and walked with `findAllDocuments`, producing
 * UUID-keyed ParsedDoc lists. The atom-tree-diff module then produces the
 * change list rendered by the page component.
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
import { type ParsedDoc, findAllDocuments } from '../atlas/compose';
import { type DocChange, detectAtomTreeChanges } from './atom-tree-diff';
import type { ProposalRef } from './find-current-proposal';

export interface ProposalData {
  /** The PR metadata. */
  proposal: ProposalRef;
  /** Detected changes between base and head atom-trees, in stable order. */
  changes: DocChange[];
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
 * Downloads two tarballs (base and head), walks each `content/` tree, runs
 * the atom-tree diff, and resolves the summary source.
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

    const baseDocs: ParsedDoc[] = findAllDocuments(baseContentDir);
    const headDocs: ParsedDoc[] = findAllDocuments(headContentDir);

    if (baseDocs.length < 1) {
      throw new Error(`Base tarball produced 0 parsed docs — extraction likely failed`);
    }
    if (headDocs.length < 1) {
      throw new Error(`Head tarball produced 0 parsed docs — extraction likely failed`);
    }

    const changes = detectAtomTreeChanges(baseDocs, headDocs);

    // Summary source: the PR body.
    const summaryMarkdown = proposal.body.trim();
    const summarySource: ProposalData['summarySource'] = summaryMarkdown ? 'pr-body' : 'none';

    return {
      proposal,
      changes,
      summaryMarkdown,
      summarySource,
    };
  } finally {
    // Best-effort cleanup of temp dirs. The parents of baseRoot/headRoot are
    // the mkdtemp roots — go up one level to remove the whole tree.
    for (const root of [baseRoot, headRoot]) {
      try {
        await fsp.rm(path.dirname(root), { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }
}
