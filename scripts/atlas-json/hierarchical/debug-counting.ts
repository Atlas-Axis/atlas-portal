#!/usr/bin/env node
/**
 * Debug script to test counting functions
 */

import { buildAtlasTree } from '@/app/server/atlas/atlas-tree-system';
import type { AtlasTreeNode } from '@/app/server/atlas/atlas-tree-types';
import atlasNodeToStandardized from '@/app/server/atlas/json-export/atlas-node-tree-to-standardized-atlas-node-tree';
import type { StandardizedAtlasDocument } from '@/app/server/atlas/json-export/types';
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

async function main() {
  loadEnv();
  
  console.log('=== LOADING ATLAS DATA ===');
  const atlasData = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();
  
  console.log('=== BUILDING TREE ===');
  const result = buildAtlasTree(atlasData, {
    assignDocumentNumbers: true,
    verbose: true,
    reportMissingChildNodes: false,
    reportOrphanedNodes: true,
  });
  
  console.log(`\n=== CONVERTING TO STANDARDIZED FORMAT ===`);
  const standardizedScopeTrees = result.scopeTrees.map((scopeNode) =>
    atlasNodeToStandardized(scopeNode),
  );

  const standardizedOrphanedNodes: StandardizedAtlasDocument[] = result.orphanedNodes.map((orphanedNode) => {
    const tempNode: AtlasTreeNode = {
      notion_page_id: orphanedNode.notion_page_id,
      atlas_document_type: orphanedNode.atlas_document_type,
      plain_text_name: orphanedNode.plain_text_name,
      plain_text_content: orphanedNode.plain_text_content,
      generatedDocID: orphanedNode.atlas_document_number || '',
      generatedDocName: orphanedNode.plain_text_name,
      scopes: [],
      articles: [],
      sectionsAndPrimaryDocs: [],
      annotations: [],
      tenets: [],
      scenarios: [],
      scenarioVariations: [],
      activeData: [],
      agentScopeDocs: [],
      neededResearch: [],
    };
    return atlasNodeToStandardized(tempNode);
  });
  
  console.log(`\n=== COUNTING DOCUMENTS ===`);
  const originalTreeCount = countOriginalDocuments(result.scopeTrees);
  const originalOrphanedCount = result.orphanedNodes.length;
  const originalTotal = originalTreeCount + originalOrphanedCount;
  
  const standardizedTreeCount = countStandardizedDocuments(standardizedScopeTrees);
  const standardizedOrphanedCount = countStandardizedDocuments(standardizedOrphanedNodes);
  const standardizedTotal = standardizedTreeCount + standardizedOrphanedCount;
  
  console.log(`Original tree count: ${originalTreeCount}`);
  console.log(`Original orphaned count: ${originalOrphanedCount}`);
  console.log(`Original total: ${originalTotal}`);
  console.log(`Standardized tree count: ${standardizedTreeCount}`);
  console.log(`Standardized orphaned count: ${standardizedOrphanedCount}`);
  console.log(`Standardized total: ${standardizedTotal}`);
  console.log(`Difference: ${originalTotal - standardizedTotal}`);
  
  // Test individual orphaned node counting
  console.log(`\n=== TESTING ORPHANED NODE COUNTING ===`);
  for (let i = 0; i < Math.min(3, standardizedOrphanedNodes.length); i++) {
    const orphanedDoc = standardizedOrphanedNodes[i];
    const count = countStandardizedDocuments([orphanedDoc]);
    console.log(`Orphaned node ${i + 1}: ${orphanedDoc.type} - ${orphanedDoc.name} (${orphanedDoc.uuid}) = ${count} documents`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
