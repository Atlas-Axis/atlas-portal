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
function countUniqueDocuments(nodes: AtlasTreeNode[]): number {
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
 * This function correctly handles the case where the same document appears multiple times
 * in the tree due to duplicated nodes (e.g., Needed Research documents that can appear
 * under multiple parents).
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
    if ('core_documents' in doc && doc.core_documents) {
      traverseChildren(doc.core_documents);
    }
    if ('active_data_controllers' in doc && doc.active_data_controllers) {
      traverseChildren(doc.active_data_controllers);
    }
    if ('type_specifications' in doc && doc.type_specifications) {
      traverseChildren(doc.type_specifications);
    }
    if ('scenarios' in doc && doc.scenarios) {
      traverseChildren(doc.scenarios);
    }
    if ('scenario_variations' in doc && doc.scenario_variations) {
      traverseChildren(doc.scenario_variations);
    }
    // annotations, tenets, neededResearch, activeData are supporting documents
    if ('annotations' in doc && doc.annotations) {
      traverseChildren(doc.annotations);
    }
    if ('tenets' in doc && doc.tenets) {
      traverseChildren(doc.tenets);
    }
    if ('needed_research' in doc && doc.needed_research) {
      traverseChildren(doc.needed_research);
    }
    if ('active_data' in doc && doc.active_data) {
      traverseChildren(doc.active_data);
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

  // Log duplicated nodes with detailed information
  if (result.duplicatedNodes.length > 0) {
    console.warn(`⚠️  Found ${result.duplicatedNodes.length} duplicated nodes:`);

    // Group duplicated nodes by the duplicated node ID for better readability
    const duplicatesByNodeId = new Map<string, { parentId: string; node: AtlasTreeNode }[]>();
    for (const duplicate of result.duplicatedNodes) {
      const nodeId = duplicate.node.notion_page_id;
      if (!duplicatesByNodeId.has(nodeId)) {
        duplicatesByNodeId.set(nodeId, []);
      }
      duplicatesByNodeId.get(nodeId)!.push(duplicate);
    }

    // Convert to array and limit display to first 20 entries
    const duplicateEntries = Array.from(duplicatesByNodeId.entries());
    const maxDisplay = 20;
    const entriesToShow = duplicateEntries.slice(0, maxDisplay);
    const remainingCount = duplicateEntries.length - maxDisplay;

    for (const [nodeId, duplicates] of entriesToShow) {
      const node = duplicates[0].node;
      console.warn(`   📄 ${node.atlas_document_type}: "${node.plain_text_name}" (UUID: ${nodeId})`);
      console.warn(`      Document Number: ${node.atlas_document_number || 'N/A'}`);
      console.warn(`      Generated Doc ID: ${node.generatedDocID || 'N/A'}`);
      console.warn(`      Appears under ${duplicates.length} different parents:`);

      for (const duplicate of duplicates) {
        console.warn(`        - Parent UUID: ${duplicate.parentId}`);
      }
    }

    if (remainingCount > 0) {
      console.warn(`   ...and ${remainingCount} more duplicated nodes`);
    }
  } else {
    console.log('✅ No duplicated nodes found');
  }

  // Convert Scope trees to standardized JSON format
  const standardizedScopeTrees: StandardizedAtlasScopeTrees = originalScopeTrees.map((scopeNode) =>
    atlasNodeToStandardized(scopeNode),
  );

  // Convert orphaned nodes to standardized format
  const standardizedOrphanedNodes: StandardizedAtlasDocument[] = result.orphanedNodesAsTreeNodes.map((orphanedNode) => {
    try {
      return atlasNodeToStandardized(orphanedNode);
    } catch (error) {
      console.warn(`Failed to convert orphaned node ${orphanedNode.notion_page_id}: ${error}`);
      // Return a minimal document for counting purposes
      return {
        type: orphanedNode.atlas_document_type,
        doc_no: orphanedNode.generatedDocID ?? orphanedNode.atlas_document_number ?? '',
        name: orphanedNode.generatedDocName ?? orphanedNode.plain_text_name ?? '',
        uuid: orphanedNode.notion_page_id ?? null,
        content: orphanedNode.plain_text_content ?? '',
      } as StandardizedAtlasDocument;
    }
  });

  // Verify document counts match between original and standardized trees
  const uniqueDocumentCount = countUniqueDocuments(originalScopeTrees);
  const originalOrphanedCount = result.orphanedNodes.length;
  const uniqueCount = uniqueDocumentCount + originalOrphanedCount;

  const standardizedDocumentCount = countStandardizedDocuments(standardizedScopeTrees);
  const standardizedOrphanedCount = countStandardizedDocuments(standardizedOrphanedNodes);
  const standardizedCount = standardizedDocumentCount + standardizedOrphanedCount;

  console.log(`📊 Count breakdown:`);
  console.log(`   Unique documents: ${uniqueDocumentCount}`);
  console.log(`   Original orphaned: ${originalOrphanedCount}`);
  console.log(`   Duplicated nodes: ${result.duplicatedNodes.length}`);
  console.log(`   Unique documents: ${uniqueCount}`);
  console.log(`   Standardized documents: ${standardizedDocumentCount}`);
  console.log(`   Standardized orphaned: ${standardizedOrphanedCount}`);
  console.log(`   Standardized total: ${standardizedCount}`);

  if (uniqueCount !== standardizedCount) {
    console.error(`❌ Document count mismatch! Original: ${uniqueCount}, Standardized: ${standardizedCount}`);
  } else {
    console.log(`✅ Document counts match: ${uniqueCount} documents in both trees`);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(standardizedScopeTrees, null, 2), 'utf8');

  console.log(`Standardized ${standardizedScopeTrees.length} root scope trees`);
  console.log(`Excluded ${standardizedOrphanedNodes.length} orphaned nodes`);
  console.log(`Wrote standardized JSON to ${outputFile}`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
