#!/usr/bin/env node
/**
 * Debug Placeholder Documents
 *
 * This script specifically investigates what happens to Placeholder documents
 * during the tree building and conversion process.
 */

import { buildAtlasTree } from '@/app/server/atlas/atlas-tree-system';
import type { AtlasTreeNode, TreeConstructionOptions } from '@/app/server/atlas/atlas-tree-types';
import atlasNodeToStandardized from '@/app/server/atlas/json-export/atlas-node-tree-to-standardized-atlas-node-tree';
import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/atlas/load-atlas-from-supabase';
import { loadEnv } from '@/scripts/utils/load-env';

/**
 * Find all Placeholder documents in the tree and show their paths.
 */
function findPlaceholderDocuments(nodes: AtlasTreeNode[]): Array<{ uuid: string; name: string; path: string }> {
  const placeholders: Array<{ uuid: string; name: string; path: string }> = [];
  
  function traverse(node: AtlasTreeNode, path: string[]) {
    const currentPath = [...path, `${node.atlas_document_type}(${node.notion_page_id})`];
    
    if (node.atlas_document_type === 'Placeholder') {
      placeholders.push({
        uuid: node.notion_page_id || 'unknown',
        name: node.plain_text_name || 'unknown',
        path: currentPath.join(' → '),
      });
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
  
  return placeholders;
}

/**
 * Find all Placeholder documents in the standardized tree.
 */
function findPlaceholderDocumentsInStandardized(docs: any[]): Array<{ uuid: string; name: string; path: string }> {
  const placeholders: Array<{ uuid: string; name: string; path: string }> = [];
  
  function traverse(doc: any, path: string[]) {
    const currentPath = [...path, `${doc.type}(${doc.uuid})`];
    
    if (doc.type === 'Placeholder') {
      placeholders.push({
        uuid: doc.uuid || 'unknown',
        name: doc.name || 'unknown',
        path: currentPath.join(' → '),
      });
    }
    
    // Recursively traverse all child collections
    if (doc.articles) traverseChildren(doc.articles, currentPath);
    if (doc.sections) traverseChildren(doc.sections, currentPath);
    if (doc.categories) traverseChildren(doc.categories, currentPath);
    if (doc.coreDocuments) traverseChildren(doc.coreDocuments, currentPath);
    if (doc.activeDataControllers) traverseChildren(doc.activeDataControllers, currentPath);
    if (doc.typeSpecifications) traverseChildren(doc.typeSpecifications, currentPath);
    if (doc.placeholders) traverseChildren(doc.placeholders, currentPath);
    if (doc.scenarios) traverseChildren(doc.scenarios, currentPath);
    if (doc.scenarioVariations) traverseChildren(doc.scenarioVariations, currentPath);
    if (doc.supportingDocuments) {
      const supporting = doc.supportingDocuments;
      if (supporting.annotations) traverseChildren(supporting.annotations, currentPath);
      if (supporting.tenets) traverseChildren(supporting.tenets, currentPath);
      if (supporting.neededResearch) traverseChildren(supporting.neededResearch, currentPath);
      if (supporting.activeData) traverseChildren(supporting.activeData, currentPath);
    }
  }
  
  function traverseChildren(children: any[], path: string[]) {
    for (const child of children) {
      traverse(child, path);
    }
  }
  
  for (const doc of docs) {
    traverse(doc, []);
  }
  
  return placeholders;
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

  // Convert to standardized format
  const standardizedScopeTrees = originalScopeTrees.map((scopeNode) =>
    atlasNodeToStandardized(scopeNode),
  );

  console.log('=== PLACEHOLDER DOCUMENTS IN ORIGINAL TREE ===');
  const originalPlaceholders = findPlaceholderDocuments(originalScopeTrees);
  console.log(`Found ${originalPlaceholders.length} Placeholder documents in original tree:`);
  originalPlaceholders.forEach((placeholder, i) => {
    console.log(`  ${i + 1}. ${placeholder.name} (${placeholder.uuid})`);
    console.log(`     Path: ${placeholder.path}`);
  });

  console.log('\n=== PLACEHOLDER DOCUMENTS IN STANDARDIZED TREE ===');
  const standardizedPlaceholders = findPlaceholderDocumentsInStandardized(standardizedScopeTrees);
  console.log(`Found ${standardizedPlaceholders.length} Placeholder documents in standardized tree:`);
  standardizedPlaceholders.forEach((placeholder, i) => {
    console.log(`  ${i + 1}. ${placeholder.name} (${placeholder.uuid})`);
    console.log(`     Path: ${placeholder.path}`);
  });

  console.log('\n=== SUMMARY ===');
  console.log(`Original tree: ${originalPlaceholders.length} Placeholder documents`);
  console.log(`Standardized tree: ${standardizedPlaceholders.length} Placeholder documents`);
  console.log(`Lost during conversion: ${originalPlaceholders.length - standardizedPlaceholders.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
