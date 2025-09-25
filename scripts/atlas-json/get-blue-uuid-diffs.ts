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

type UuidDataCollectors = {
  set: Set<string>;
  counts: Map<string, number>;
  typesByUuid: Map<string, Set<string>>;
};

function addUuid(uuid: string, docType: string | undefined, collectors: UuidDataCollectors): void {
  const normalized = uuid.toLowerCase();
  collectors.set.add(normalized);
  collectors.counts.set(normalized, (collectors.counts.get(normalized) ?? 0) + 1);
  if (docType && docType.length > 0) {
    const set = collectors.typesByUuid.get(normalized) ?? new Set<string>();
    set.add(docType);
    collectors.typesByUuid.set(normalized, set);
  }
}

function deriveDocTypeFromKey(key: string): string | undefined {
  if (!key) return undefined;
  if (key.endsWith('_uuid')) {
    const base = key.slice(0, -'_uuid'.length);
    return base || undefined;
  }
  return undefined;
}

function traverseAndCollect(value: JsonValue, collectors: UuidDataCollectors): void {
  if (value === null) return;

  if (typeof value === 'string') {
    if (UUID_REGEX.test(value)) {
      addUuid(value, undefined, collectors);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      traverseAndCollect(item, collectors);
    }
    return;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, JsonValue>;
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      if (typeof v === 'string' && UUID_REGEX.test(v)) {
        addUuid(v, deriveDocTypeFromKey(key), collectors);
      } else {
        traverseAndCollect(v, collectors);
      }
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

function formatSection(title: string, ids: string[], typesByUuid: Map<string, Set<string>>): string {
  const lines: string[] = [];
  lines.push(title);
  lines.push(`Count: ${ids.length}`);
  if (ids.length > 0) {
    for (const id of ids) {
      const types = Array.from(typesByUuid.get(id) ?? []);
      const suffix = types.length > 0 ? ` [${types.join(', ')}]` : '';
      lines.push(`${id}${suffix}`);
    }
  }
  return lines.join('\n');
}

function formatDuplicateSection(
  title: string,
  counts: Map<string, number>,
  typesByUuid: Map<string, Set<string>>,
): string {
  const entries = Array.from(counts.entries()).filter(([, n]) => n > 1);
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  const lines: string[] = [];
  lines.push(title);
  lines.push(`Count: ${entries.length}`);
  for (const [id, n] of entries) {
    const types = Array.from(typesByUuid.get(id) ?? []);
    const suffix = types.length > 0 ? ` [${types.join(', ')}]` : '';
    lines.push(`${id} (${n} times)${suffix}`);
  }
  return lines.join('\n');
}

function main(): void {
  const firstPath = resolveFromRepoRoot(FIRST_JSON_RELATIVE_PATH);
  const secondPath = resolveFromRepoRoot(SECOND_JSON_RELATIVE_PATH);

  const firstJson = readJsonFile(firstPath);
  const secondJson = readJsonFile(secondPath);

  const firstCollectors: UuidDataCollectors = {
    set: new Set<string>(),
    counts: new Map<string, number>(),
    typesByUuid: new Map<string, Set<string>>(),
  };
  const secondCollectors: UuidDataCollectors = {
    set: new Set<string>(),
    counts: new Map<string, number>(),
    typesByUuid: new Map<string, Set<string>>(),
  };

  traverseAndCollect(firstJson, firstCollectors);
  traverseAndCollect(secondJson, secondCollectors);

  const onlyInSecond = difference(secondCollectors.set, firstCollectors.set);
  const onlyInFirst = difference(firstCollectors.set, secondCollectors.set);

  const outputSections = [
    formatSection(
      `IDs present in second JSON but missing from first (${path.basename(SECOND_JSON_RELATIVE_PATH)} vs ${path.basename(FIRST_JSON_RELATIVE_PATH)})`,
      onlyInSecond,
      secondCollectors.typesByUuid,
    ),
    '',
    formatSection(
      `IDs present in first JSON but missing from second (${path.basename(FIRST_JSON_RELATIVE_PATH)} vs ${path.basename(SECOND_JSON_RELATIVE_PATH)})`,
      onlyInFirst,
      firstCollectors.typesByUuid,
    ),
    '',
    formatDuplicateSection(
      `Duplicate IDs within first JSON (${path.basename(FIRST_JSON_RELATIVE_PATH)})`,
      firstCollectors.counts,
      firstCollectors.typesByUuid,
    ),
    '',
    formatDuplicateSection(
      `Duplicate IDs within second JSON (${path.basename(SECOND_JSON_RELATIVE_PATH)})`,
      secondCollectors.counts,
      secondCollectors.typesByUuid,
    ),
  ];

  console.log(outputSections.join('\n'));
}

main();
