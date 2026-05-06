/**
 * Tarball+compose loader for the Atlas content tree.
 *
 * Replaces the older direct-fetch of `Sky Atlas/Sky Atlas.md`. After the
 * Atomic Atlas cutover (sky-ecosystem/next-gen-atlas#236), the monolith file
 * no longer exists in the repo — instead, each document lives at
 * `content/<doc-no>/document.md` and the portal composes them back together
 * server-side.
 *
 * Flow:
 *   1. GET /repos/{owner}/{repo}/commits/{branch} → latest commit SHA + date.
 *   2. If SHA matches the last cached compose, return the cached monolith.
 *   3. Otherwise: GET /repos/{owner}/{repo}/tarball/{branch} → extract to /tmp.
 *   4. Walk extracted content/ directory and run TS compose.
 *   5. Cache the composed result keyed by SHA.
 *
 * Public API surface preserved (so the rest of the portal — atlas-json-exporter,
 * load-atlas-portal-data, and the truncated-atlas script — doesn't change):
 *   - fetchAtlasMarkdownContent(): Promise<string>
 *   - fetchAtlasMarkdownMetadata(): Promise<{ lastModified, commitSha, commitMessage }>
 *   - loadAtlasMarkdownFromGitHub(): Promise<AtlasMarkdownFromGitHub>
 *   - loadAtlasMarkdownForSync(): Promise<string>  (dev fallback uses fixture)
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import * as tar from 'tar';
import { compose } from './compose';
import { ATLAS_REPO_BRANCH, ATLAS_REPO_COMMITS_URL, ATLAS_REPO_TARBALL_URL } from './constants';

export interface AtlasMarkdownFromGitHub {
  /** The composed markdown content (Sky Atlas monolith). */
  content: string;
  /** The last modified date of the canonical branch (latest commit date). */
  lastModified: Date;
  /** The SHA of the latest commit on the canonical branch. */
  commitSha: string;
  /** The commit message of the latest commit. */
  commitMessage: string;
}

interface AtlasCommitMetadata {
  lastModified: Date;
  commitSha: string;
  commitMessage: string;
}

interface GitHubCommitResponse {
  sha: string;
  commit: {
    message: string;
    committer: { date: string };
  };
}

// ---------------------------------------------------------------------------
// In-memory SHA-keyed compose cache
//
// Persists across requests within a single Vercel/Node process. Combined with
// the page-level revalidate=3600 and Next.js fetch-cache (which we ALSO opt
// into via { next: { revalidate: 3600 } } on each fetch), this gives us a
// two-tier cache: Next data cache short-circuits most fetches, and when fetch
// IS made, this in-process cache short-circuits the tarball download +
// extract + compose work for any SHA we've already composed.
// ---------------------------------------------------------------------------

interface CacheEntry {
  sha: string;
  content: string;
  metadata: AtlasCommitMetadata;
}

let composeCache: CacheEntry | null = null;

/** For tests: clear the in-memory compose cache. */
export function _clearAtlasComposeCache(): void {
  composeCache = null;
}

// ---------------------------------------------------------------------------
// GitHub API: latest commit metadata
// ---------------------------------------------------------------------------

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
 * Fetch the latest commit on the canonical branch.
 *
 * Uses Next.js fetch caching with revalidate=3600 (matches page-level ISR
 * window — Adam's directive: "keep it as is because a change only takes place
 * once a week generally").
 */
async function fetchLatestCommitMetadata(): Promise<AtlasCommitMetadata> {
  const response = await fetch(ATLAS_REPO_COMMITS_URL, {
    headers: githubAuthHeaders(),
    next: { revalidate: 3600 },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch latest commit metadata from GitHub: ${response.status} ${response.statusText}`);
  }
  const commit = (await response.json()) as GitHubCommitResponse;
  if (!commit || !commit.sha) {
    throw new Error('GitHub /commits response missing sha');
  }
  return {
    lastModified: new Date(commit.commit.committer.date),
    commitSha: commit.sha,
    commitMessage: commit.commit.message,
  };
}

// ---------------------------------------------------------------------------
// Tarball: download → extract → locate content/
// ---------------------------------------------------------------------------

/**
 * Download the repo tarball for the canonical branch and extract into a
 * fresh temp directory. Returns the absolute path to the extracted root.
 *
 * GitHub tarballs unpack into a single top-level folder named
 * `{owner}-{repo}-{shortsha}/`. The caller must locate `content/` inside.
 */
async function downloadAndExtractTarball(): Promise<string> {
  // Note: NOT using Next.js `next: { revalidate }` here. Next's data cache
  // rejects items >2MB and the Atlas tarball is currently ~13MB. The
  // in-memory SHA cache (above) handles invalidation; the tarball is only
  // re-fetched when the upstream commit SHA actually changes.
  const response = await fetch(ATLAS_REPO_TARBALL_URL, {
    headers: githubAuthHeaders(),
    cache: 'no-store',
    // Follow GitHub's 302 redirect to codeload automatically (default for fetch).
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch repo tarball from GitHub: ${response.status} ${response.statusText}`);
  }
  if (response.body === null) {
    throw new Error('GitHub tarball response had no body');
  }

  // Use a per-call temp dir so concurrent extractions don't clobber each other.
  // Vercel's serverless filesystem allows writes under /tmp.
  const dest = await fsp.mkdtemp(path.join(os.tmpdir(), 'atlas-tarball-'));

  // Stream the gzipped tar through gunzip into tar.extract.
  const nodeStream = Readable.fromWeb(response.body as never);
  await pipeline(nodeStream, createGunzip(), tar.extract({ cwd: dest }));

  return dest;
}

/**
 * Find the extracted top-level repo folder inside `extractRoot`.
 * GitHub tarballs unpack to exactly one top-level folder.
 */
async function findExtractedRepoRoot(extractRoot: string): Promise<string> {
  const entries = await fsp.readdir(extractRoot, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory());
  if (dirs.length !== 1) {
    throw new Error(
      `Expected exactly one top-level folder inside extracted tarball, found ${dirs.length}: ` +
        `${dirs.map((d) => d.name).join(', ')}`,
    );
  }
  return path.join(extractRoot, dirs[0].name);
}

/**
 * Sanity floor: catch the empty/near-empty case where compose returns 0 or
 * near-0 bytes (e.g., truncated tarball, partial extract). Without this
 * guard, an empty value can be cached and served indefinitely. Threshold of
 * 100 bytes catches that without breaking tests that use small fixture
 * tarballs.
 *
 * (For production, the live Atlas is ~3.4 MB; the rawTotal check in
 * validateCompleteness catches the partial-fetch case at the doc-count
 * level too.)
 */
const COMPOSE_OUTPUT_MIN_BYTES = 100;

/** Sanity floor: at least 1 atom file must be present (catches empty extract). */
const CONTENT_DIR_MIN_FILES = 1;

/**
 * Recursively count `document.md` files under a directory.
 * Used as a sanity check post-extraction.
 */
function countDocumentMdFiles(dir: string): number {
  let count = 0;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (entry.isFile() && entry.name === 'document.md') {
      count += 1;
    } else if (entry.isDirectory()) {
      count += countDocumentMdFiles(path.join(dir, entry.name));
    }
  }
  return count;
}

/**
 * Compose the Atlas monolith by downloading the latest tarball and walking
 * its `content/` tree.
 *
 * Includes sanity checks at each stage. If any returns an unexpectedly small
 * result, throws — preventing the in-memory cache from being poisoned with
 * a partial/empty value.
 */
async function composeFromTarball(): Promise<string> {
  const extractRoot = await downloadAndExtractTarball();
  try {
    const repoRoot = await findExtractedRepoRoot(extractRoot);
    const contentDir = path.join(repoRoot, 'content');
    if (!fs.existsSync(contentDir)) {
      throw new Error(`Extracted tarball does not contain content/ at ${contentDir}`);
    }

    // Sanity: count atom files BEFORE compose. If extraction was partial,
    // we want to know that here, not after the empty compose result poisons
    // the cache.
    const atomCount = countDocumentMdFiles(contentDir);
    console.log(`[loadAtlasTree] extracted ${atomCount} document.md files from tarball`);
    if (atomCount < CONTENT_DIR_MIN_FILES) {
      throw new Error(
        `Atlas content extraction sanity-check failed: only ${atomCount} document.md files found ` +
          `(expected ≥ ${CONTENT_DIR_MIN_FILES}). Tarball extraction likely truncated or failed.`,
      );
    }

    const composed = compose(contentDir);
    if (composed.length < COMPOSE_OUTPUT_MIN_BYTES) {
      throw new Error(
        `Atlas compose output sanity-check failed: ${composed.length} bytes ` +
          `(expected ≥ ${COMPOSE_OUTPUT_MIN_BYTES}). Tree walk produced unexpectedly small output.`,
      );
    }
    console.log(`[loadAtlasTree] composed monolith: ${composed.length} bytes`);

    return composed;
  } finally {
    // Best-effort cleanup. /tmp is auto-purged by Vercel between cold starts.
    try {
      await fsp.rm(extractRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch the composed Atlas monolith content from GitHub.
 *
 * Uses the SHA-keyed in-memory cache + Next.js fetch cache so callers can
 * invoke this freely; in steady state it is one /commits HEAD call per 3600s.
 */
export async function fetchAtlasMarkdownContent(): Promise<string> {
  const metadata = await fetchLatestCommitMetadata();
  if (composeCache !== null && composeCache.sha === metadata.commitSha) {
    return composeCache.content;
  }
  console.log(
    `[loadAtlasTree] composing from tarball at branch=${ATLAS_REPO_BRANCH} sha=${metadata.commitSha.slice(0, 8)}`,
  );
  const content = await composeFromTarball();
  composeCache = { sha: metadata.commitSha, content, metadata };
  return content;
}

/**
 * Fetch metadata about the latest commit on the canonical branch.
 *
 * After the cutover the relevant commit is "latest commit on the branch"
 * rather than "latest commit that touched Sky Atlas/Sky Atlas.md" — there is
 * no longer a single file to scope to.
 */
export async function fetchAtlasMarkdownMetadata(): Promise<AtlasCommitMetadata> {
  return fetchLatestCommitMetadata();
}

/**
 * Fetch both content and metadata of the Atlas monolith.
 */
export async function loadAtlasMarkdownFromGitHub(): Promise<AtlasMarkdownFromGitHub> {
  // fetchAtlasMarkdownContent triggers /commits which we'd repeat below; instead
  // do the SHA check once and reuse.
  const metadata = await fetchLatestCommitMetadata();
  if (composeCache !== null && composeCache.sha === metadata.commitSha) {
    return { content: composeCache.content, ...metadata };
  }
  const content = await composeFromTarball();
  composeCache = { sha: metadata.commitSha, content, metadata };
  return { content, ...metadata };
}

/**
 * Loads Atlas markdown for sync scripts.
 *
 * In local development (NODE_ENV !== 'production'), composes from the
 * vendored fixture at `tests/fixtures/atlas-content/` if it exists, falling
 * back to GitHub. In production, always fetches from GitHub.
 */
export async function loadAtlasMarkdownForSync(): Promise<string> {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', 'atlas-content');
    try {
      const stat = await fsp.stat(fixturePath);
      if (stat.isDirectory()) {
        console.log(`[loadAtlasMarkdownForSync] Composing local fixture: ${fixturePath}`);
        return compose(fixturePath);
      }
    } catch {
      console.warn(`[loadAtlasMarkdownForSync] Fixture not found (${fixturePath}), falling back to GitHub`);
    }
  }

  console.log('[loadAtlasMarkdownForSync] Fetching Atlas markdown from GitHub (tarball+compose)');
  return fetchAtlasMarkdownContent();
}

/**
 * Compute a stable hash of a string — used by tests/diagnostics.
 */
export function _hashContent(s: string): string {
  return crypto.createHash('sha1').update(s).digest('hex');
}
