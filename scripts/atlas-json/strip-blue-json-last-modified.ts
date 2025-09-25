#!/usr/bin/env npx tsx
/**
 * Strip *_last_modified fields from Blue JSON files to stabilize diffs.
 *
 * What it does:
 * - Recursively finds keys ending with "_last_modified" and replaces their values with an empty string
 * - Processes both:
 *   - .debug-data/atlas-json-generated/blue-from-supabase.json → .debug-data/atlas-json-generated/blue-from-supabase-without-dates.json
 *   - .debug-data/blue-without-inactive.json → .debug-data/blue-without-inactive-without-dates.json
 *
 * Usage:
 *   npx tsx scripts/atlas-json/strip-blue-json-last-modified.ts
 *
 * Notes:
 * - Intended to reduce noise when comparing Blue JSONs produced by different runs
 * - Safe to run multiple times; it overwrites the two target files on each run
 */
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };

const REPO_ROOT = process.cwd();

const INPUTS = [
  {
    input: path.join(REPO_ROOT, '.debug-data', 'atlas-json-generated', 'blue-from-supabase.json'),
    output: path.join(REPO_ROOT, '.debug-data', 'atlas-json-generated', 'blue-from-supabase-without-dates.json'),
  },
  {
    input: path.join(REPO_ROOT, '.debug-data', 'blue-without-inactive.json'),
    output: path.join(REPO_ROOT, '.debug-data', 'blue-without-inactive-without-dates.json'),
  },
];

function stripLastModifiedInObject(obj: JsonObject): JsonObject {
  const out: JsonObject = Array.isArray(obj) ? (obj as unknown as JsonObject) : { ...obj };
  for (const key of Object.keys(out)) {
    const value = out[key];
    if (/_last_modified$/.test(key)) {
      out[key] = '';
      continue;
    }
    if (Array.isArray(value)) {
      out[key] = value.map((v) =>
        typeof v === 'object' && v !== null ? stripLastModified(v as JsonObject) : v,
      ) as JsonValue;
      continue;
    }
    if (typeof value === 'object' && value !== null) {
      out[key] = stripLastModified(value as JsonObject);
    }
  }
  return out;
}

function stripLastModified(node: JsonValue): JsonValue {
  if (Array.isArray(node)) {
    return node.map((item) => stripLastModified(item));
  }
  if (typeof node === 'object' && node !== null) {
    return stripLastModifiedInObject(node as JsonObject);
  }
  return node;
}

async function processFile(inputPath: string, outputPath: string): Promise<void> {
  const raw = await readFile(inputPath, 'utf8');
  const data = JSON.parse(raw) as JsonValue;
  const cleaned = stripLastModified(data);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(cleaned, null, 4), 'utf8');
  console.log(`Wrote cleaned JSON without *_last_modified dates to ${outputPath}`);
}

async function main() {
  for (const { input, output } of INPUTS) {
    try {
      await processFile(input, output);
    } catch (err) {
      console.error(`Failed to process ${input}:`, err);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
