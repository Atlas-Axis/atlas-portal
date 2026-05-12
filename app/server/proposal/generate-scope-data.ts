/**
 * Bridge to the Python `scope_data` builder.
 *
 * The /proposal page renders an Atlas Edit Proposal as a tree of "edit
 * scopes". The diff + scope detection + per-document HTML generation is
 * owned by Python (`scripts/renderer/atlas_preview/`) so the renderer
 * stays the canonical implementation and atlas-portal stays a
 * presentation-only consumer of the same data API.
 *
 * Inputs:
 *  - paths to two extracted content/ directories (base and head)
 *  - PR metadata for display
 *
 * Output: parsed ScopeData object.
 *
 * Errors: any non-zero exit from the Python script throws — the build
 * surface is build-time-only, so callers are expected to fail loud.
 */
import { spawnSync } from 'node:child_process';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ScopeData } from './scope-data';

const PYTHON_BIN = process.env.PYTHON_BIN || 'python3';

/**
 * Path to the renderer's entry script. Resolved relative to the
 * repository root so it works in `next dev`, `next build`, and Vercel
 * builds (all of which run from the project root).
 */
function rendererScriptPath(): string {
  return path.join(process.cwd(), 'scripts', 'renderer', 'generate.py');
}

export interface GenerateScopeDataInput {
  baseContentDir: string;
  headContentDir: string;
  branch: string;
  baseRef: string;
  repo: string;
  prNumber?: number;
  prTitle?: string;
}

/**
 * Invoke the Python scope_data builder and return the parsed JSON.
 *
 * Build-time only — synchronous via `spawnSync`, which keeps the
 * Vercel build pipeline simple and produces clean error output.
 */
export async function generateScopeData(input: GenerateScopeDataInput): Promise<ScopeData> {
  const outDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'atlas-proposal-scope-'));
  const outputPath = path.join(outDir, 'scope-data.json');

  try {
    const args = [
      rendererScriptPath(),
      '--base-content-dir',
      input.baseContentDir,
      '--head-content-dir',
      input.headContentDir,
      '--branch',
      input.branch,
      '--base-ref',
      input.baseRef,
      '--repo',
      input.repo,
      '--output',
      outputPath,
    ];
    if (input.prNumber !== undefined) {
      args.push('--pr-number', String(input.prNumber));
    }
    if (input.prTitle) {
      args.push('--pr-title', input.prTitle);
    }

    const result = spawnSync(PYTHON_BIN, args, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    if (result.error) {
      throw new Error(
        `Failed to spawn Python renderer (${PYTHON_BIN}): ${result.error.message}. ` +
          `Ensure Python 3.11+ is available on the build container.`,
      );
    }
    if (result.status !== 0) {
      const stderr = result.stderr || '';
      throw new Error(`Python renderer exited with code ${result.status}.\n` + `stderr: ${stderr.trim()}`);
    }

    if (result.stderr) {
      // Forward the Python script's summary line to build logs.
      // (One-line stats summary is helpful in CI output.)
      process.stderr.write(result.stderr);
    }

    const json = await fsp.readFile(outputPath, 'utf-8');
    return JSON.parse(json) as ScopeData;
  } finally {
    await fsp.rm(outDir, { recursive: true, force: true }).catch(() => {});
  }
}
