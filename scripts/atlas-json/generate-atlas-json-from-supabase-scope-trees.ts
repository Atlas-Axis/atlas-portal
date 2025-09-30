#!/usr/bin/env node
/**
 * CLI: Standardize Atlas Scope Trees from Supabase
 *
 * Description
 * - Reads raw Scope trees produced by `scripts/atlas-build.ts` (which uses `buildAtlasTreeWithValidation`)
 *   from `.debug-data/atlas-raw-sources/atlas-supabase-scope-trees.json`.
 * - Converts each node from `AtlasTreeNode` shape to a simplified `StandardizedAtlasDocument` shape.
 * - Writes the standardized trees to `.debug-data/standardized-atlas/atlas-supabase-scope-trees-standardized.json`.
 * - Logs summary statistics including total documents and counts of missing/empty key fields.
 *
 * Input (source format)
 * - File: `.debug-data/atlas-raw-sources/atlas-supabase-scope-trees.json`
 * - Type: `AtlasTreeNode[]` roots representing Scope documents
 * - Important `AtlasTreeNode` fields used:
 *   - `atlas_document_type` → enum `AtlasDocumentType`
 *   - `generatedDocID` (fallback to `atlas_document_number` if missing)
 *   - `generatedDocName` (fallback to `plain_text_name` if missing)
 *   - `notion_page_id`
 *   - Child arrays: `scopes`, `articles`, `sectionsAndPrimaryDocs`, `annotations`,
 *     `tenets`, `scenarios`, `scenarioVariations`, `activeData`, `agentScopeDocs`, `neededResearch`
 *
 * Output (result format)
 * - File: `.debug-data/standardized-atlas/atlas-supabase-scope-trees-standardized.json`
 * - Type: `StandardizedAtlasDocument[]` (same child array names as input)
 * - Field mapping per node:
 *   - `type`   ← `atlas_document_type`
 *   - `docNo`  ← `generatedDocID` (or `atlas_document_number` if missing)
 *   - `name`   ← `generatedDocName` (or `plain_text_name` if missing)
 *   - `uuid`   ← `notion_page_id`
 *
 * How to run
 * ```bash
 * npx tsx scripts/atlas-json/generate-atlas-json-from-supabase-scope-trees.ts
 * ```
 * Ensure the input file exists (generate it first via `npx tsx scripts/atlas-build.ts`).
 */
import fs from 'fs';
import path from 'path';
import type { AtlasTreeNode } from '@/app/server/atlas/atlas-tree-types';
import { AtlasDocumentType } from '@/app/server/atlas/constants';

/**
 * A simplified, standardized representation of an Atlas document used for downstream processing.
 */
interface StandardizedAtlasDocument {
  type: AtlasDocumentType;
  docNo: string;
  name: string;
  uuid: string | null;

  // Children (recursive)
  scopes: StandardizedAtlasDocument[];
  articles: StandardizedAtlasDocument[];
  sectionsAndPrimaryDocs: StandardizedAtlasDocument[];
  annotations: StandardizedAtlasDocument[];
  tenets: StandardizedAtlasDocument[];
  scenarios: StandardizedAtlasDocument[];
  scenarioVariations: StandardizedAtlasDocument[];
  activeData: StandardizedAtlasDocument[];
  agentScopeDocs: StandardizedAtlasDocument[];
  neededResearch: StandardizedAtlasDocument[];
}

/** Root array of standardized Scope trees. */
type StandardizedAtlasScopeTrees = StandardizedAtlasDocument[];

/**
 * Convert an `AtlasTreeNode` to a `StandardizedAtlasDocument`, recursively mapping children.
 */
function convertNode(node: AtlasTreeNode): StandardizedAtlasDocument {
  const standardized: StandardizedAtlasDocument = {
    type: node.atlas_document_type,
    docNo: node.generatedDocID ?? node.atlas_document_number ?? '',
    name: node.generatedDocName ?? node.plain_text_name ?? '',
    uuid: node.notion_page_id ?? null,

    scopes: node.scopes.map(convertNode),
    articles: node.articles.map(convertNode),
    sectionsAndPrimaryDocs: node.sectionsAndPrimaryDocs.map(convertNode),
    annotations: node.annotations.map(convertNode),
    tenets: node.tenets.map(convertNode),
    scenarios: node.scenarios.map(convertNode),
    scenarioVariations: node.scenarioVariations.map(convertNode),
    activeData: node.activeData.map(convertNode),
    agentScopeDocs: node.agentScopeDocs.map(convertNode),
    neededResearch: node.neededResearch.map(convertNode),
  };

  return standardized;
}

/**
 * Count all nodes in the standardized forest (roots and all descendants).
 */
function countDocuments(nodes: StandardizedAtlasDocument[]): number {
  let count = 0;
  const stack: StandardizedAtlasDocument[] = [...nodes];
  while (stack.length > 0) {
    const current = stack.pop()!;
    count += 1;
    stack.push(
      ...current.scopes,
      ...current.articles,
      ...current.sectionsAndPrimaryDocs,
      ...current.annotations,
      ...current.tenets,
      ...current.scenarios,
      ...current.scenarioVariations,
      ...current.activeData,
      ...current.agentScopeDocs,
      ...current.neededResearch,
    );
  }
  return count;
}

/**
 * Count documents where key fields are missing/empty.
 * - uuid: null or empty string
 * - type: falsy
 * - docNo: missing or empty string
 */
function countMissingFields(nodes: StandardizedAtlasDocument[]): { uuid: number; type: number; docNo: number } {
  let missingUuid = 0;
  let missingType = 0;
  let missingDocNo = 0;

  const stack: StandardizedAtlasDocument[] = [...nodes];
  while (stack.length > 0) {
    const current = stack.pop()!;

    const uuidEmpty = current.uuid == null || (typeof current.uuid === 'string' && current.uuid.trim().length === 0);
    if (uuidEmpty) missingUuid += 1;

    const typeEmpty = !current.type;
    if (typeEmpty) missingType += 1;

    const docNoEmpty = !current.docNo || current.docNo.trim().length === 0;
    if (docNoEmpty) missingDocNo += 1;

    stack.push(
      ...current.scopes,
      ...current.articles,
      ...current.sectionsAndPrimaryDocs,
      ...current.annotations,
      ...current.tenets,
      ...current.scenarios,
      ...current.scenarioVariations,
      ...current.activeData,
      ...current.agentScopeDocs,
      ...current.neededResearch,
    );
  }

  return { uuid: missingUuid, type: missingType, docNo: missingDocNo };
}

/**
 * Entry point.
 * - Reads input JSON, standardizes, writes output JSON, prints summary stats.
 */
async function main() {
  const inputDir = '.debug-data/atlas-raw-sources';
  const inputFile = path.join(inputDir, 'atlas-supabase-scope-trees.json');
  const outputDir = '.debug-data/standardized-atlas';
  const outputFile = path.join(outputDir, 'atlas-supabase-scope-trees-standardized.json');

  if (!fs.existsSync(inputFile)) {
    console.error(`Input file not found: ${inputFile}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputFile, 'utf8');
  const scopeTrees: AtlasTreeNode[] = JSON.parse(raw);

  const standardizedTrees: StandardizedAtlasScopeTrees = scopeTrees.map(convertNode);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(standardizedTrees, null, 2), 'utf8');

  const totalDocs = countDocuments(standardizedTrees);
  console.log(`Standardized ${standardizedTrees.length} root scope trees`);
  console.log(`Total documents (including all descendants): ${totalDocs}`);
  const missing = countMissingFields(standardizedTrees);
  if (missing.uuid > 0) console.log(`Missing/empty uuid fields: ${missing.uuid}`);
  if (missing.type > 0) console.log(`Missing/empty type fields: ${missing.type}`);
  if (missing.docNo > 0) console.log(`Missing/empty docNo fields: ${missing.docNo}`);
  console.log(`Wrote standardized JSON to ${outputFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
