#!/usr/bin/env node
/**
 * CLI: Generate Export Atlas Tree JSON from Supabase
 *
 * Description
 * - Reads Atlas Scope trees produced by `buildNotionAtlasTree(await loadAtlasFromSupabaseWithNestingAgentsUnderSection())`
 * - Converts each node from `NotionAtlasTreeNode` shape to a simplified `ExportAtlasTreeDocument` shape.
 * - Writes the export trees to `.debug-data/standardized-atlas/atlas.json`.
 *
 * Input
 * - Supabase: `buildNotionAtlasTree(await loadAtlasFromSupabaseWithNestingAgentsUnderSection())`
 * - Type: `NotionAtlasTreeNode[]` roots representing Scope documents
 *
 * Output (result format)
 * - File: `.debug-data/standardized-atlas/atlas.json`
 * - Type: `ExportAtlasTreeDocument[]` (same child array names as input)
 *
 * How to run
 * ```bash
 * npx tsx scripts/atlas-export/generate-atlas-json.ts
 * ```
 */
import fs from 'fs';
import path from 'path';
import notionTreeNodeToExportTreeDocument from '@/app/server/atlas/export/atlas-node-tree-to-standardized-atlas-node-tree';
import type {
  ChildCollectionName,
  ExportAtlasTreeDocument,
  ExportAtlasTreeScopeTrees,
} from '@/app/server/atlas/export/types';
import { childCollectionNames } from '@/app/server/atlas/export/types';
import { loadUuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import { buildNotionAtlasTree } from '@/app/server/atlas/tree/atlas-tree-system';
import type {
  NotionAtlasTreeConstructionOptions,
  NotionAtlasTreeNode,
} from '@/app/server/atlas/tree/atlas-tree-system';
import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/services/supabase/load-atlas-from-supabase';
import { loadEnv } from '@/scripts/utils/load-env';

/**
 * Type-safe helper to check if a property exists on an ExportAtlasTreeDocument
 * and narrow its type. This ensures we only use valid child collection names.
 */
function hasChildCollection(
  doc: ExportAtlasTreeDocument,
  collectionName: ChildCollectionName,
): doc is ExportAtlasTreeDocument & Record<ChildCollectionName, ExportAtlasTreeDocument[]> {
  return collectionName in doc && Array.isArray((doc as unknown as Record<string, unknown>)[collectionName]);
}

/**
 * Recursively count all unique documents in a NotionAtlasTreeNode tree structure.
 * Uses a Set to track unique UUIDs to avoid counting duplicates.
 */
function countUniqueDocuments(nodes: NotionAtlasTreeNode[]): number {
  const uniqueUuids = new Set<string>();

  function traverse(node: NotionAtlasTreeNode) {
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

  function traverseChildren(children: NotionAtlasTreeNode[]) {
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
 * Recursively count all unique documents in an ExportAtlasTreeDocument tree structure.
 * Uses a Set to track unique UUIDs to avoid counting duplicates.
 * This function correctly handles the case where the same document appears multiple times
 * in the tree due to duplicated nodes (e.g., Needed Research documents that can appear
 * under multiple parents).
 */
function countExportDocuments(docs: ExportAtlasTreeDocument[]): number {
  const uniqueUuids = new Set<string>();

  function traverse(doc: ExportAtlasTreeDocument) {
    if (doc.uuid) {
      uniqueUuids.add(doc.uuid);
    }

    // Recursively traverse all child collections using type-safe checks
    for (const collectionName of childCollectionNames) {
      if (hasChildCollection(doc, collectionName)) {
        traverseChildren(doc[collectionName]);
      }
    }
  }

  function traverseChildren(children: ExportAtlasTreeDocument[]) {
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
  const outputFile = path.join(outputDir, 'atlas.json');

  loadEnv();

  // Load Atlas data from Supabase
  const atlasData = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();

  // Load UUID mappings
  const uuidMappings = await loadUuidMappings();

  // Configure options
  const options: NotionAtlasTreeConstructionOptions = {
    uuidMappings,
    reportMissingChildNodes: false,
    reportOrphanedNodes: true,
  };

  // Build tree structure with document numbering and validation
  const result = await buildNotionAtlasTree(atlasData, options);
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
    const duplicatesByNodeId = new Map<string, { parentId: string; node: NotionAtlasTreeNode }[]>();
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

  // Convert Scope trees to Export Atlas Tree JSON format
  const exportScopeTrees: ExportAtlasTreeScopeTrees = originalScopeTrees.map((scopeNode) =>
    notionTreeNodeToExportTreeDocument(scopeNode, uuidMappings),
  );

  // Convert orphaned nodes to export format
  const exportOrphanedNodes: ExportAtlasTreeDocument[] = result.orphanedNodesAsTreeNodes.map((orphanedNode) => {
    try {
      return notionTreeNodeToExportTreeDocument(orphanedNode, uuidMappings);
    } catch (error) {
      console.warn(`Failed to convert orphaned node ${orphanedNode.notion_page_id}: ${error}`);
      // Return a minimal document for counting purposes
      return {
        type: orphanedNode.atlas_document_type,
        doc_no: orphanedNode.generatedDocID ?? '',
        name: orphanedNode.generatedDocName ?? orphanedNode.plain_text_name ?? '',
        uuid: orphanedNode.notion_page_id ?? null,
        content: orphanedNode.plain_text_content ?? '',
      } as ExportAtlasTreeDocument;
    }
  });

  // Verify document counts match between original and export trees
  const uniqueDocumentCount = countUniqueDocuments(originalScopeTrees);
  const originalOrphanedCount = result.orphanedNodes.length;
  const uniqueCount = uniqueDocumentCount + originalOrphanedCount;

  const exportDocumentCount = countExportDocuments(exportScopeTrees);
  const exportOrphanedCount = countExportDocuments(exportOrphanedNodes);
  const exportCount = exportDocumentCount + exportOrphanedCount;

  console.log(`📊 Count breakdown:`);
  console.log(`   Unique documents: ${uniqueDocumentCount}`);
  console.log(`   Original orphaned: ${originalOrphanedCount}`);
  console.log(`   Duplicated nodes: ${result.duplicatedNodes.length}`);
  console.log(`   Unique documents: ${uniqueCount}`);
  console.log(`   Export documents: ${exportDocumentCount}`);
  console.log(`   Export orphaned: ${exportOrphanedCount}`);
  console.log(`   Export total: ${exportCount}`);

  if (uniqueCount !== exportCount) {
    console.error(`❌ Document count mismatch! Original: ${uniqueCount}, Export: ${exportCount}`);
  } else {
    console.log(`✅ Document counts match: ${uniqueCount} documents in both trees`);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(exportScopeTrees, null, 2), 'utf8');

  console.log(`Exported ${exportScopeTrees.length} root scope trees`);
  console.log(`Excluded ${exportOrphanedNodes.length} orphaned nodes`);
  console.log(`Wrote standardized JSON to ${outputFile}`);

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
