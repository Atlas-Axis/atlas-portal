import { NotionRichText } from '@/app/server/markdown/notion-types';
import { UuidMappings } from '../load-uuid-mapping';
import { NotionAtlasTreeNode } from './atlas-tree-types';

/**
 * Rich Text mention correction and updates for Atlas documents.
 *
 * This module handles automatic updates of Notion mention objects in Atlas documents
 * to ensure they display the correct document numbers and names. This is necessary
 * because Notion's mention plain_text fields can become outdated when documents are
 * renumbered or reorganized.
 */

/**
 * Type guard to check if a value is a Rich Text array.
 * Rich Text arrays contain objects with a 'type' property.
 */
function isRichTextArray(value: unknown): value is NotionRichText[] {
  return (
    Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null && 'type' in value[0]
  );
}

/**
 * Updates mention objects in a Rich Text array with correct document numbers and names.
 *
 * For each mention object in the array:
 * 1. Extracts the Notion page ID from mention.page.id
 * 2. Looks up the Atlas UUID using uuidMappings
 * 3. Looks up the document number using atlasUUIDsToGeneratedDocNumbers
 * 4. Looks up the document name using atlasUUIDsToDocNames
 * 5. Updates the plain_text field with format: "{number} - {name}" (e.g., "A.0.1 - General Provisions")
 * 6. If mapping not found, replaces with "[Unknown]"
 *
 * @param richTextArray - Array of Rich Text objects (mutated in-place)
 * @param atlasUUIDsToGeneratedDocNumbers - Map from Atlas UUID to document number
 * @param atlasUUIDsToDocNames - Map from Atlas UUID to document name
 * @param uuidMappings - UUID mappings to convert Notion page ID to Atlas UUID
 * @returns Number of mentions updated
 */
export function updateMentionInRichTextArray(
  richTextArray: NotionRichText[],
  atlasUUIDsToGeneratedDocNumbers: Map<string, string>,
  atlasUUIDsToDocNames: Map<string, string>,
  uuidMappings: UuidMappings,
): number {
  let updatedCount = 0;

  for (const richTextItem of richTextArray) {
    // Only process mention objects
    if (richTextItem.type !== 'mention') {
      continue;
    }

    // Extract Notion page ID from mention object
    // Only process page mentions (not user, database, or date mentions)
    const mention = richTextItem.mention;
    if (!mention || mention.type !== 'page') {
      continue;
    }

    const notionPageId = mention.page.id;
    if (!notionPageId) {
      console.warn(`No Notion page ID found for page mention in Rich Text array`);
      continue;
    }

    // Look up Atlas UUID from Notion page ID
    const atlasUUID = uuidMappings.notionPageIDsToAtlasUUIDs.get(notionPageId);

    if (!atlasUUID) {
      // UUID mapping not found - replace with placeholder
      richTextItem.plain_text = '[Unknown]';
      console.warn(`UUID mapping not found for Notion page ID: ${notionPageId}`);
      updatedCount++;
      continue;
    }

    // Look up document number and name from Atlas UUID
    const documentNumber = atlasUUIDsToGeneratedDocNumbers.get(atlasUUID);
    const documentName = atlasUUIDsToDocNames.get(atlasUUID);

    if (!documentNumber) {
      // Document number not found - replace with placeholder
      richTextItem.plain_text = '[Unknown]';
      console.warn(`Document number not found for Atlas UUID: ${atlasUUID} (Notion page: ${notionPageId})`);
      updatedCount++;
      continue;
    }

    // Format: "A.0.1 - Document Name" or just "A.0.1" if name is not available
    if (documentName) {
      richTextItem.plain_text = `${documentNumber} - ${documentName}`;
    } else {
      richTextItem.plain_text = documentNumber;
      console.warn(`Document name not found for Atlas UUID: ${atlasUUID} (using number only: ${documentNumber})`);
    }

    updatedCount++;
  }

  return updatedCount;
}

/**
 * Updates Rich Text mentions in a single tree node's json_content field.
 *
 * Handles two cases:
 * 1. json_content is a Rich Text array directly
 * 2. json_content is an object containing Rich Text arrays in nested properties
 *
 * Mutates the node's json_content in-place.
 *
 * @param node - Tree node to update (mutated in-place)
 * @param atlasUUIDsToGeneratedDocNumbers - Map from Atlas UUID to document number
 * @param atlasUUIDsToDocNames - Map from Atlas UUID to document name
 * @param uuidMappings - UUID mappings to convert Notion page ID to Atlas UUID
 * @returns Number of mentions updated
 */
function updateRichTextMentionsInNode(
  node: NotionAtlasTreeNode,
  atlasUUIDsToGeneratedDocNumbers: Map<string, string>,
  atlasUUIDsToDocNames: Map<string, string>,
  uuidMappings: UuidMappings,
): number {
  let updatedCount = 0;

  if (!node.json_content) {
    return 0;
  }

  // Case 1: json_content is a Rich Text array directly
  if (isRichTextArray(node.json_content)) {
    updatedCount += updateMentionInRichTextArray(
      node.json_content,
      atlasUUIDsToGeneratedDocNumbers,
      atlasUUIDsToDocNames,
      uuidMappings,
    );
    return updatedCount;
  }

  // Case 2: json_content is an object - recursively search for Rich Text arrays
  if (typeof node.json_content === 'object' && node.json_content !== null && !Array.isArray(node.json_content)) {
    console.warn('json_content is an object', node.notion_page_id);
    // const jsonContent = node.json_content as Record<string, unknown>;

    // for (const value of Object.values(jsonContent)) {
    //   if (isRichTextArray(value)) {
    //     updatedCount += updateMentionInRichTextArray(value, atlasUUIDsToGeneratedDocNumbers, atlasUUIDsToDocNames, uuidMappings);
    //   } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    //     // Recursively check nested objects
    //     const nestedObj = value as Record<string, unknown>;
    //     for (const nestedValue of Object.values(nestedObj)) {
    //       if (isRichTextArray(nestedValue)) {
    //         updatedCount += updateMentionInRichTextArray(nestedValue, atlasUUIDsToGeneratedDocNumbers, atlasUUIDsToDocNames, uuidMappings);
    //       }
    //     }
    //   }
    // }
  }

  return updatedCount;
}

/**
 * Recursively updates Rich Text mentions in all nodes of the Atlas tree.
 *
 * Traverses all scope trees and orphaned nodes, updating mention objects
 * in their json_content fields with correct document numbers and names.
 *
 * @param scopeTrees - Array of root scope trees
 * @param orphanedNodesAsTreeNodes - Array of orphaned nodes as tree nodes
 * @param atlasUUIDsToGeneratedDocNumbers - Map from Atlas UUID to document number
 * @param atlasUUIDsToDocNames - Map from Atlas UUID to document name
 * @param uuidMappings - UUID mappings to convert Notion page ID to Atlas UUID
 * @param verbose - Whether to log detailed update information
 * @returns Total number of mentions updated across all nodes
 */
export function updateRichTextMentionsInTree(
  scopeTrees: NotionAtlasTreeNode[],
  orphanedNodesAsTreeNodes: NotionAtlasTreeNode[],
  atlasUUIDsToGeneratedDocNumbers: Map<string, string>,
  atlasUUIDsToDocNames: Map<string, string>,
  uuidMappings: UuidMappings,
  verbose: boolean,
): number {
  let totalUpdatedCount = 0;

  function processNode(node: NotionAtlasTreeNode): void {
    // Update mentions in current node
    const count = updateRichTextMentionsInNode(
      node,
      atlasUUIDsToGeneratedDocNumbers,
      atlasUUIDsToDocNames,
      uuidMappings,
    );
    totalUpdatedCount += count;

    // Recursively process all child arrays
    const childArrays = [
      node.scopes,
      node.articles,
      node.sectionsAndPrimaryDocs,
      node.annotations,
      node.tenets,
      node.scenarios,
      node.scenarioVariations,
      node.activeData,
      node.agentScopeDocs,
      node.neededResearch,
    ];

    for (const children of childArrays) {
      for (const child of children) {
        processNode(child);
      }
    }
  }

  // Process all scope trees
  for (const scopeTree of scopeTrees) {
    processNode(scopeTree);
  }

  // Process all orphaned nodes
  for (const orphanedNode of orphanedNodesAsTreeNodes) {
    processNode(orphanedNode);
  }

  if (verbose) {
    console.log(`📝 Updated ${totalUpdatedCount} Rich Text mention(s) with correct document numbers and names`);
  }

  return totalUpdatedCount;
}
