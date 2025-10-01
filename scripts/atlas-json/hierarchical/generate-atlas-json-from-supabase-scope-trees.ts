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
 * Recursively count all unique documents in an AtlasTreeNode tree structure.
 * Uses a Set to track unique UUIDs to avoid counting duplicates.
 */
function countOriginalDocuments(nodes: AtlasTreeNode[]): number {
  const uniqueUuids = new Set<string>();

  function traverse(node: AtlasTreeNode) {
    if (node.notion_page_id) {
      uniqueUuids.add(node.notion_page_id);
    }

    // Recursively traverse all child collections
    traverseChildren(node.scopes);
    traverseChildren(node.articles);
    traverseChildren(node.sectionsAndPrimaryDocs);
    traverseChildren(node.annotations);
    traverseChildren(node.tenets);
    traverseChildren(node.scenarios);
    traverseChildren(node.scenarioVariations);
    traverseChildren(node.activeData);
    traverseChildren(node.agentScopeDocs);
    traverseChildren(node.neededResearch);
  }

  function traverseChildren(children: AtlasTreeNode[]) {
    for (const child of children) {
      traverse(child);
    }
  }

  for (const node of nodes) {
    traverse(node);
  }

  return uniqueUuids.size;
}

/**
 * Recursively count all unique documents in a StandardizedAtlasDocument tree structure.
 * Uses a Set to track unique UUIDs to avoid counting duplicates.
 */
function countStandardizedDocuments(docs: StandardizedAtlasDocument[]): number {
  const uniqueUuids = new Set<string>();

  function traverse(doc: StandardizedAtlasDocument) {
    if (doc.uuid) {
      uniqueUuids.add(doc.uuid);
    }

    // Recursively traverse all child collections based on document type
    if ('articles' in doc && doc.articles) {
      traverseChildren(doc.articles);
    }
    if ('sections' in doc && doc.sections) {
      traverseChildren(doc.sections);
    }
    if ('categories' in doc && doc.categories) {
      traverseChildren(doc.categories);
    }
    if ('coreDocuments' in doc && doc.coreDocuments) {
      traverseChildren(doc.coreDocuments);
    }
    if ('activeDataControllers' in doc && doc.activeDataControllers) {
      traverseChildren(doc.activeDataControllers);
    }
    if ('typeSpecifications' in doc && doc.typeSpecifications) {
      traverseChildren(doc.typeSpecifications);
    }
    if ('placeholders' in doc && doc.placeholders) {
      traverseChildren(doc.placeholders);
    }
    if ('scenarios' in doc && doc.scenarios) {
      traverseChildren(doc.scenarios);
    }
    if ('scenarioVariations' in doc && doc.scenarioVariations) {
      traverseChildren(doc.scenarioVariations);
    }
    if ('supportingDocuments' in doc && doc.supportingDocuments) {
      const supporting = doc.supportingDocuments;
      if (supporting.annotations) traverseChildren(supporting.annotations);
      if (supporting.tenets) traverseChildren(supporting.tenets);
      if (supporting.neededResearch) traverseChildren(supporting.neededResearch);
      if ('activeData' in supporting && supporting.activeData) {
        traverseChildren(supporting.activeData);
      }
    }
  }

  function traverseChildren(children: StandardizedAtlasDocument[]) {
    for (const child of children) {
      traverse(child);
    }
  }

  for (const doc of docs) {
    traverse(doc);
  }

  return uniqueUuids.size;
}

/**
 * Entry point.
 * - Reads data from Supabase, builds Atlas tree, converts to standardized format, writes output JSON, prints summary stats.
 */
async function main() {
  const outputDir = '.debug-data/standardized-atlas';
  const outputFile = path.join(outputDir, 'atlas-supabase-scope-trees-standardized.json');

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

  // Log orphaned nodes with detailed information
  if (result.orphanedNodes.length > 0) {
    console.warn(`⚠️  Found ${result.orphanedNodes.length} orphaned nodes:`);
    for (const orphanedNode of result.orphanedNodes) {
      console.warn(
        `   - ${orphanedNode.atlas_document_type}: "${orphanedNode.plain_text_name}" (UUID: ${orphanedNode.notion_page_id})`,
      );
    }
  } else {
    console.log('✅ No orphaned nodes found');
  }

  // Convert Scope trees to standardized JSON format
  const standardizedScopeTrees: StandardizedAtlasScopeTrees = originalScopeTrees.map((scopeNode) =>
    atlasNodeToStandardized(scopeNode),
  );

  // Convert orphaned nodes to standardized format
  const standardizedOrphanedNodes: StandardizedAtlasDocument[] = result.orphanedNodesAsTreeNodes.map((orphanedNode) => {
    return atlasNodeToStandardized(orphanedNode);
  });

  // Verify document counts match between original and standardized trees
  const originalCount = countOriginalDocuments(originalScopeTrees) + result.orphanedNodes.length;
  const standardizedCount =
    countStandardizedDocuments(standardizedScopeTrees) + countStandardizedDocuments(standardizedOrphanedNodes);

  if (originalCount !== standardizedCount) {
    console.error(`❌ Document count mismatch! Original: ${originalCount}, Standardized: ${standardizedCount}`);
  } else {
    console.log(`✅ Document counts match: ${originalCount} documents in both trees`);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(standardizedScopeTrees, null, 2), 'utf8');

  console.log(`Standardized ${standardizedScopeTrees.length} root scope trees`);
  console.log(`Excluded ${standardizedOrphanedNodes.length} orphaned nodes`);
  console.log(`Wrote standardized JSON to ${outputFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
