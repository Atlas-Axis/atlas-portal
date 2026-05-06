/**
 * Page-load benchmark for the Atlas Portal.
 *
 * Measures first-byte and full-response time for the main routes (`/atlas`,
 * `/api/atlas.json`) at a configurable base URL. Reports a "cold" sample (the
 * first request after the script starts, which is the closest a client can
 * get to a CDN-cold path without admin tooling) and several "warm" samples.
 *
 * The benchmark is deliberately external — it talks to an HTTP origin and
 * measures what a real user sees, not what the framework's internal counters
 * report. Runs against:
 *
 *   - production: BASE_URL=https://sky-atlas.io
 *   - local prod build: BASE_URL=http://localhost:3000  (after `npm run build && npm run start`)
 *   - preview deploys: any Vercel preview URL
 *
 * Usage:
 *   npx tsx scripts/bench-page-load.ts                     # defaults to https://sky-atlas.io
 *   BASE_URL=http://localhost:3000 npx tsx scripts/bench-page-load.ts
 *   npx tsx scripts/bench-page-load.ts --warm-runs 10
 *
 * Output is human-readable; pipe through `tee` to capture for PR bodies.
 */
import { performance } from 'node:perf_hooks';

interface BenchResult {
  url: string;
  status: number;
  ttfbMs: number;
  totalMs: number;
  bodyBytes: number;
  cacheHeader: string | null;
}

interface Options {
  baseUrl: string;
  warmRuns: number;
  paths: string[];
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const baseUrl = process.env.BASE_URL || 'https://sky-atlas.io';
  let warmRuns = 5;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--warm-runs' && i + 1 < args.length) {
      const next = args[i + 1];
      if (next !== undefined) {
        warmRuns = parseInt(next, 10);
      }
      i++;
    }
  }
  return {
    baseUrl: baseUrl.replace(/\/$/, ''),
    warmRuns,
    paths: ['/atlas', '/api/atlas.json'],
  };
}

async function timeRequest(url: string): Promise<BenchResult> {
  const start = performance.now();
  const res = await fetch(url, {
    headers: {
      // Force a fresh path on every request so we measure the origin/CDN
      // honestly. In a static-render setup the CDN serves these as cache
      // hits anyway; the cache-buster only affects intermediate proxies.
      'Cache-Control': 'no-cache',
    },
  });
  const ttfbMs = performance.now() - start;
  const buf = await res.arrayBuffer();
  const totalMs = performance.now() - start;
  return {
    url,
    status: res.status,
    ttfbMs,
    totalMs,
    bodyBytes: buf.byteLength,
    cacheHeader: res.headers.get('x-vercel-cache') || res.headers.get('cf-cache-status'),
  };
}

function pad(n: number, width: number): string {
  return n.toFixed(0).padStart(width);
}

function formatRow(label: string, r: BenchResult): string {
  const cache = r.cacheHeader ? ` cache=${r.cacheHeader}` : '';
  return (
    `  ${label.padEnd(8)} status=${r.status} ` +
    `ttfb=${pad(r.ttfbMs, 5)}ms total=${pad(r.totalMs, 5)}ms ` +
    `bytes=${pad(r.bodyBytes, 8)}${cache}`
  );
}

async function benchPath(baseUrl: string, path: string, warmRuns: number): Promise<void> {
  const url = baseUrl + path;
  console.log(`\n${url}`);

  const cold = await timeRequest(url);
  console.log(formatRow('cold', cold));

  const warmResults: BenchResult[] = [];
  for (let i = 0; i < warmRuns; i++) {
    warmResults.push(await timeRequest(url));
  }
  for (let i = 0; i < warmResults.length; i++) {
    const result = warmResults[i];
    if (result !== undefined) {
      console.log(formatRow(`warm[${i}]`, result));
    }
  }

  const totals = warmResults.map((r) => r.totalMs).sort((a, b) => a - b);
  const median = totals[Math.floor(totals.length / 2)] ?? 0;
  const p95 = totals[Math.max(0, Math.ceil(totals.length * 0.95) - 1)] ?? 0;
  console.log(`  warm median=${median.toFixed(0)}ms warm p95=${p95.toFixed(0)}ms`);
}

async function main(): Promise<void> {
  const opts = parseArgs();
  console.log(`bench-page-load: target=${opts.baseUrl} warm-runs=${opts.warmRuns}`);
  for (const p of opts.paths) {
    await benchPath(opts.baseUrl, p, opts.warmRuns);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
