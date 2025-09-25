/*
Purpose: Compare UUID presence between two Blue JSON outputs and report diffs and duplicates.

Inputs (fixed paths, no CLI args):
- .debug-data/atlas-json-generated/blue-from-supabase-without-dates.json
- .debug-data/atlas-json-generated/blue-without-inactive-without-dates.json

What it does:
- Recursively scans both JSON files for UUIDs anywhere in the structure
- Prints IDs present in the second JSON but missing from the first
- Prints IDs present in the first JSON but missing from the second
- Prints any duplicate UUIDs found within each individual JSON, with counts

Usage (from repo root):
  npx tsx scripts/atlas-json/get-blue-uuid-diffs.ts

Notes:
- UUIDs are matched via regex and normalized to lowercase before comparison
- No parameters are accepted; edit constants in this file to change inputs
*/
import fs from 'node:fs';
import path from 'node:path';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const FIRST_JSON_RELATIVE_PATH = '.debug-data/atlas-json-generated/blue-from-supabase-without-dates.json';
const SECOND_JSON_RELATIVE_PATH = '.debug-data/atlas-json-generated/blue-without-inactive-without-dates.json';

function resolveFromRepoRoot(relativePath: string): string {
  return path.resolve(process.cwd(), relativePath);
}

function readJsonFile(filePath: string): JsonValue {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content) as JsonValue;
  } catch (error) {
    const readablePath = path.relative(process.cwd(), filePath) || filePath;
    console.error(`Failed to read or parse JSON file: ${readablePath}`);
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }
}

const UUID_REGEX = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/;

function collectUuids(value: JsonValue, result: Set<string>): void {
  if (value === null) return;

  if (typeof value === 'string') {
    if (UUID_REGEX.test(value)) {
      result.add(value.toLowerCase());
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectUuids(item, result);
    }
    return;
  }

  if (typeof value === 'object') {
    for (const key of Object.keys(value)) {
      collectUuids((value as Record<string, JsonValue>)[key], result);
    }
    return;
  }
}

function collectUuidCounts(value: JsonValue, counts: Map<string, number>): void {
  if (value === null) return;

  if (typeof value === 'string') {
    if (UUID_REGEX.test(value)) {
      const key = value.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectUuidCounts(item, counts);
    }
    return;
  }

  if (typeof value === 'object') {
    for (const key of Object.keys(value)) {
      collectUuidCounts((value as Record<string, JsonValue>)[key], counts);
    }
    return;
  }
}

function difference(a: Set<string>, b: Set<string>): string[] {
  const diff: string[] = [];
  for (const id of a) {
    if (!b.has(id)) diff.push(id);
  }
  diff.sort();
  return diff;
}

function formatSection(title: string, ids: string[]): string {
  const lines: string[] = [];
  lines.push(title);
  lines.push(`Count: ${ids.length}`);
  if (ids.length > 0) {
    for (const id of ids) lines.push(id);
  }
  return lines.join('\n');
}

function formatDuplicateSection(title: string, counts: Map<string, number>): string {
  const entries = Array.from(counts.entries()).filter(([, n]) => n > 1);
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  const lines: string[] = [];
  lines.push(title);
  lines.push(`Count: ${entries.length}`);
  for (const [id, n] of entries) {
    lines.push(`${id} (${n} times)`);
  }
  return lines.join('\n');
}

function main(): void {
  const firstPath = resolveFromRepoRoot(FIRST_JSON_RELATIVE_PATH);
  const secondPath = resolveFromRepoRoot(SECOND_JSON_RELATIVE_PATH);

  const firstJson = readJsonFile(firstPath);
  const secondJson = readJsonFile(secondPath);

  const firstUuids = new Set<string>();
  const secondUuids = new Set<string>();
  const firstCounts = new Map<string, number>();
  const secondCounts = new Map<string, number>();

  collectUuids(firstJson, firstUuids);
  collectUuids(secondJson, secondUuids);
  collectUuidCounts(firstJson, firstCounts);
  collectUuidCounts(secondJson, secondCounts);

  const onlyInSecond = difference(secondUuids, firstUuids);
  const onlyInFirst = difference(firstUuids, secondUuids);

  const outputSections = [
    formatSection(
      `IDs present in second JSON but missing from first (${path.basename(SECOND_JSON_RELATIVE_PATH)} vs ${path.basename(FIRST_JSON_RELATIVE_PATH)})`,
      onlyInSecond,
    ),
    '',
    formatSection(
      `IDs present in first JSON but missing from second (${path.basename(FIRST_JSON_RELATIVE_PATH)} vs ${path.basename(SECOND_JSON_RELATIVE_PATH)})`,
      onlyInFirst,
    ),
    '',
    formatDuplicateSection(`Duplicate IDs within first JSON (${path.basename(FIRST_JSON_RELATIVE_PATH)})`, firstCounts),
    '',
    formatDuplicateSection(
      `Duplicate IDs within second JSON (${path.basename(SECOND_JSON_RELATIVE_PATH)})`,
      secondCounts,
    ),
  ];

  console.log(outputSections.join('\n'));
}

main();
