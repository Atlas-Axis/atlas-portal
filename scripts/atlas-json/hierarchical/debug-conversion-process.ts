#!/usr/bin/env node
/**
 * Debug Conversion Process
 *
 * This script traces the conversion process to see exactly what's happening
 * to Placeholder documents during conversion.
 */

import { buildAtlasTree } from '@/app/server/atlas/atlas-tree-system';
import type { AtlasTreeNode, TreeConstructionOptions } from '@/app/server/atlas/atlas-tree-types';
import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/atlas/load-atlas-from-supabase';
import { loadEnv } from '@/scripts/utils/load-env';

/**
 * Find all Placeholder documents in the tree and show their exact location.
 */
function findPlaceholderDocumentsInTree(nodes: AtlasTreeNode[]): Array<{ 
  uuid: string; 
  name: string; 
  path: string;
  parentType: string;
  parentUuid: string;
}> {
  const placeholders: Array<{ 
    uuid: string; 
    name: string; 
    path: string;
    parentType: string;
    parentUuid: string;
  }> = [];
  
  function traverse(node: AtlasTreeNode, path: string[], parentType: string, parentUuid: string) {
    const currentPath = [...path, `${node.atlas_document_type}(${node.notion_page_id})`];
    
    if (node.atlas_document_type === 'Placeholder') {
      placeholders.push({
        uuid: node.notion_page_id || 'unknown',
        name: node.plain_text_name || 'unknown',
        path: currentPath.join(' → '),
        parentType,
        parentUuid,
      });
    }
    
    // Recursively traverse all child collections
    traverseChildren(node.scopes, currentPath, node.atlas_document_type, node.notion_page_id || 'unknown');
    traverseChildren(node.articles, currentPath, node.atlas_document_type, node.notion_page_id || 'unknown');
    traverseChildren(node.sectionsAndPrimaryDocs, currentPath, node.atlas_document_type, node.notion_page_id || 'unknown');
    traverseChildren(node.annotations, currentPath, node.atlas_document_type, node.notion_page_id || 'unknown');
    traverseChildren(node.tenets, currentPath, node.atlas_document_type, node.notion_page_id || 'unknown');
    traverseChildren(node.scenarios, currentPath, node.atlas_document_type, node.notion_page_id || 'unknown');
    traverseChildren(node.scenarioVariations, currentPath, node.atlas_document_type, node.notion_page_id || 'unknown');
    traverseChildren(node.activeData, currentPath, node.atlas_document_type, node.notion_page_id || 'unknown');
    traverseChildren(node.agentScopeDocs, currentPath, node.atlas_document_type, node.notion_page_id || 'unknown');
    traverseChildren(node.neededResearch, currentPath, node.atlas_document_type, node.notion_page_id || 'unknown');
  }
  
  function traverseChildren(children: AtlasTreeNode[], path: string[], parentType: string, parentUuid: string) {
    for (const child of children) {
      traverse(child, path, parentType, parentUuid);
    }
  }
  
  for (const node of nodes) {
    traverse(node, [], 'root', 'root');
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

  console.log('=== PLACEHOLDER DOCUMENTS IN TREE ===');
  const placeholders = findPlaceholderDocumentsInTree(originalScopeTrees);
  console.log(`Found ${placeholders.length} Placeholder documents in tree:`);
  placeholders.forEach((placeholder, i) => {
    console.log(`  ${i + 1}. ${placeholder.name} (${placeholder.uuid})`);
    console.log(`     Parent: ${placeholder.parentType} (${placeholder.parentUuid})`);
    console.log(`     Path: ${placeholder.path}`);
  });

  // Now let's manually test the conversion of the parent Core document
  if (placeholders.length > 0) {
    const placeholder = placeholders[0];
    console.log(`\n=== TESTING CONVERSION OF PARENT CORE DOCUMENT ===`);
    console.log(`Parent UUID: ${placeholder.parentUuid}`);
    
    // Find the parent Core document in the tree
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
    
    const parentNode = findNodeByUuid(originalScopeTrees, placeholder.parentUuid);
    if (parentNode) {
      console.log(`Found parent node: ${parentNode.atlas_document_type} (${parentNode.plain_text_name})`);
      console.log(`Parent has ${parentNode.sectionsAndPrimaryDocs.length} sectionsAndPrimaryDocs children`);
      
      // Check if the Placeholder is in the sectionsAndPrimaryDocs array
      const placeholderInArray = parentNode.sectionsAndPrimaryDocs.find(child => 
        child.notion_page_id === placeholder.uuid
      );
      console.log(`Placeholder found in sectionsAndPrimaryDocs: ${!!placeholderInArray}`);
      
      if (placeholderInArray) {
        console.log(`Placeholder document type: ${placeholderInArray.atlas_document_type}`);
        console.log(`Placeholder document name: ${placeholderInArray.plain_text_name}`);
      }
    } else {
      console.log('Parent node not found!');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
