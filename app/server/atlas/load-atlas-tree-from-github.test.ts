/**
 * Tests for the tarball+compose loader.
 *
 * Covers:
 * - Real tarball download + extract (using a small fixture tarball, not mocked tar).
 * - SHA-keyed cache: same SHA → no re-fetch; different SHA → re-fetch + recompose.
 * - Dev-mode fallback uses the vendored fixture without network access.
 */
// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ATLAS_REPO_COMMITS_URL, ATLAS_REPO_TARBALL_URL } from './constants';
import {
  _clearAtlasComposeCache,
  fetchAtlasMarkdownContent,
  fetchAtlasMarkdownMetadata,
  loadAtlasMarkdownForSync,
  loadAtlasMarkdownFromGitHub,
} from './load-atlas-tree-from-github';

const FIXTURE_DIR = path.join(__dirname, '..', '..', '..', 'tests', 'fixtures');
const FIXTURE_TARBALL = path.join(FIXTURE_DIR, 'atlas-content.tar.gz');
const FIXTURE_EXPECTED = path.join(FIXTURE_DIR, 'atlas-content-expected.md');

interface MockResponseSpec {
  url: string;
  status: number;
  body: string | Buffer;
  contentType: string;
}

let fetchMock: ReturnType<typeof vi.fn>;
let fetchCallCount: number;

function setupFetchMocks(specs: MockResponseSpec[]): void {
  fetchCallCount = 0;
  fetchMock = vi.fn(async (input: string | URL | Request) => {
    fetchCallCount++;
    const url = typeof input === 'string' ? input : input.toString();
    const match = specs.find((s) => url === s.url);
    if (!match) {
      throw new Error(`unexpected fetch URL: ${url}`);
    }
    if (typeof match.body === 'string') {
      return new Response(match.body, {
        status: match.status,
        headers: { 'content-type': match.contentType },
      });
    }
    // Body is a Buffer (tarball bytes). Use a ReadableStream.
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(match.body as Buffer));
        controller.close();
      },
    });
    return new Response(stream, {
      status: match.status,
      headers: { 'content-type': match.contentType },
    });
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
}

function commitResponse(sha: string, message: string, date: string = '2026-05-02T00:00:00Z'): string {
  return JSON.stringify({
    sha,
    commit: {
      message,
      committer: { date },
    },
  });
}

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  _clearAtlasComposeCache();
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('tarball download + extract + compose', () => {
  it('downloads, extracts, and composes a real tarball', async () => {
    const tarballBytes = fs.readFileSync(FIXTURE_TARBALL);
    const expected = fs.readFileSync(FIXTURE_EXPECTED, 'utf8');
    setupFetchMocks([
      {
        url: ATLAS_REPO_COMMITS_URL,
        status: 200,
        body: commitResponse('aaaaaaaa', 'initial'),
        contentType: 'application/json',
      },
      {
        url: ATLAS_REPO_TARBALL_URL,
        status: 200,
        body: tarballBytes,
        contentType: 'application/gzip',
      },
    ]);
    const content = await fetchAtlasMarkdownContent();
    expect(content).toBe(expected);
  });

  it('returns full {content, lastModified, commitSha, commitMessage} from loadAtlasMarkdownFromGitHub', async () => {
    const tarballBytes = fs.readFileSync(FIXTURE_TARBALL);
    setupFetchMocks([
      {
        url: ATLAS_REPO_COMMITS_URL,
        status: 200,
        body: commitResponse('bbbbbbbb', 'second commit', '2026-04-01T12:00:00Z'),
        contentType: 'application/json',
      },
      {
        url: ATLAS_REPO_TARBALL_URL,
        status: 200,
        body: tarballBytes,
        contentType: 'application/gzip',
      },
    ]);
    const result = await loadAtlasMarkdownFromGitHub();
    expect(result.commitSha).toBe('bbbbbbbb');
    expect(result.commitMessage).toBe('second commit');
    expect(result.lastModified).toEqual(new Date('2026-04-01T12:00:00Z'));
    expect(result.content.length).toBeGreaterThan(0);
  });

  it('throws on a non-2xx commits response', async () => {
    setupFetchMocks([
      {
        url: ATLAS_REPO_COMMITS_URL,
        status: 500,
        body: 'server error',
        contentType: 'text/plain',
      },
    ]);
    await expect(fetchAtlasMarkdownContent()).rejects.toThrow(/Failed to fetch latest commit metadata/);
  });

  it('throws on a non-2xx tarball response', async () => {
    setupFetchMocks([
      {
        url: ATLAS_REPO_COMMITS_URL,
        status: 200,
        body: commitResponse('cccccccc', 'x'),
        contentType: 'application/json',
      },
      {
        url: ATLAS_REPO_TARBALL_URL,
        status: 502,
        body: 'gateway timeout',
        contentType: 'text/plain',
      },
    ]);
    await expect(fetchAtlasMarkdownContent()).rejects.toThrow(/Failed to fetch repo tarball/);
  });
});

describe('SHA-keyed compose cache', () => {
  it('serves cached content when the SHA is unchanged', async () => {
    const tarballBytes = fs.readFileSync(FIXTURE_TARBALL);
    const sha = 'sha-stable';
    setupFetchMocks([
      {
        url: ATLAS_REPO_COMMITS_URL,
        status: 200,
        body: commitResponse(sha, 'first'),
        contentType: 'application/json',
      },
      {
        url: ATLAS_REPO_TARBALL_URL,
        status: 200,
        body: tarballBytes,
        contentType: 'application/gzip',
      },
    ]);
    // First call: 1 commits + 1 tarball = 2 fetches.
    const c1 = await fetchAtlasMarkdownContent();
    const callsAfterFirst = fetchCallCount;
    // Second call: 1 commits (SHA-cache hit, no tarball).
    const c2 = await fetchAtlasMarkdownContent();
    const callsAfterSecond = fetchCallCount;
    expect(c1).toBe(c2);
    expect(callsAfterFirst).toBe(2);
    expect(callsAfterSecond - callsAfterFirst).toBe(1); // only the /commits HEAD request
  });

  it('invalidates and refetches when SHA changes', async () => {
    const tarballBytes = fs.readFileSync(FIXTURE_TARBALL);
    let currentSha = 'sha-A';
    fetchCallCount = 0;
    fetchMock = vi.fn(async (input: string | URL | Request) => {
      fetchCallCount++;
      const url = typeof input === 'string' ? input : input.toString();
      if (url === ATLAS_REPO_COMMITS_URL) {
        return new Response(commitResponse(currentSha, 'msg'), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url === ATLAS_REPO_TARBALL_URL) {
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(tarballBytes));
            controller.close();
          },
        });
        return new Response(stream, {
          status: 200,
          headers: { 'content-type': 'application/gzip' },
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fetchAtlasMarkdownContent(); // 2 fetches (commits + tarball)
    const after1 = fetchCallCount;
    expect(after1).toBe(2);

    currentSha = 'sha-B'; // simulate upstream commit
    await fetchAtlasMarkdownContent(); // 2 more fetches (commits + tarball — cache invalidated)
    const after2 = fetchCallCount;
    expect(after2 - after1).toBe(2);
  });
});

describe('fetchAtlasMarkdownMetadata', () => {
  it('returns commit metadata without downloading the tarball', async () => {
    setupFetchMocks([
      {
        url: ATLAS_REPO_COMMITS_URL,
        status: 200,
        body: commitResponse('dddddddd', 'metadata-only'),
        contentType: 'application/json',
      },
    ]);
    const meta = await fetchAtlasMarkdownMetadata();
    expect(meta.commitSha).toBe('dddddddd');
    expect(fetchCallCount).toBe(1);
  });
});

describe('dev-mode fallback', () => {
  it('composes the vendored fixture in development without hitting the network', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    vi.stubEnv('NODE_ENV', 'development');
    // Failing fetch — proves no network is touched.
    globalThis.fetch = (async () => {
      throw new Error('fetch should not be called in dev mode when fixture exists');
    }) as unknown as typeof fetch;
    try {
      const expected = fs.readFileSync(FIXTURE_EXPECTED, 'utf8');
      const content = await loadAtlasMarkdownForSync();
      expect(content).toBe(expected);
    } finally {
      if (originalNodeEnv !== undefined) {
        vi.stubEnv('NODE_ENV', originalNodeEnv);
      }
      vi.unstubAllEnvs();
    }
  });
});
