#!/usr/bin/env node
/**
 * CLI: Standardize Atlas Scope Trees from Supabase
 *
 * Description
 * - Reads Atlas Scope trees produced by `buildAtlasTree(await loadAtlasFromSupabaseWithNestingAgentsUnderSection())`
 * - Converts each node from `AtlasTreeNode` shape to a simplified `StandardizedAtlasDocument` shape.
 * - Writes the standardized trees to `.debug-data/standardized-atlas/atlas-supabase-scope-trees-standardized.json`.
 * - Logs summary statistics including total documents and counts of missing/empty key fields.
 *
 * Input
 * - Supabase: `buildAtlasTree(await loadAtlasFromSupabaseWithNestingAgentsUnderSection())`
 * - Type: `AtlasTreeNode[]` roots representing Scope documents
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
 * npx tsx scripts/atlas-json/hierarchical/generate-atlas-json-from-supabase-scope-trees.ts
 * npx tsx scripts/atlas-json/hierarchical/generate-atlas-json-from-supabase-scope-trees.ts --omit-agents
 * ```
 */
import fs from 'fs';
import path from 'path';
import { buildAtlasTree } from '@/app/server/atlas/atlas-tree-system';
import { type AtlasTreeNode } from '@/app/server/atlas/atlas-tree-types';
import type { TreeConstructionOptions } from '@/app/server/atlas/atlas-tree-types';
import atlasNodeToStandardized from '@/app/server/atlas/json-export/atlas-node-tree-to-standardized-atlas-node-tree';
import { StandardizedAtlasDocument, StandardizedAtlasScopeTrees } from '@/app/server/atlas/json-export/types';
import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/atlas/load-atlas-from-supabase';
import { loadEnv } from '@/scripts/utils/load-env';

/**
 * Convert an `AtlasTreeNode` to a `StandardizedAtlasDocument`, recursively mapping children.
 */
type ConvertOptions = {
  omitAgents: boolean;
  prunedCounter: { count: number };
};

function convertNode(node: AtlasTreeNode, options?: ConvertOptions): StandardizedAtlasDocument {
  return atlasNodeToStandardized(node, options);
}

/**
 * Entry point.
 * - Reads input JSON, standardizes, writes output JSON, prints summary stats.
 */
async function main() {
  const omitAgents = process.argv.includes('--omit-agents');
  const prunedCounter = { count: 0 };

  const outputDir = '.debug-data/standardized-atlas';
  const outputFile = path.join(
    outputDir,
    omitAgents
      ? 'atlas-supabase-scope-trees-standardized-without-agents.json'
      : 'atlas-supabase-scope-trees-standardized.json',
  );

  loadEnv();

  // Load Atlas data from Supabase
  const atlasData = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();

  // Configure options
  const options: TreeConstructionOptions = {
    reportMissingChildNodes: false,
    reportOrphanedNodes: true,
  };

  // Build tree structure with document numbering and validation
  const result = buildAtlasTree(atlasData, options);
  const scopeTrees = result.scopeTrees;
  console.log(`Built ${result.scopeTrees.length} scope trees`);

  // Convert Scope trees to standardized JSON format
  const standardizedTrees: StandardizedAtlasScopeTrees = scopeTrees.map((scopeNode) =>
    convertNode(scopeNode, { omitAgents, prunedCounter }),
  );

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(standardizedTrees, null, 2), 'utf8');

  console.log(`Standardized ${standardizedTrees.length} root scope trees`);
  if (omitAgents) {
    console.log(`Omitted agent subtrees from ${prunedCounter.count} root node(s)`);
  }
  console.log(`Wrote standardized JSON to ${outputFile}`);

  // TODO: Verify that the original and standardized have the same total document count
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
