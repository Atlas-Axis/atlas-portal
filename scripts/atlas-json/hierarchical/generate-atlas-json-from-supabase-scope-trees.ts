#!/usr/bin/env node
/**
 * CLI: Standardize Atlas Scope Trees from Supabase
 *
 * Description
 * - Reads Atlas Scope trees produced by `buildAtlasTree(await loadAtlasFromSupabaseWithNestingAgentsUnderSection())`
 * - Converts each node from `AtlasTreeNode` shape to a simplified `StandardizedAtlasDocument` shape.
 * - Writes the standardized trees to `.debug-data/standardized-atlas/atlas-supabase-scope-trees-standardized.json`.
 *
 * Input
 * - Supabase: `buildAtlasTree(await loadAtlasFromSupabaseWithNestingAgentsUnderSection())`
 * - Type: `AtlasTreeNode[]` roots representing Scope documents
 *
 * Output (result format)
 * - File: `.debug-data/standardized-atlas/atlas-supabase-scope-trees-standardized.json`
 * - Type: `StandardizedAtlasDocument[]` (same child array names as input)
 *
 * How to run
 * ```bash
 * npx tsx scripts/atlas-json/hierarchical/generate-atlas-json-from-supabase-scope-trees.ts
 * ```
 */
import fs from 'fs';
import path from 'path';
import { buildAtlasJSON } from '@/app/server/atlas/atlas-json-exporter';
import { loadEnv } from '@/scripts/utils/load-env';

/**
 * Entry point.
 * - Reads data from Supabase, builds Atlas tree, converts to standardized format, writes output JSON, prints summary stats.
 */
async function main() {
  const outputDir = '.debug-data/standardized-atlas';
  const outputFile = path.join('atlas-supabase-scope-trees-standardized.json');

  loadEnv();

  // Load Atlas data from Supabase
  const standardizedScopeTrees = await buildAtlasJSON();

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(standardizedScopeTrees, null, 2), 'utf8');

  console.log(`Standardized ${standardizedScopeTrees.length} root scope trees`);
  console.log(`Wrote standardized JSON to ${outputFile}`);

  // TODO: Verify that the original and standardized have the same total document count
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
