#!/usr/bin/env node
/**
 * Debug Tree Duplication
 *
 * This script investigates why the tree building process is counting more documents
 * than exist in the database, suggesting duplication in the tree structure.
 */

import { buildAtlasTree } from '@/app/server/atlas/atlas-tree-system';
import type { AtlasTreeNode, TreeConstructionOptions } from '@/app/server/atlas/atlas-tree-types';
import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/atlas/load-atlas-from-supabase';
import { loadEnv } from '@/scripts/utils/load-env';

/**
 * Collect all document UUIDs from AtlasTreeNode tree structure and detect duplicates.
 */
function analyzeTreeDuplication(nodes: AtlasTreeNode[]): {
  totalNodes: number;
  uniqueUuids: number;
  duplicates: Map<string, number>;
  duplicateUuids: string[];
} {
  const uuidCounts = new Map<string, number>();
  let totalNodes = 0;
  
  function traverse(node: AtlasTreeNode) {
    totalNodes += 1;
    
    if (node.notion_page_id) {
      const count = uuidCounts.get(node.notion_page_id) || 0;
      uuidCounts.set(node.notion_page_id, count + 1);
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
  
  const duplicates = new Map<string, number>();
  const duplicateUuids: string[] = [];
  
  for (const [uuid, count] of uuidCounts.entries()) {
    if (count > 1) {
      duplicates.set(uuid, count);
      duplicateUuids.push(uuid);
    }
  }
  
  return {
    totalNodes,
    uniqueUuids: uuidCounts.size,
    duplicates,
    duplicateUuids,
  };
}

/**
 * Find specific documents that are duplicated and show their paths in the tree.
 */
function findDuplicatePaths(nodes: AtlasTreeNode[], targetUuid: string): string[] {
  const paths: string[] = [];
  
  function traverse(node: AtlasTreeNode, path: string[]) {
    const currentPath = [...path, `${node.atlas_document_type}(${node.notion_page_id})`];
    
    if (node.notion_page_id === targetUuid) {
      paths.push(currentPath.join(' → '));
    }
    
    // Recursively traverse all child collections
    traverseChildren(node.scopes, currentPath);
    traverseChildren(node.articles, currentPath);
    traverseChildren(node.sectionsAndPrimaryDocs, currentPath);
    traverseChildren(node.annotations, currentPath);
    traverseChildren(node.tenets, currentPath);
    traverseChildren(node.scenarios, currentPath);
    traverseChildren(node.scenarioVariations, currentPath);
    traverseChildren(node.activeData, currentPath);
    traverseChildren(node.agentScopeDocs, currentPath);
    traverseChildren(node.neededResearch, currentPath);
  }
  
  function traverseChildren(children: AtlasTreeNode[], path: string[]) {
    for (const child of children) {
      traverse(child, path);
    }
  }
  
  for (const node of nodes) {
    traverse(node, []);
  }
  
  return paths;
}

async function main() {
  loadEnv();

  // Load Atlas data and build tree
  console.log('=== LOADING ATLAS DATA ===');
  const atlasData = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();

  const options: TreeConstructionOptions = {
    reportMissingChildNodes: false,
    reportOrphanedNodes: true,
  };

  const result = buildAtlasTree(atlasData, options);
  const originalScopeTrees = result.scopeTrees;

  console.log('=== ANALYZING TREE DUPLICATION ===');
  const analysis = analyzeTreeDuplication(originalScopeTrees);

  console.log(`Total nodes in tree: ${analysis.totalNodes}`);
  console.log(`Unique UUIDs: ${analysis.uniqueUuids}`);
  console.log(`Duplicated UUIDs: ${analysis.duplicateUuids.length}`);
  console.log(`Duplication factor: ${(analysis.totalNodes / analysis.uniqueUuids).toFixed(2)}x`);

  if (analysis.duplicateUuids.length > 0) {
    console.log('\n=== DUPLICATE DOCUMENTS ===');
    console.log('Top 10 most duplicated documents:');
    
    const sortedDuplicates = Array.from(analysis.duplicates.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    for (const [uuid, count] of sortedDuplicates) {
      console.log(`  ${uuid}: ${count} times`);
    }

    // Show paths for the most duplicated document
    if (sortedDuplicates.length > 0) {
      const [mostDuplicatedUuid, count] = sortedDuplicates[0];
      console.log(`\n=== PATHS FOR MOST DUPLICATED DOCUMENT (${mostDuplicatedUuid}) ===`);
      const paths = findDuplicatePaths(originalScopeTrees, mostDuplicatedUuid);
      console.log(`Found ${paths.length} paths (expected ${count}):`);
      paths.slice(0, 5).forEach((path, i) => {
        console.log(`  ${i + 1}. ${path}`);
      });
      if (paths.length > 5) {
        console.log(`  ... and ${paths.length - 5} more paths`);
      }
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log(`Database has 5728 unique documents`);
  console.log(`Tree has ${analysis.totalNodes} total nodes (${analysis.uniqueUuids} unique)`);
  console.log(`Expected tree nodes: 5728`);
  console.log(`Actual tree nodes: ${analysis.totalNodes}`);
  console.log(`Extra nodes: ${analysis.totalNodes - 5728}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
