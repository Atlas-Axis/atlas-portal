#!/usr/bin/env node
/**
 * Debug Document Count Mismatch
 *
 * This script helps identify which documents are being lost during the conversion
 * from AtlasTreeNode to StandardizedAtlasDocument.
 */

import { buildAtlasTree } from '@/app/server/atlas/atlas-tree-system';
import type { AtlasTreeNode } from '@/app/server/atlas/atlas-tree-types';
import atlasNodeToStandardized from '@/app/server/atlas/json-export/atlas-node-tree-to-standardized-atlas-node-tree';
import type { StandardizedAtlasDocument } from '@/app/server/atlas/json-export/types';
import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/atlas/load-atlas-from-supabase';
import { loadEnv } from '@/scripts/utils/load-env';

/**
 * Collect all document UUIDs from AtlasTreeNode tree structure.
 */
function collectOriginalUuids(nodes: AtlasTreeNode[]): Set<string> {
  const uuids = new Set<string>();
  
  function traverse(node: AtlasTreeNode) {
    if (node.notion_page_id) {
      uuids.add(node.notion_page_id);
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
  
  return uuids;
}

/**
 * Collect all document UUIDs from StandardizedAtlasDocument tree structure.
 */
function collectStandardizedUuids(docs: StandardizedAtlasDocument[]): Set<string> {
  const uuids = new Set<string>();
  
  function traverse(doc: StandardizedAtlasDocument) {
    if (doc.uuid) {
      uuids.add(doc.uuid);
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
  
  return uuids;
}

/**
 * Count documents by type in AtlasTreeNode tree structure.
 */
function countByTypeOriginal(nodes: AtlasTreeNode[]): Record<string, number> {
  const counts: Record<string, number> = {};
  
  function traverse(node: AtlasTreeNode) {
    const type = node.atlas_document_type;
    counts[type] = (counts[type] || 0) + 1;
    
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
  
  return counts;
}

/**
 * Count documents by type in StandardizedAtlasDocument tree structure.
 */
function countByTypeStandardized(docs: StandardizedAtlasDocument[]): Record<string, number> {
  const counts: Record<string, number> = {};
  
  function traverse(doc: StandardizedAtlasDocument) {
    const type = doc.type;
    counts[type] = (counts[type] || 0) + 1;
    
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
  
  return counts;
}

async function main() {
  loadEnv();

  // Load Atlas data from Supabase
  const atlasData = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();

  // Configure options
  const options = {
    reportMissingChildNodes: false,
    reportOrphanedNodes: true,
  };

  // Build tree structure
  const result = buildAtlasTree(atlasData, options);
  const originalScopeTrees = result.scopeTrees;

  // Convert to standardized format
  const standardizedScopeTrees: StandardizedAtlasDocument[] = originalScopeTrees.map((scopeNode) =>
    atlasNodeToStandardized(scopeNode),
  );

  // Convert orphaned nodes to standardized format
  const standardizedOrphanedNodes: StandardizedAtlasDocument[] = result.orphanedNodes.map((orphanedNode) => {
    // Create a temporary AtlasTreeNode from the orphaned NotionDatabasePage
    const tempNode: AtlasTreeNode = {
      notion_page_id: orphanedNode.notion_page_id,
      atlas_document_type: orphanedNode.atlas_document_type,
      plain_text_name: orphanedNode.plain_text_name,
      plain_text_content: orphanedNode.plain_text_content,
      generatedDocID: orphanedNode.atlas_document_number || '',
      generatedDocName: orphanedNode.plain_text_name,
      // Empty child arrays since this is an orphaned node
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

  // Collect UUIDs
  const originalUuids = collectOriginalUuids(originalScopeTrees);
  const standardizedUuids = collectStandardizedUuids(standardizedScopeTrees);
  
  // Add orphaned nodes to counts
  const originalOrphanedUuids = new Set<string>();
  for (const orphanedNode of result.orphanedNodes) {
    if (orphanedNode.notion_page_id) {
      originalOrphanedUuids.add(orphanedNode.notion_page_id);
    }
  }
  
  const standardizedOrphanedUuids = new Set<string>();
  for (const orphanedDoc of standardizedOrphanedNodes) {
    if (orphanedDoc.uuid) {
      standardizedOrphanedUuids.add(orphanedDoc.uuid);
    }
  }
  
  // Combine all UUIDs
  const allOriginalUuids = new Set([...originalUuids, ...originalOrphanedUuids]);
  const allStandardizedUuids = new Set([...standardizedUuids, ...standardizedOrphanedUuids]);

  // Count by type
  const originalCounts = countByTypeOriginal(originalScopeTrees);
  const standardizedCounts = countByTypeStandardized(standardizedScopeTrees);

  console.log('=== DOCUMENT COUNT ANALYSIS ===');
  console.log(`Original total: ${allOriginalUuids.size}`);
  console.log(`Standardized total: ${allStandardizedUuids.size}`);
  console.log(`Difference: ${allOriginalUuids.size - allStandardizedUuids.size}`);

  console.log('\n=== MISSING DOCUMENTS ===');
  const missingUuids = new Set([...allOriginalUuids].filter(uuid => !allStandardizedUuids.has(uuid)));
  console.log(`Missing UUIDs: ${missingUuids.size}`);
  if (missingUuids.size > 0) {
    console.log('Missing UUIDs:', Array.from(missingUuids).slice(0, 10), missingUuids.size > 10 ? '...' : '');
  }

  console.log('\n=== EXTRA DOCUMENTS ===');
  const extraUuids = new Set([...allStandardizedUuids].filter(uuid => !allOriginalUuids.has(uuid)));
  console.log(`Extra UUIDs: ${extraUuids.size}`);
  if (extraUuids.size > 0) {
    console.log('Extra UUIDs:', Array.from(extraUuids).slice(0, 10), extraUuids.size > 10 ? '...' : '');
  }

  console.log('\n=== TYPE COUNTS COMPARISON ===');
  const allTypes = new Set([...Object.keys(originalCounts), ...Object.keys(standardizedCounts)]);
  for (const type of allTypes) {
    const original = originalCounts[type] || 0;
    const standardized = standardizedCounts[type] || 0;
    const diff = original - standardized;
    if (diff !== 0) {
      console.log(`${type}: Original=${original}, Standardized=${standardized}, Diff=${diff}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
