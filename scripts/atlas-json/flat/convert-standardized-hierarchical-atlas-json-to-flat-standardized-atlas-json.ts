#!/usr/bin/env node
/**
 * CLI: Convert standardized hierarchical Atlas JSON → flat grouped JSON
 *
 * Description
 * - Reads standardized Atlas scope trees (StandardizedAtlasScopeTrees).
 * - Flattens all documents using a pre-order traversal.
 * - Groups flattened documents by Atlas database name.
 * - Writes the grouped output JSON.
 *
 * Defaults
 * - Input file: `.debug-data/standardized-atlas/atlas-supabase-scope-trees-standardized.json`
 * - Output file: `.debug-data/standardized-atlas/flat/atlas-supabase-scope-trees-standardized-flattened.json`
 *
 * Usage
 * ```bash
 * npx tsx scripts/atlas-json/flat/convert-standardized-hierarchical-atlas-json-to-flat-standardized-atlas-json.ts
 * npx tsx scripts/atlas-json/flat/convert-standardized-hierarchical-atlas-json-to-flat-standardized-atlas-json.ts <inputFileName.json> <outputFileName.json>
 * ```
 */

import fs from 'fs';
import path from 'path';
import { childCollectionNames, type StandardizedAtlasScopeTrees } from '../hierarchical/types';

/** Safe object helpers **/
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getArrayProp(obj: Record<string, unknown>, key: string): unknown[] | null {
  const value = obj[key];
  return Array.isArray(value) ? (value as unknown[]) : null;
}

/**
 * Mapping from Standardized document `type` to Atlas Database name.
 * Based on repository documentation "Atlas Database to Atlas Document Type Mapping".
 */
const TYPE_TO_DATABASE: Record<string, string> = {
  // Root / immutable
  Scope: 'Scopes',
  Article: 'Articles',
  Section: 'Sections & Primary Docs',
  Category: 'Sections & Primary Docs',

  // Primary
  Core: 'Sections & Primary Docs',
  'Active Data Controller': 'Sections & Primary Docs',
  'Type Specification': 'Sections & Primary Docs',

  // Supporting
  Annotation: 'Annotations',
  'Action Tenet': 'Tenets',
  Scenario: 'Scenarios',
  'Scenario Variation': 'Scenario Variations',
  'Active Data': 'Active Data',
  'Needed Research': 'Needed Research',
};

function mapTypeToDatabaseName(type: unknown): string {
  if (typeof type === 'string' && TYPE_TO_DATABASE[type]) return TYPE_TO_DATABASE[type];
  return 'Unknown';
}

/** Minimal flattened item shape */
type FlatDoc = {
  type: string;
  docNo: string;
  name: string;
  uuid: string | null;
};

/**
 * Pre-order traversal over standardized node, pushing flattened items into the grouped map.
 * This traversal mirrors the defensive approach: iterate over known child arrays directly on the node
 * and inside `supportingDocuments`.
 */
function traverseAndCollectFlat(node: unknown, grouped: Map<string, FlatDoc[]>): void {
  if (!isObject(node)) return;

  const type = node['type'];
  const docNo = node['docNo'];
  const name = node['name'];
  const uuid = node['uuid'] ?? null;

  const databaseName = mapTypeToDatabaseName(type);
  const entry: FlatDoc = {
    type: typeof type === 'string' ? type : String(type ?? ''),
    docNo: typeof docNo === 'string' ? docNo : String(docNo ?? ''),
    name: typeof name === 'string' ? name : String(name ?? ''),
    uuid: typeof uuid === 'string' ? uuid : null,
  };
  if (!grouped.has(databaseName)) grouped.set(databaseName, []);
  grouped.get(databaseName)!.push(entry);

  // Children on node
  for (const collectionName of childCollectionNames) {
    const children = getArrayProp(node, collectionName);
    if (children) {
      for (const child of children) traverseAndCollectFlat(child, grouped);
    }
  }

  // Children under supportingDocuments
  const supporting = node['supportingDocuments'];
  if (isObject(supporting)) {
    for (const key of Object.keys(supporting)) {
      const children = getArrayProp(supporting, key);
      if (children) {
        for (const child of children) traverseAndCollectFlat(child, grouped);
      }
    }
  }
}

function readJsonFile<T>(filePath: string): T {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) throw new Error(`Input file not found: ${resolved}`);
  const content = fs.readFileSync(resolved, 'utf8');
  return JSON.parse(content) as T;
}

function assertIsArray(value: unknown, label: string): asserts value is unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Expected ${label} to be an array`);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const inArg = argv[0];
  const outArg = argv[1];

  const inputDir = '.debug-data/standardized-atlas';
  const outputDir = '.debug-data/standardized-atlas/flat';

  const inputFileName = inArg ?? 'atlas-supabase-scope-trees-standardized.json';
  const outputFileName = outArg ?? 'atlas-supabase-scope-trees-standardized-flattened.json';

  const inputPath = path.join(inputDir, inputFileName);
  const outputPath = path.join(outputDir, outputFileName);

  console.log(`Reading: ${path.resolve(inputPath)}`);
  const trees = readJsonFile<unknown>(inputPath);
  assertIsArray(trees, 'StandardizedAtlasScopeTrees');

  const grouped = new Map<string, FlatDoc[]>();
  for (const root of trees as StandardizedAtlasScopeTrees) {
    traverseAndCollectFlat(root, grouped);
  }

  const groupedObject = Object.fromEntries(grouped);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(groupedObject, null, 2), 'utf8');
  console.log(`Wrote flat grouped JSON to: ${path.resolve(outputPath)}`);

  // Summary
  const totalDocs = Object.values(groupedObject).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
  console.log(`Total documents flattened: ${totalDocs}`);
  const dbNames = Object.keys(groupedObject).sort();
  console.log(`Databases (${dbNames.length}): ${dbNames.join(', ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
