#!/usr/bin/env node
/**
 * Debug Database Counts
 *
 * This script checks the actual database counts and compares them with what
 * the tree building and conversion functions are reporting.
 */

import { buildAtlasTree } from '@/app/server/atlas/atlas-tree-system';
import type { AtlasTreeNode, TreeConstructionOptions } from '@/app/server/atlas/atlas-tree-types';
import atlasNodeToStandardized from '@/app/server/atlas/json-export/atlas-node-tree-to-standardized-atlas-node-tree';
import type { StandardizedAtlasDocument } from '@/app/server/atlas/json-export/types';
import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/atlas/load-atlas-from-supabase';
import { loadEnv } from '@/scripts/utils/load-env';
import { supabase } from '@/app/server/services/supabase/supabase-client';

/**
 * Count all documents in AtlasTreeNode tree structure with detailed breakdown.
 */
function countOriginalDocumentsDetailed(nodes: AtlasTreeNode[]): { total: number; byType: Record<string, number> } {
  let total = 0;
  const byType: Record<string, number> = {};
  
  function traverse(node: AtlasTreeNode) {
    total += 1;
    const type = node.atlas_document_type;
    byType[type] = (byType[type] || 0) + 1;
    
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
  
  return { total, byType };
}

/**
 * Count all documents in StandardizedAtlasDocument tree structure with detailed breakdown.
 */
function countStandardizedDocumentsDetailed(docs: StandardizedAtlasDocument[]): { total: number; byType: Record<string, number> } {
  let total = 0;
  const byType: Record<string, number> = {};
  
  function traverse(doc: StandardizedAtlasDocument) {
    total += 1;
    const type = doc.type;
    byType[type] = (byType[type] || 0) + 1;
    
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
  
  return { total, byType };
}

async function main() {
  loadEnv();

  // Check environment variables
  console.log('Environment check:');
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');
  console.log('SUPABASE_API_KEY:', process.env.SUPABASE_API_KEY ? 'SET' : 'NOT SET');

  // Get actual database counts
  console.log('\n=== DATABASE COUNTS ===');
  const { count: dbCount, error: dbError } = await supabase()
    .from('notion_database_pages_current')
    .select('*', { count: 'exact', head: true });
  
  if (dbError) {
    console.error('Database error:', dbError);
    return;
  }
  
  console.log('Total current pages in database:', dbCount);

  // Get counts by database type (with pagination to get all records)
  const { data: byTypeData, error: byTypeError } = await supabase()
    .from('notion_database_pages_current')
    .select('atlas_database_name')
    .limit(10000); // Set a high limit to get all records
    
  if (byTypeError) {
    console.error('By type error:', byTypeError);
    return;
  }
  
  console.log('\nPages by database type:');
  const dbCounts: Record<string, number> = {};
  byTypeData?.forEach((row: any) => {
    dbCounts[row.atlas_database_name] = (dbCounts[row.atlas_database_name] || 0) + 1;
  });
  
  Object.entries(dbCounts).forEach(([db, count]) => {
    console.log(`  ${db}: ${count}`);
  });
  
  const totalDbCount = Object.values(dbCounts).reduce((a, b) => a + b, 0);
  console.log(`Total from database: ${totalDbCount}`);

  // Load Atlas data and build tree
  console.log('\n=== TREE BUILDING ===');
  const atlasData = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();

  const options: TreeConstructionOptions = {
    reportMissingChildNodes: false,
    reportOrphanedNodes: true,
  };

  const result = buildAtlasTree(atlasData, options);
  const originalScopeTrees = result.scopeTrees;

  // Convert to standardized format
  const standardizedScopeTrees: StandardizedAtlasDocument[] = originalScopeTrees.map((scopeNode) =>
    atlasNodeToStandardized(scopeNode),
  );

  // Count documents in both formats
  const originalCounts = countOriginalDocumentsDetailed(originalScopeTrees);
  const standardizedCounts = countStandardizedDocumentsDetailed(standardizedScopeTrees);

  console.log('\n=== TREE COUNTS ===');
  console.log(`Original tree total: ${originalCounts.total}`);
  console.log(`Standardized tree total: ${standardizedCounts.total}`);
  console.log(`Database total: ${totalDbCount}`);

  console.log('\n=== ORIGINAL TREE BY TYPE ===');
  Object.entries(originalCounts.byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  console.log('\n=== STANDARDIZED TREE BY TYPE ===');
  Object.entries(standardizedCounts.byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  console.log('\n=== DISCREPANCIES ===');
  console.log(`Database vs Original: ${totalDbCount - originalCounts.total}`);
  console.log(`Database vs Standardized: ${totalDbCount - standardizedCounts.total}`);
  console.log(`Original vs Standardized: ${originalCounts.total - standardizedCounts.total}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
