import { StandardizedAtlasDocument } from '@/app/server/atlas/json-export/types';

/**
 * Type-safe helper to get child collection from a document
 */
export function getChildCollection(node: StandardizedAtlasDocument, key: string): StandardizedAtlasDocument[] {
  const value = (node as unknown as Record<string, unknown>)[key];
  return Array.isArray(value) ? value : [];
}

/**
 * Builds a lookup map from document number to the path of collapsible UUIDs needed to reach it.
 * This is built once and cached for O(1) lookups instead of O(n) tree traversals.
 *
 * @param node - The current node being examined
 * @param currentPath - Accumulated path of UUIDs from root to current node
 * @param map - The map being built (doc_no -> path of UUIDs)
 */
function buildPathLookupMap(node: StandardizedAtlasDocument, currentPath: string[], map: Map<string, string[]>): void {
  // Add current node's UUID to path (all document types are collapsible)
  const newPath = node.uuid ? [...currentPath, node.uuid] : currentPath;

  // Store the path for this document
  if (node.doc_no) {
    map.set(node.doc_no, newPath);
  }

  // Recursively process all children
  const children: StandardizedAtlasDocument[] = [
    ...getChildCollection(node, 'scopes'),
    ...getChildCollection(node, 'articles'),
    ...getChildCollection(node, 'sections_and_primary_docs'),
    ...getChildCollection(node, 'agent_scope_database'),
    ...getChildCollection(node, 'annotations'),
    ...getChildCollection(node, 'tenets'),
    ...getChildCollection(node, 'scenarios'),
    ...getChildCollection(node, 'scenario_variations'),
    ...getChildCollection(node, 'active_data'),
    ...getChildCollection(node, 'needed_research'),
  ];

  for (const child of children) {
    buildPathLookupMap(child, newPath, map);
  }
}

/**
 * Creates a lookup map for all documents in the trees.
 *
 * @param trees - Array of root scope trees
 * @returns Map from document number to path of collapsible UUIDs
 */
export function createPathLookupMap(trees: StandardizedAtlasDocument[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const tree of trees) {
    buildPathLookupMap(tree, [], map);
  }
  return map;
}

/**
 * Recursively builds a lookup map from UUID to document number.
 * This is used for converting internal links from UUIDs to document numbers.
 *
 * @param node - The current node being examined
 * @param map - The map being built (uuid -> doc_no)
 */
function buildUuidToDocNoMap(node: StandardizedAtlasDocument, map: Map<string, string>): void {
  // Store UUID -> doc_no mapping if both exist
  if (node.uuid && node.doc_no) {
    map.set(node.uuid, node.doc_no);
  }

  // Recursively process all children
  const children: StandardizedAtlasDocument[] = [
    ...getChildCollection(node, 'scopes'),
    ...getChildCollection(node, 'articles'),
    ...getChildCollection(node, 'sections_and_primary_docs'),
    ...getChildCollection(node, 'agent_scope_database'),
    ...getChildCollection(node, 'annotations'),
    ...getChildCollection(node, 'tenets'),
    ...getChildCollection(node, 'scenarios'),
    ...getChildCollection(node, 'scenario_variations'),
    ...getChildCollection(node, 'active_data'),
    ...getChildCollection(node, 'needed_research'),
  ];

  for (const child of children) {
    buildUuidToDocNoMap(child, map);
  }
}

/**
 * Creates a UUID to document number lookup map for all documents in the trees.
 * Used for converting internal links from UUIDs to document number anchors.
 *
 * @param trees - Array of root scope trees
 * @returns Map from UUID to document number
 */
export function createUuidToDocNoMap(trees: StandardizedAtlasDocument[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const tree of trees) {
    buildUuidToDocNoMap(tree, map);
  }
  return map;
}
