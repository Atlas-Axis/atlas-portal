/**
 * Helper functions to load the canonical Atlas markdown file from GitHub.
 *
 * The Atlas markdown file is stored in a central GitHub repository and serves as
 * the single source of truth for the Atlas Portal.
 *
 * @see ATLAS_MARKDOWN_GITHUB_RAW_URL in constants.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { ATLAS_MARKDOWN_GITHUB_API_URL, ATLAS_MARKDOWN_GITHUB_RAW_URL } from './constants';

export interface AtlasMarkdownFromGitHub {
  /** The markdown content of the Atlas file */
  content: string;
  /** The last modified date of the file (from the most recent commit) */
  lastModified: Date;
  /** The SHA of the most recent commit that modified the file */
  commitSha: string;
  /** The commit message of the most recent commit */
  commitMessage: string;
}

interface GitHubCommitResponse {
  sha: string;
  commit: {
    message: string;
    committer: {
      date: string;
    };
  };
}

/**
 * Fetches the canonical Atlas markdown file content from GitHub.
 *
 * @returns The markdown content as a string
 * @throws Error if the fetch fails or the file is not found
 */
export async function fetchAtlasMarkdownContent(): Promise<string> {
  const response = await fetch(ATLAS_MARKDOWN_GITHUB_RAW_URL, {
    // Match the page-level ISR revalidation interval.
    // Without this, Next.js caches the fetch response indefinitely
    // in its data cache — so ISR rebuilds the page with stale content.
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Atlas markdown from GitHub: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

/**
 * Fetches metadata about the Atlas markdown file from GitHub API.
 * Returns the last modified date based on the most recent commit.
 *
 * @returns Object containing lastModified date, commit SHA, and commit message
 * @throws Error if the fetch fails or no commits are found
 */
export async function fetchAtlasMarkdownMetadata(): Promise<{
  lastModified: Date;
  commitSha: string;
  commitMessage: string;
}> {
  const response = await fetch(ATLAS_MARKDOWN_GITHUB_API_URL, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      // Note: For higher rate limits, add a GitHub token:
      // 'Authorization': `token ${process.env.GITHUB_TOKEN}`,
    },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch Atlas markdown metadata from GitHub API: ${response.status} ${response.statusText}`,
    );
  }

  const commits: GitHubCommitResponse[] = await response.json();

  if (!commits || commits.length === 0) {
    throw new Error('No commits found for Atlas markdown file');
  }

  const latestCommit = commits[0];

  return {
    lastModified: new Date(latestCommit.commit.committer.date),
    commitSha: latestCommit.sha,
    commitMessage: latestCommit.commit.message,
  };
}

/**
 * Fetches both the content and metadata of the Atlas markdown file from GitHub.
 *
 * This is the main function to use when you need both the file content and
 * its metadata (last modified date, commit info).
 *
 * @returns Object containing content, lastModified date, commit SHA, and commit message
 * @throws Error if either fetch fails
 *
 * @example
 * ```ts
 * const atlas = await loadAtlasMarkdownFromGitHub();
 * console.log(`Last modified: ${atlas.lastModified}`);
 * console.log(`Content length: ${atlas.content.length} chars`);
 * ```
 */
export async function loadAtlasMarkdownFromGitHub(): Promise<AtlasMarkdownFromGitHub> {
  // Fetch content and metadata in parallel for better performance
  const [content, metadata] = await Promise.all([fetchAtlasMarkdownContent(), fetchAtlasMarkdownMetadata()]);

  return {
    content,
    ...metadata,
  };
}

/**
 * Loads Atlas markdown with local file fallback for development.
 *
 * In local development (NODE_ENV !== 'production'), tries to use truncated-atlas.md
 * if it exists, otherwise falls back to GitHub.
 *
 * In production, always fetches from GitHub.
 *
 * @returns The markdown content as a string
 * @throws Error if GitHub fetch fails and no local file is available
 */
export async function loadAtlasMarkdownForSync(): Promise<string> {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Local development: try to load truncated file
    const truncatedPath = path.join(process.cwd(), 'exported-atlas', 'truncated-atlas.md');
    try {
      const markdown = await fs.readFile(truncatedPath, 'utf8');
      console.log(`[loadAtlasMarkdownForSync] Using local truncated Atlas file: ${truncatedPath}`);
      return markdown;
    } catch {
      console.warn(`[loadAtlasMarkdownForSync] Truncated file not found (${truncatedPath}), falling back to GitHub`);
    }
  }

  // Production or fallback: fetch from GitHub
  console.log('[loadAtlasMarkdownForSync] Fetching Atlas markdown from GitHub');
  return fetchAtlasMarkdownContent();
}
