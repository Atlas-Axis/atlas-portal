import { ChildCollectionName, ExportAtlasTreeDocument } from '@/app/server/atlas/export/types';

/**
 * Type-safe helper to get child collection from a document.
 * Uses proper typing with ChildCollectionName to avoid unsafe casts.
 */
export function getChildCollection(node: ExportAtlasTreeDocument, key: ChildCollectionName): ExportAtlasTreeDocument[] {
  const value = node[key as keyof ExportAtlasTreeDocument];
  return Array.isArray(value) ? value : [];
}

/**
 * Builds a lookup map from document number to the path of node keys needed to reach it.
 * This is built once and cached for O(1) lookups instead of O(n) tree traversals.
 *
 * Node keys use the same fallback strategy as the sidebar: uuid -> doc_no -> depth-based fallback.
 * This ensures consistency between path expansion and accordion key matching.
 *
 * @param node - The current node being examined
 * @param currentPath - Accumulated path of node keys from root to current node
 * @param map - The map being built (doc_no -> path of node keys)
 * @param depth - Current depth in the tree (for fallback key generation)
 */
function buildPathLookupMap(
  node: ExportAtlasTreeDocument,
  currentPath: string[],
  map: Map<string, string[]>,
  depth: number = 0,
): void {
  // Use the same key strategy as sidebar: uuid -> doc_no -> depth-based fallback
  const nodeKey = node.uuid || node.doc_no || `node-${depth}-unknown`;
  const newPath = [...currentPath, nodeKey];

  // Store the path for this document
  if (node.doc_no) {
    map.set(node.doc_no, newPath);
  }

  // Recursively process all children
  const children: ExportAtlasTreeDocument[] = [
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
    buildPathLookupMap(child, newPath, map, depth + 1);
  }
}

/**
 * Creates a lookup map for all documents in the trees.
 *
 * @param trees - Array of root scope trees
 * @returns Map from document number to path of collapsible UUIDs
 */
export function createPathLookupMap(trees: ExportAtlasTreeDocument[]): Map<string, string[]> {
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
function buildUuidToDocNoMap(node: ExportAtlasTreeDocument, map: Map<string, string>): void {
  // Store UUID -> doc_no mapping if both exist
  if (node.uuid && node.doc_no) {
    map.set(node.uuid, node.doc_no);
  }

  // Recursively process all children
  const children: ExportAtlasTreeDocument[] = [
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
export function createUuidToDocNoMap(trees: ExportAtlasTreeDocument[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const tree of trees) {
    buildUuidToDocNoMap(tree, map);
  }
  return map;
}
