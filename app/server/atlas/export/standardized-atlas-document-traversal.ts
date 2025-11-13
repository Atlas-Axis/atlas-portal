import { type ChildCollectionName, type StandardizedAtlasDocument, childCollectionNames } from './types';

/**
 * Traversal callback function type for StandardizedAtlasDocument tree operations.
 *
 * @param doc - The current document being visited
 * @param depth - The depth of the current document (0 for root)
 * @param parent - The parent document (undefined for root documents)
 * @param collectionName - The child collection name this document came from (undefined for root)
 * @returns Whether to continue traversal (true) or stop (false)
 */
export type StandardizedDocumentTraversalCallback = (
  doc: StandardizedAtlasDocument,
  depth: number,
  parent?: StandardizedAtlasDocument,
  collectionName?: ChildCollectionName,
) => boolean;

/**
 * Helper type to access child collections from StandardizedAtlasDocument
 */
type DocumentWithChildren = {
  [K in ChildCollectionName]?: StandardizedAtlasDocument[];
};

/**
 * Gets all child documents from a StandardizedAtlasDocument across all child collections.
 *
 * @param doc - The document to get children from
 * @returns Array of tuples containing [childDocument, collectionName]
 */
function getAllChildren(doc: StandardizedAtlasDocument): Array<[StandardizedAtlasDocument, ChildCollectionName]> {
  const children: Array<[StandardizedAtlasDocument, ChildCollectionName]> = [];
  const docWithChildren = doc as StandardizedAtlasDocument & DocumentWithChildren;

  for (const collectionName of childCollectionNames) {
    const collection = docWithChildren[collectionName];
    if (Array.isArray(collection)) {
      for (const child of collection) {
        children.push([child, collectionName]);
      }
    }
  }

  return children;
}

/**
 * Performs a pre-order traversal of a StandardizedAtlasDocument tree.
 *
 * Pre-order traversal visits the current document before its children, making it ideal for:
 * - Building hierarchical structures
 * - Top-down processing
 * - Flattening trees while preserving order
 *
 * @param root - The root document to start traversal from
 * @param callback - Function to call for each visited document
 * @param maxDepth - Maximum depth to traverse (prevents infinite recursion)
 * @returns Array of all visited documents in pre-order
 *
 * @example
 * ```typescript
 * traverseStandardizedDocument(scopeDoc, (doc, depth) => {
 *   console.log(`${'  '.repeat(depth)}${doc.doc_no} - ${doc.name}`);
 *   return true; // Continue traversal
 * });
 * ```
 */
export function traverseStandardizedDocument(
  root: StandardizedAtlasDocument,
  callback: StandardizedDocumentTraversalCallback,
  maxDepth: number = 50,
): StandardizedAtlasDocument[] {
  const visited: StandardizedAtlasDocument[] = [];
  const visitedUuids = new Set<string>();

  function traverse(
    doc: StandardizedAtlasDocument,
    depth: number,
    parent?: StandardizedAtlasDocument,
    collectionName?: ChildCollectionName,
  ): void {
    if (depth > maxDepth) {
      throw new Error(`Maximum traversal depth (${maxDepth}) exceeded`);
    }

    // Track visited UUIDs to detect circular references
    // Note: Needed Research documents can appear multiple times legitimately (global numbering)
    if (doc.uuid && visitedUuids.has(doc.uuid)) {
      // Allow multiple visits for Needed Research documents
      const allowDuplicates = doc.type === 'Needed Research';
      if (!allowDuplicates) {
        console.warn(
          `[traverseStandardizedDocument] Circular reference or duplicate detected: ${doc.uuid} (${doc.type})`,
        );
        return;
      }
    }

    if (doc.uuid) {
      visitedUuids.add(doc.uuid);
    }

    visited.push(doc);

    try {
      const shouldContinue = callback(doc, depth, parent, collectionName);
      if (!shouldContinue) {
        return;
      }

      // Visit all children
      const children = getAllChildren(doc);
      for (const [child, childCollectionName] of children) {
        traverse(child, depth + 1, doc, childCollectionName);
      }
    } finally {
      // Remove from visitedUuids when backtracking to allow legitimate multiple references
      if (doc.uuid) {
        visitedUuids.delete(doc.uuid);
      }
    }
  }

  traverse(root, 0);
  return visited;
}

/**
 * Traverses multiple StandardizedAtlasDocument trees (typically scope trees).
 *
 * @param roots - Array of root documents to traverse
 * @param callback - Function to call for each visited document
 * @param maxDepth - Maximum depth to traverse (prevents infinite recursion)
 * @returns Array of all visited documents across all trees in pre-order
 */
export function traverseStandardizedDocuments(
  roots: StandardizedAtlasDocument[],
  callback: StandardizedDocumentTraversalCallback,
  maxDepth: number = 50,
): StandardizedAtlasDocument[] {
  const allVisited: StandardizedAtlasDocument[] = [];

  for (const root of roots) {
    const visited = traverseStandardizedDocument(root, callback, maxDepth);
    allVisited.push(...visited);
  }

  return allVisited;
}
