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
 * Recursively count all documents in an AtlasTreeNode tree structure.
 */
function countOriginalDocuments(nodes: AtlasTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1; // Count this node
    // Recursively count all child collections
    count += countOriginalDocuments(node.scopes);
    count += countOriginalDocuments(node.articles);
    count += countOriginalDocuments(node.sectionsAndPrimaryDocs);
    count += countOriginalDocuments(node.annotations);
    count += countOriginalDocuments(node.tenets);
    count += countOriginalDocuments(node.scenarios);
    count += countOriginalDocuments(node.scenarioVariations);
    count += countOriginalDocuments(node.activeData);
    count += countOriginalDocuments(node.agentScopeDocs);
    count += countOriginalDocuments(node.neededResearch);
  }
  return count;
}

/**
 * Recursively count all documents in a StandardizedAtlasDocument tree structure.
 */
function countStandardizedDocuments(docs: StandardizedAtlasDocument[]): number {
  let count = 0;
  for (const doc of docs) {
    count += 1; // Count this document

    // Recursively count all child collections based on document type
    if ('articles' in doc && doc.articles) {
      count += countStandardizedDocuments(doc.articles);
    }
    if ('sections' in doc && doc.sections) {
      count += countStandardizedDocuments(doc.sections);
    }
    if ('categories' in doc && doc.categories) {
      count += countStandardizedDocuments(doc.categories);
    }
    if ('coreDocuments' in doc && doc.coreDocuments) {
      count += countStandardizedDocuments(doc.coreDocuments);
    }
    if ('activeDataControllers' in doc && doc.activeDataControllers) {
      count += countStandardizedDocuments(doc.activeDataControllers);
    }
    if ('typeSpecifications' in doc && doc.typeSpecifications) {
      count += countStandardizedDocuments(doc.typeSpecifications);
    }
    if ('scenarios' in doc && doc.scenarios) {
      count += countStandardizedDocuments(doc.scenarios);
    }
    if ('scenarioVariations' in doc && doc.scenarioVariations) {
      count += countStandardizedDocuments(doc.scenarioVariations);
    }
    if ('supportingDocuments' in doc && doc.supportingDocuments) {
      const supporting = doc.supportingDocuments;
      if (supporting.annotations) count += countStandardizedDocuments(supporting.annotations);
      if (supporting.tenets) count += countStandardizedDocuments(supporting.tenets);
      if (supporting.neededResearch) count += countStandardizedDocuments(supporting.neededResearch);
      if ('activeData' in supporting && supporting.activeData)
        count += countStandardizedDocuments(supporting.activeData);
    }
  }
  return count;
}

/**
 * Recursively collect all document UUIDs from an AtlasTreeNode tree structure.
 */
function collectOriginalDocumentUUIDs(nodes: AtlasTreeNode[]): Set<string> {
  const uuids = new Set<string>();
  for (const node of nodes) {
    uuids.add(node.notion_page_id); // Add this node's UUID
    // Recursively collect all child UUIDs
    collectOriginalDocumentUUIDs(node.scopes).forEach((uuid) => uuids.add(uuid));
    collectOriginalDocumentUUIDs(node.articles).forEach((uuid) => uuids.add(uuid));
    collectOriginalDocumentUUIDs(node.sectionsAndPrimaryDocs).forEach((uuid) => uuids.add(uuid));
    collectOriginalDocumentUUIDs(node.annotations).forEach((uuid) => uuids.add(uuid));
    collectOriginalDocumentUUIDs(node.tenets).forEach((uuid) => uuids.add(uuid));
    collectOriginalDocumentUUIDs(node.scenarios).forEach((uuid) => uuids.add(uuid));
    collectOriginalDocumentUUIDs(node.scenarioVariations).forEach((uuid) => uuids.add(uuid));
    collectOriginalDocumentUUIDs(node.activeData).forEach((uuid) => uuids.add(uuid));
    collectOriginalDocumentUUIDs(node.agentScopeDocs).forEach((uuid) => uuids.add(uuid));
    collectOriginalDocumentUUIDs(node.neededResearch).forEach((uuid) => uuids.add(uuid));
  }
  return uuids;
}

/**
 * Recursively collect all document UUIDs from a StandardizedAtlasDocument tree structure.
 */
function collectStandardizedDocumentUUIDs(docs: StandardizedAtlasDocument[]): Set<string> {
  const uuids = new Set<string>();
  for (const doc of docs) {
    if (doc.uuid) uuids.add(doc.uuid); // Add this document's UUID if it exists

    // Recursively collect all child UUIDs
    if ('articles' in doc && doc.articles) {
      collectStandardizedDocumentUUIDs(doc.articles).forEach((uuid) => uuids.add(uuid));
    }
    if ('sections' in doc && doc.sections) {
      collectStandardizedDocumentUUIDs(doc.sections).forEach((uuid) => uuids.add(uuid));
    }
    if ('categories' in doc && doc.categories) {
      collectStandardizedDocumentUUIDs(doc.categories).forEach((uuid) => uuids.add(uuid));
    }
    if ('coreDocuments' in doc && doc.coreDocuments) {
      collectStandardizedDocumentUUIDs(doc.coreDocuments).forEach((uuid) => uuids.add(uuid));
    }
    if ('activeDataControllers' in doc && doc.activeDataControllers) {
      collectStandardizedDocumentUUIDs(doc.activeDataControllers).forEach((uuid) => uuids.add(uuid));
    }
    if ('typeSpecifications' in doc && doc.typeSpecifications) {
      collectStandardizedDocumentUUIDs(doc.typeSpecifications).forEach((uuid) => uuids.add(uuid));
    }
    if ('scenarios' in doc && doc.scenarios) {
      collectStandardizedDocumentUUIDs(doc.scenarios).forEach((uuid) => uuids.add(uuid));
    }
    if ('scenarioVariations' in doc && doc.scenarioVariations) {
      collectStandardizedDocumentUUIDs(doc.scenarioVariations).forEach((uuid) => uuids.add(uuid));
    }
    if ('supportingDocuments' in doc && doc.supportingDocuments) {
      const supporting = doc.supportingDocuments;
      if (supporting.annotations)
        collectStandardizedDocumentUUIDs(supporting.annotations).forEach((uuid) => uuids.add(uuid));
      if (supporting.tenets) collectStandardizedDocumentUUIDs(supporting.tenets).forEach((uuid) => uuids.add(uuid));
      if (supporting.neededResearch)
        collectStandardizedDocumentUUIDs(supporting.neededResearch).forEach((uuid) => uuids.add(uuid));
      if ('activeData' in supporting && supporting.activeData)
        collectStandardizedDocumentUUIDs(supporting.activeData).forEach((uuid) => uuids.add(uuid));
    }
  }
  return uuids;
}

/**
 * Create a map from UUID to document info for original tree nodes.
 */
function createOriginalDocumentMap(nodes: AtlasTreeNode[]): Map<string, { type: string; name: string; uuid: string }> {
  const docMap = new Map<string, { type: string; name: string; uuid: string }>();

  function addToMap(nodes: AtlasTreeNode[]) {
    for (const node of nodes) {
      docMap.set(node.notion_page_id, {
        type: node.atlas_document_type,
        name: node.plain_text_name || node.canonical_document_title || '[No Name]',
        uuid: node.notion_page_id,
      });

      // Recursively process all children
      addToMap(node.scopes);
      addToMap(node.articles);
      addToMap(node.sectionsAndPrimaryDocs);
      addToMap(node.annotations);
      addToMap(node.tenets);
      addToMap(node.scenarios);
      addToMap(node.scenarioVariations);
      addToMap(node.activeData);
      addToMap(node.agentScopeDocs);
      addToMap(node.neededResearch);
    }
  }

  addToMap(nodes);
  return docMap;
}

/**
 * Entry point.
 * - Reads data from Supabase, builds Atlas tree, converts to standardized format, writes output JSON, prints summary stats.
 */
async function main() {
  const outputDir = '.debug-data/standardized-atlas';
  const outputFile = path.join('atlas-supabase-scope-trees-standardized.json');

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

  // Convert Scope trees to standardized JSON format
  const standardizedScopeTrees: StandardizedAtlasScopeTrees = originalScopeTrees.map((scopeNode) =>
    atlasNodeToStandardized(scopeNode),
  );

  // Verify document counts match between original and standardized trees
  const originalCount = countOriginalDocuments(originalScopeTrees);
  const standardizedCount = countStandardizedDocuments(standardizedScopeTrees);

  if (originalCount !== standardizedCount) {
    console.error(`❌ Document count mismatch! Original: ${originalCount}, Standardized: ${standardizedCount}`);
    console.error(`   Missing ${originalCount - standardizedCount} documents in standardized tree`);

    // Identify the specific missing documents
    const originalUUIDs = collectOriginalDocumentUUIDs(originalScopeTrees);
    const standardizedUUIDs = collectStandardizedDocumentUUIDs(standardizedScopeTrees);
    const missingUUIDs = new Set([...originalUUIDs].filter((uuid) => !standardizedUUIDs.has(uuid)));

    if (missingUUIDs.size > 0) {
      console.error(`\n📋 Missing documents (${missingUUIDs.size}):`);
      const originalDocMap = createOriginalDocumentMap(originalScopeTrees);
      const missingByType = new Map<string, number>();

      [...missingUUIDs].forEach((uuid, index) => {
        const doc = originalDocMap.get(uuid);
        if (doc) {
          console.error(`   ${index + 1}. [${doc.type}] "${doc.name}" (${doc.uuid})`);
          missingByType.set(doc.type, (missingByType.get(doc.type) || 0) + 1);
        } else {
          console.error(`   ${index + 1}. Unknown document (${uuid})`);
          missingByType.set('Unknown', (missingByType.get('Unknown') || 0) + 1);
        }
      });

      console.error(`\n📊 Missing documents by type:`);
      [...missingByType.entries()]
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          console.error(`   ${type}: ${count}`);
        });
    }
  } else {
    console.log(`✅ Document counts match: ${originalCount} documents in both trees`);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(standardizedScopeTrees, null, 2), 'utf8');

  console.log(`Standardized ${standardizedScopeTrees.length} root scope trees`);
  console.log(`Wrote standardized JSON to ${outputFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
