#!/usr/bin/env node
/**
 * Debug Placeholder in All Arrays
 *
 * This script checks all child arrays to find where the Placeholder document
 * is actually stored.
 */

import { buildAtlasTree } from '@/app/server/atlas/atlas-tree-system';
import type { AtlasTreeNode, TreeConstructionOptions } from '@/app/server/atlas/atlas-tree-types';
import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/atlas/load-atlas-from-supabase';
import { loadEnv } from '@/scripts/utils/load-env';

const PLACEHOLDER_UUID = '27ff2ff0-8d73-807c-acb2-c2a5e4c4dea3';

/**
 * Find which array contains the Placeholder document.
 */
function findPlaceholderInAllArrays(nodes: AtlasTreeNode[]): Array<{
  containerUuid: string;
  containerName: string;
  containerType: string;
  arrayName: string;
  placeholderIndex: number;
}> {
  const containers: Array<{
    containerUuid: string;
    containerName: string;
    containerType: string;
    arrayName: string;
    placeholderIndex: number;
  }> = [];
  
  function traverse(node: AtlasTreeNode) {
    // Check all child arrays
    const arrays = [
      { name: 'scopes', children: node.scopes },
      { name: 'articles', children: node.articles },
      { name: 'sectionsAndPrimaryDocs', children: node.sectionsAndPrimaryDocs },
      { name: 'annotations', children: node.annotations },
      { name: 'tenets', children: node.tenets },
      { name: 'scenarios', children: node.scenarios },
      { name: 'scenarioVariations', children: node.scenarioVariations },
      { name: 'activeData', children: node.activeData },
      { name: 'agentScopeDocs', children: node.agentScopeDocs },
      { name: 'neededResearch', children: node.neededResearch },
    ];
    
    for (const array of arrays) {
      const placeholderIndex = array.children.findIndex(child => 
        child.notion_page_id === PLACEHOLDER_UUID
      );
      
      if (placeholderIndex !== -1) {
        containers.push({
          containerUuid: node.notion_page_id || 'unknown',
          containerName: node.plain_text_name || 'unknown',
          containerType: node.atlas_document_type,
          arrayName: array.name,
          placeholderIndex,
        });
      }
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
  
  return containers;
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

  console.log('=== FINDING PLACEHOLDER IN ALL ARRAYS ===');
  const containers = findPlaceholderInAllArrays(originalScopeTrees);
  console.log(`Found ${containers.length} containers with Placeholder document:`);
  containers.forEach((container, i) => {
    console.log(`  ${i + 1}. ${container.containerType} (${container.containerName}) - ${container.containerUuid}`);
    console.log(`     Array: ${container.arrayName}, Index: ${container.placeholderIndex}`);
  });

  if (containers.length > 0) {
    const container = containers[0];
    console.log(`\n=== TESTING CONVERSION OF CONTAINER ===`);
    console.log(`Container: ${container.containerType} (${container.containerName})`);
    console.log(`Array: ${container.arrayName}`);
    
    // Find the container node
    function findNodeByUuid(nodes: AtlasTreeNode[], uuid: string): AtlasTreeNode | null {
      for (const node of nodes) {
        if (node.notion_page_id === uuid) {
          return node;
        }
        
        // Search in children
        const found = findNodeByUuid(node.scopes, uuid) ||
                     findNodeByUuid(node.articles, uuid) ||
                     findNodeByUuid(node.sectionsAndPrimaryDocs, uuid) ||
                     findNodeByUuid(node.annotations, uuid) ||
                     findNodeByUuid(node.tenets, uuid) ||
                     findNodeByUuid(node.scenarios, uuid) ||
                     findNodeByUuid(node.scenarioVariations, uuid) ||
                     findNodeByUuid(node.activeData, uuid) ||
                     findNodeByUuid(node.agentScopeDocs, uuid) ||
                     findNodeByUuid(node.neededResearch, uuid);
        
        if (found) return found;
      }
      return null;
    }
    
    const containerNode = findNodeByUuid(originalScopeTrees, container.containerUuid);
    if (containerNode) {
      console.log(`Found container node: ${containerNode.atlas_document_type} (${containerNode.plain_text_name})`);
      
      // Get the array that contains the Placeholder
      const arrays = [
        { name: 'scopes', children: containerNode.scopes },
        { name: 'articles', children: containerNode.articles },
        { name: 'sectionsAndPrimaryDocs', children: containerNode.sectionsAndPrimaryDocs },
        { name: 'annotations', children: containerNode.annotations },
        { name: 'tenets', children: containerNode.tenets },
        { name: 'scenarios', children: containerNode.scenarios },
        { name: 'scenarioVariations', children: containerNode.scenarioVariations },
        { name: 'activeData', children: containerNode.activeData },
        { name: 'agentScopeDocs', children: containerNode.agentScopeDocs },
        { name: 'neededResearch', children: containerNode.neededResearch },
      ];
      
      const targetArray = arrays.find(arr => arr.name === container.arrayName);
      if (targetArray) {
        console.log(`Array ${container.arrayName} has ${targetArray.children.length} children`);
        
        // Check the Placeholder document
        const placeholderNode = targetArray.children[container.placeholderIndex];
        if (placeholderNode) {
          console.log(`Placeholder document type: ${placeholderNode.atlas_document_type}`);
          console.log(`Placeholder document name: ${placeholderNode.plain_text_name}`);
          console.log(`Placeholder document UUID: ${placeholderNode.notion_page_id}`);
        }
      }
    } else {
      console.log('Container node not found!');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
