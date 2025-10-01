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
import { buildAtlasTree } from '@/app/server/atlas/atlas-tree-system';
import type { AtlasTreeNode, TreeConstructionOptions } from '@/app/server/atlas/atlas-tree-types';
import atlasNodeToStandardized from '@/app/server/atlas/json-export/atlas-node-tree-to-standardized-atlas-node-tree';
import type { StandardizedAtlasDocument, StandardizedAtlasScopeTrees } from '@/app/server/atlas/json-export/types';
import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/atlas/load-atlas-from-supabase';
import { loadEnv } from '@/scripts/utils/load-env';

/**
 * Recursively count all documents in an AtlasTreeNode tree structure.
 */
function countOriginalDocuments(nodes: AtlasTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1; // Count this node
    // Recursively count all child collections
    count += countOriginalDocuments(node.scopes);
    count += countOriginalDocuments(node.articles);
    count += countOriginalDocuments(node.sectionsAndPrimaryDocs);
    count += countOriginalDocuments(node.annotations);
    count += countOriginalDocuments(node.tenets);
    count += countOriginalDocuments(node.scenarios);
    count += countOriginalDocuments(node.scenarioVariations);
    count += countOriginalDocuments(node.activeData);
    count += countOriginalDocuments(node.agentScopeDocs);
    count += countOriginalDocuments(node.neededResearch);
  }
  return count;
}

/**
 * Recursively count all documents in a StandardizedAtlasDocument tree structure.
 */
function countStandardizedDocuments(docs: StandardizedAtlasDocument[]): number {
  let count = 0;
  for (const doc of docs) {
    count += 1; // Count this document

    // Recursively count all child collections based on document type
    if ('articles' in doc && doc.articles) {
      count += countStandardizedDocuments(doc.articles);
    }
    if ('sections' in doc && doc.sections) {
      count += countStandardizedDocuments(doc.sections);
    }
    if ('categories' in doc && doc.categories) {
      count += countStandardizedDocuments(doc.categories);
    }
    if ('coreDocuments' in doc && doc.coreDocuments) {
      count += countStandardizedDocuments(doc.coreDocuments);
    }
    if ('activeDataControllers' in doc && doc.activeDataControllers) {
      count += countStandardizedDocuments(doc.activeDataControllers);
    }
    if ('typeSpecifications' in doc && doc.typeSpecifications) {
      count += countStandardizedDocuments(doc.typeSpecifications);
    }
    if ('scenarios' in doc && doc.scenarios) {
      count += countStandardizedDocuments(doc.scenarios);
    }
    if ('scenarioVariations' in doc && doc.scenarioVariations) {
      count += countStandardizedDocuments(doc.scenarioVariations);
    }
    if ('supportingDocuments' in doc && doc.supportingDocuments) {
      const supporting = doc.supportingDocuments;
      if (supporting.annotations) count += countStandardizedDocuments(supporting.annotations);
      if (supporting.tenets) count += countStandardizedDocuments(supporting.tenets);
      if (supporting.neededResearch) count += countStandardizedDocuments(supporting.neededResearch);
      if ('activeData' in supporting && supporting.activeData)
        count += countStandardizedDocuments(supporting.activeData);
    }
  }
  return count;
}

/**
 * Entry point.
 * - Reads data from Supabase, builds Atlas tree, converts to standardized format, writes output JSON, prints summary stats.
 */
async function main() {
  const outputDir = '.debug-data/standardized-atlas';
  const outputFile = path.join('atlas-supabase-scope-trees-standardized.json');

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
  const originalScopeTrees = result.scopeTrees;
  console.log(`Built ${result.scopeTrees.length} scope trees`);

  // Convert Scope trees to standardized JSON format
  const standardizedScopeTrees: StandardizedAtlasScopeTrees = originalScopeTrees.map((scopeNode) =>
    atlasNodeToStandardized(scopeNode),
  );

  // Verify document counts match between original and standardized trees
  const originalCount = countOriginalDocuments(originalScopeTrees);
  const standardizedCount = countStandardizedDocuments(standardizedScopeTrees);

  if (originalCount !== standardizedCount) {
    console.error(`❌ Document count mismatch! Original: ${originalCount}, Standardized: ${standardizedCount}`);
  } else {
    console.log(`✅ Document counts match: ${originalCount} documents in both trees`);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(standardizedScopeTrees, null, 2), 'utf8');

  console.log(`Standardized ${standardizedScopeTrees.length} root scope trees`);
  console.log(`Wrote standardized JSON to ${outputFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
