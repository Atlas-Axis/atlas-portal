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
 * - Input file: `.debug-data/standardized-atlas/atlas.json`
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
import { AGENT_ROOT_SECTION_UUIDS, ATLAS_DATABASES } from '@/app/server/atlas/constants';
import { type StandardizedAtlasScopeTrees, childCollectionNames } from '@/app/server/atlas/export/types';
import { supabase } from '@/app/server/services/supabase/supabase-client';
import { loadEnv } from '../../utils/load-env';

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
  Scope: ATLAS_DATABASES.SCOPES,
  Article: ATLAS_DATABASES.ARTICLES,
  Section: ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS,
  Category: ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS,

  // Primary (default target; may be overridden dynamically for agents)
  Core: ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS,
  'Active Data Controller': ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS,
  'Type Specification': ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS,

  // Supporting
  Annotation: ATLAS_DATABASES.ANNOTATIONS,
  'Action Tenet': ATLAS_DATABASES.TENETS,
  Scenario: ATLAS_DATABASES.SCENARIOS,
  'Scenario Variation': ATLAS_DATABASES.SCENARIO_VARIATIONS,
  'Active Data': ATLAS_DATABASES.ACTIVE_DATA,
  'Needed Research': ATLAS_DATABASES.NEEDED_RESEARCH,
};

function mapTypeToDatabaseName(type: unknown, isUnderAgentParentSection: boolean): string {
  if (typeof type === 'string') {
    if ((type === 'Core' || type === 'Active Data Controller') && isUnderAgentParentSection) {
      return ATLAS_DATABASES.AGENTS;
    }
    return TYPE_TO_DATABASE[type] ?? 'Unknown';
  }
  console.warn(`Unknown type: ${type}`);
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
function traverseAndCollectFlat(
  node: unknown,
  grouped: Map<string, FlatDoc[]>,
  ancestorUnderAgentParent: boolean,
): void {
  if (!isObject(node)) return;

  const type = node['type'];
  const docNo = node['docNo'];
  const name = node['name'];
  const uuid = node['uuid'] ?? null;

  // Determine whether current node is (or remains) under the Agent Parent Section
  const isAgentParentHere = typeof node['uuid'] === 'string' && AGENT_ROOT_SECTION_UUIDS.has(node['uuid']);
  const isUnderAgentParentSection = ancestorUnderAgentParent || isAgentParentHere;

  const databaseName = mapTypeToDatabaseName(type, isUnderAgentParentSection);
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
      for (const child of children) traverseAndCollectFlat(child, grouped, isUnderAgentParentSection);
    }
  }

  // Children under supportingDocuments
  const supporting = node['supportingDocuments'];
  if (isObject(supporting)) {
    for (const key of Object.keys(supporting)) {
      const children = getArrayProp(supporting, key);
      if (children) {
        for (const child of children) traverseAndCollectFlat(child, grouped, isUnderAgentParentSection);
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

/**
 * When enabled, recursively traverses standardized scope trees and sets every node's
 * `uuid` field to null. Keeps implementation isolated for easy removal.
 */
function omitUuidsInNode(node: unknown): void {
  if (!isObject(node)) return;

  if (Object.prototype.hasOwnProperty.call(node, 'uuid')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node as any)['uuid'] = null;
  }

  // Children on node
  for (const collectionName of childCollectionNames) {
    const children = getArrayProp(node, collectionName);
    if (children) {
      for (const child of children) omitUuidsInNode(child);
    }
  }

  // Children under supportingDocuments
  const supporting = (node as Record<string, unknown>)['supportingDocuments'];
  if (isObject(supporting)) {
    for (const key of Object.keys(supporting)) {
      const children = getArrayProp(supporting, key);
      if (children) {
        for (const child of children) omitUuidsInNode(child);
      }
    }
  }
}

/**
 * Load a map of notion_page_id → canonical_document_title from Supabase (current, non-archived rows).
 * Used to rewrite FlatDoc.name based on a document's uuid.
 */
async function loadCanonicalTitleMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase()
      .from('notion_database_pages_current')
      .select('notion_page_id,canonical_document_title,archived,in_trash,date_valid_to')
      .is('date_valid_to', null)
      .eq('archived', false)
      .eq('in_trash', false)
      .order('notion_page_id')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) throw new Error(`Failed to load canonical titles: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data as Array<{ notion_page_id: string; canonical_document_title: string | null }>) {
      if (row.notion_page_id && row.canonical_document_title) {
        map.set(row.notion_page_id, row.canonical_document_title);
      }
    }

    if (data.length < pageSize) break;
    page++;
  }

  return map;
}

async function main() {
  // Ensure environment variables (SUPABASE_URL, SUPABASE_API_KEY, etc.) are loaded for script execution
  loadEnv();

  const argv = process.argv.slice(2);
  const omitUuids = argv.includes('--omit-uuids');
  const positional = argv.filter((a) => !a.startsWith('--'));
  const inArg = positional[0];
  const outArg = positional[1];

  const inputDir = '.debug-data/standardized-atlas';
  const outputDir = '.debug-data/standardized-atlas/flat';

  const inputFileName = inArg ?? 'atlas.json';
  const outputFileName = outArg ?? 'atlas-supabase-scope-trees-standardized-flattened.json';

  const inputPath = path.join(inputDir, inputFileName);
  const outputPath = path.join(outputDir, outputFileName);

  console.log(`Reading: ${path.resolve(inputPath)}`);
  const trees = readJsonFile<unknown>(inputPath);
  assertIsArray(trees, 'StandardizedAtlasScopeTrees');

  if (omitUuids) {
    for (const root of trees) omitUuidsInNode(root);
  }

  const grouped = new Map<string, FlatDoc[]>();
  for (const root of trees as StandardizedAtlasScopeTrees) {
    traverseAndCollectFlat(root, grouped, false);
  }

  // Load map once and rewrite names based on uuid → canonical_document_title
  try {
    const canonicalTitleMap = await loadCanonicalTitleMap();
    for (const [, list] of grouped) {
      for (const item of list) {
        if (item.uuid && canonicalTitleMap.has(item.uuid)) {
          item.name = canonicalTitleMap.get(item.uuid)!;
        }
      }
    }
  } catch (e) {
    console.warn(`Warning: Failed to load canonical title map from Supabase. Proceeding without rewrite.`, e);
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
