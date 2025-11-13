#!/usr/bin/env node
/**
 * CLI: Diff UUIDs of two Standardized Atlas JSONs
 *
 * Description
 * - Reads two JSON files containing `StandardizedAtlasScopeTrees`.
 * - Traverses all documents, collects UUIDs and counts, and prints differences.
 * - Reports: total documents, UUID frequencies (duplicates), missing-in-each set.
 *
 * Defaults
 * - File A: `.debug-data/standardized-atlas/atlas-powerhouse-standardized.json`
 * - File B: `.debug-data/standardized-atlas/atlas.json`
 *
 * Usage
 * ```bash
 * npx tsx scripts/atlas-json/hierarchical/diff-uuids-of-standardized-hierarchical-atlas-jsons.ts
 * npx tsx scripts/atlas-json/hierarchical/diff-uuids-of-standardized-hierarchical-atlas-jsons.ts <fileA> <fileB>
 * npx tsx scripts/atlas-json/hierarchical/diff-uuids-of-standardized-hierarchical-atlas-jsons.ts <fileA> <fileB> --limit 100
 * ```
 */
import fs from 'fs';
import path from 'path';
import { type StandardizedAtlasScopeTrees, childCollectionNames } from '@/app/server/atlas/export/types';

const MAX_DISPLAY = 20;

/**
 * Names of child collections that may live inside `supportingDocuments`.
 * These are a subset of `childCollectionNames` but grouped under `supportingDocuments`.
 */
const supportingChildCollectionNames = new Set(['annotations', 'tenets', 'neededResearch', 'activeData']);

/** Safe object helpers **/
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getArrayProp(obj: Record<string, unknown>, key: string): unknown[] | null {
  const value = obj[key];
  return Array.isArray(value) ? (value as unknown[]) : null;
}

function fileLabelFromPath(filePath: string): string {
  const base = path.basename(filePath);
  // Remove .json suffix
  const withoutExt = base.replace(/\.json$/i, '');
  // Remove leading 'atlas-'
  const withoutPrefix = withoutExt.replace(/^atlas-/i, '');
  // Remove trailing '-standardized'
  const withoutPostfix = withoutPrefix.replace(/-standardized$/i, '');
  return withoutPostfix;
}

/**
 * Container of traversal statistics and UUID collections for one JSON file.
 */
type UuidCollectionStats = {
  totalDocumentCount: number; // counts every node visited
  nullUuidCount: number; // number of nodes with null/empty UUIDs
  uuidFrequencies: Map<string, number>; // frequency of non-null UUIDs
};

function readJsonFile<T>(filePath: string): T {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Input file not found: ${resolved}`);
  }
  const content = fs.readFileSync(resolved, 'utf8');
  return JSON.parse(content) as T;
}

function assertIsArray(value: unknown, label: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an array`);
  }
}

function incrementFrequency(map: Map<string, number>, key: string): void {
  const existing = map.get(key) ?? 0;
  map.set(key, existing + 1);
}

/**
 * Recursively traverse a standardized atlas document, collecting UUIDs and counting nodes.
 * This function is intentionally defensive and will look for child arrays both at the
 * top level of the node and inside an optional `supportingDocuments` object.
 */
function traverseAndCollect(node: unknown, stats: UuidCollectionStats): void {
  if (!isObject(node)) return;

  // Count this node
  stats.totalDocumentCount += 1;

  // Collect UUID
  const uuidValue = node['uuid'];
  if (typeof uuidValue === 'string' && uuidValue.trim().length > 0) {
    incrementFrequency(stats.uuidFrequencies, uuidValue);
  } else {
    stats.nullUuidCount += 1;
  }

  // Traverse direct child collections present on the node
  for (const collectionName of childCollectionNames) {
    const children = getArrayProp(node, collectionName);
    if (children) {
      for (const child of children) {
        traverseAndCollect(child, stats);
      }
    }
  }

  // Traverse supportingDocuments collections if present
  const supporting = node['supportingDocuments'];
  if (isObject(supporting)) {
    for (const key of Object.keys(supporting)) {
      if (!supportingChildCollectionNames.has(key)) continue;
      const children = getArrayProp(supporting, key);
      if (children) {
        for (const child of children) {
          traverseAndCollect(child, stats);
        }
      }
    }
  }
}

function collectFromTrees(trees: StandardizedAtlasScopeTrees): UuidCollectionStats {
  const stats: UuidCollectionStats = {
    totalDocumentCount: 0,
    nullUuidCount: 0,
    uuidFrequencies: new Map<string, number>(),
  };

  for (const root of trees) {
    traverseAndCollect(root, stats);
  }

  return stats;
}

function mapKeysToSortedArray(map: Map<string, number>): string[] {
  return Array.from(map.keys()).sort();
}

function getDuplicates(map: Map<string, number>): Array<{ uuid: string; count: number }> {
  const result: Array<{ uuid: string; count: number }> = [];
  for (const [uuid, count] of map) {
    if (count > 1) result.push({ uuid, count });
  }
  result.sort((a, b) => b.count - a.count || a.uuid.localeCompare(b.uuid));
  return result;
}

function setDifference(a: Set<string>, b: Set<string>): string[] {
  const result: string[] = [];
  for (const value of a) {
    if (!b.has(value)) result.push(value);
  }
  result.sort();
  return result;
}

function printList(label: string, items: string[], maxPreview: number): void {
  console.log(`\n${label} (count=${items.length})`);
  const limit = Math.min(items.length, maxPreview, MAX_DISPLAY);
  for (let i = 0; i < limit; i++) {
    console.log(items[i]);
  }
  if (limit < items.length) {
    console.log(`...and ${items.length - limit} more`);
  }
}

function printDuplicateList(label: string, entries: Array<{ uuid: string; count: number }>, maxPreview: number): void {
  console.log(`\n${label} (count=${entries.length})`);
  const limit = Math.min(entries.length, maxPreview, MAX_DISPLAY);
  for (let i = 0; i < limit; i++) {
    const { uuid, count } = entries[i];
    console.log(`${uuid} x${count}`);
  }
  if (limit < entries.length) {
    console.log(`...and ${entries.length - limit} more`);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const args = argv.filter((a) => !a.startsWith('-'));

  // Flags
  const limitFlagIndex = argv.findIndex((a) => a === '--limit');
  const defaultPreviewLimit = 200;
  const previewLimit =
    limitFlagIndex >= 0 ? Math.max(0, Number(argv[limitFlagIndex + 1] ?? defaultPreviewLimit)) : defaultPreviewLimit;

  const defaultFileA = '.debug-data/standardized-atlas/atlas-powerhouse-standardized.json';
  const defaultFileB = '.debug-data/standardized-atlas/atlas.json';

  const fileA = args[0] ?? defaultFileA;
  const fileB = args[1] ?? defaultFileB;

  const labelA = fileLabelFromPath(fileA);
  const labelB = fileLabelFromPath(fileB);

  console.log(`Reading:`);
  console.log(`- ${labelA}: ${path.resolve(fileA)}`);
  console.log(`- ${labelB}: ${path.resolve(fileB)}`);

  const [treesA, treesB] = [readJsonFile<unknown>(fileA), readJsonFile<unknown>(fileB)];

  assertIsArray(treesA, `${labelA} root`);
  assertIsArray(treesB, `${labelB} root`);

  const [statsA, statsB] = [
    collectFromTrees(treesA as StandardizedAtlasScopeTrees),
    collectFromTrees(treesB as StandardizedAtlasScopeTrees),
  ];

  const uuidsA = new Set(mapKeysToSortedArray(statsA.uuidFrequencies));
  const uuidsB = new Set(mapKeysToSortedArray(statsB.uuidFrequencies));

  const onlyInA = setDifference(uuidsA, uuidsB);
  const onlyInB = setDifference(uuidsB, uuidsA);

  const duplicatesA = getDuplicates(statsA.uuidFrequencies);
  const duplicatesB = getDuplicates(statsB.uuidFrequencies);

  // Summary
  console.log('\n=== UUID Diff Summary ===');
  console.log(`Total documents (${labelA}): ${statsA.totalDocumentCount}`);
  console.log(`Total documents (${labelB}): ${statsB.totalDocumentCount}`);
  console.log(`Non-null UUIDs (${labelA}): ${uuidsA.size}`);
  console.log(`Non-null UUIDs (${labelB}): ${uuidsB.size}`);
  console.log(`Null/empty UUIDs (${labelA}): ${statsA.nullUuidCount}`);
  console.log(`Null/empty UUIDs (${labelB}): ${statsB.nullUuidCount}`);
  console.log(`Duplicates (${labelA}): ${duplicatesA.length}`);
  console.log(`Duplicates (${labelB}): ${duplicatesB.length}`);
  console.log(`Only in ${labelA} (missing in ${labelB}): ${onlyInA.length}`);
  console.log(`Only in ${labelB} (missing in ${labelA}): ${onlyInB.length}`);

  // Detailed lists (capped to 20 visible items)
  printDuplicateList(`Duplicate UUIDs in ${labelA}`, duplicatesA, previewLimit);
  printDuplicateList(`Duplicate UUIDs in ${labelB}`, duplicatesB, previewLimit);
  printList(`UUIDs only in ${labelA} (missing in ${labelB})`, onlyInA, previewLimit);
  printList(`UUIDs only in ${labelB} (missing in ${labelA})`, onlyInB, previewLimit);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
