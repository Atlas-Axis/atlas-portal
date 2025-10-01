#!/usr/bin/env node
/**
 * Debug script to test orphaned node conversion
 */

import { buildAtlasTree } from '@/app/server/atlas/atlas-tree-system';
import type { AtlasTreeNode } from '@/app/server/atlas/atlas-tree-types';
import atlasNodeToStandardized from '@/app/server/atlas/json-export/atlas-node-tree-to-standardized-atlas-node-tree';
import type { StandardizedAtlasDocument } from '@/app/server/atlas/json-export/types';
import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/atlas/load-atlas-from-supabase';
import { loadEnv } from '@/scripts/utils/load-env';

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
  
  console.log(`\n=== ORPHANED NODES ANALYSIS ===`);
  console.log(`Found ${result.orphanedNodes.length} orphaned nodes`);
  
  // Show details of first few orphaned nodes
  for (let i = 0; i < Math.min(5, result.orphanedNodes.length); i++) {
    const orphanedNode = result.orphanedNodes[i];
    console.log(`\nOrphaned node ${i + 1}:`);
    console.log(`  Type: ${orphanedNode.atlas_document_type}`);
    console.log(`  Name: ${orphanedNode.plain_text_name}`);
    console.log(`  UUID: ${orphanedNode.notion_page_id}`);
    console.log(`  Database: ${orphanedNode.atlas_database_name}`);
  }
  
  console.log(`\n=== CONVERTING ORPHANED NODES ===`);
  const standardizedOrphanedNodes: StandardizedAtlasDocument[] = result.orphanedNodes.map((orphanedNode, index) => {
    console.log(`Converting orphaned node ${index + 1}: ${orphanedNode.atlas_document_type} - ${orphanedNode.plain_text_name}`);
    
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
    
    try {
      const converted = atlasNodeToStandardized(tempNode);
      console.log(`  ✅ Converted successfully: ${converted.type} - ${converted.name} (${converted.uuid})`);
      return converted;
    } catch (error) {
      console.log(`  ❌ Conversion failed: ${error}`);
      return null;
    }
  }).filter(Boolean) as StandardizedAtlasDocument[];
  
  console.log(`\n=== CONVERSION RESULTS ===`);
  console.log(`Original orphaned nodes: ${result.orphanedNodes.length}`);
  console.log(`Successfully converted: ${standardizedOrphanedNodes.length}`);
  console.log(`Failed conversions: ${result.orphanedNodes.length - standardizedOrphanedNodes.length}`);
  
  // Count by type
  const typeCounts: Record<string, number> = {};
  for (const node of standardizedOrphanedNodes) {
    typeCounts[node.type] = (typeCounts[node.type] || 0) + 1;
  }
  
  console.log(`\n=== CONVERTED TYPES ===`);
  for (const [type, count] of Object.entries(typeCounts)) {
    console.log(`${type}: ${count}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
