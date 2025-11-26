/**
 * Helper functions to load the canonical Atlas markdown file from GitHub.
 *
 * The Atlas markdown file is stored in a central GitHub repository and serves as
 * the source of truth for the Markdown → Notion sync workflow.
 *
 * @see ATLAS_MARKDOWN_GITHUB_RAW_URL in constants.ts
 */
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
  const response = await fetch(ATLAS_MARKDOWN_GITHUB_RAW_URL);

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
 * its last modified date for comparison during Markdown → Notion sync.
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
