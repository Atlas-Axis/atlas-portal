import { isValidDocumentNumber } from './atlas-tree-numbering';
import { NotionAtlasTreeNode } from './atlas-tree-types';

/**
 * Traversal callback function type for tree operations.
 *
 * @param node - The current node being visited
 * @param depth - The depth of the current node (0 for root)
 * @param parent - The parent node (undefined for root nodes)
 * @returns Whether to continue traversal (true) or stop (false)
 */
export type TraversalCallback = (node: NotionAtlasTreeNode, depth: number, parent?: NotionAtlasTreeNode) => boolean;

/**
 * Traversal order options for tree operations.
 */
export type TraversalOrder = 'preorder' | 'postorder' | 'levelorder';

/**
 * Performs a pre-order traversal of the Atlas tree structure.
 *
 * Pre-order traversal visits the current node before its children, making it ideal for:
 * - Document numbering (parent numbers must be assigned before children)
 * - Building hierarchical structures
 * - Top-down processing
 *
 * @param root - The root node to start traversal from
 * @param callback - Function to call for each visited node
 * @param maxDepth - Maximum depth to traverse (prevents infinite recursion)
 * @returns Array of all visited nodes in pre-order
 *
 * @example
 * ```typescript
 * const nodes: NotionAtlasTreeNode[] = [];
 * preOrderTraversal(scopeTree, (node, depth) => {
 *   console.log(`${'  '.repeat(depth)}${node.generatedDocID} - ${node.plain_text_name}`);
 *   nodes.push(node);
 *   return true; // Continue traversal
 * });
 * ```
 */
export function preOrderTraversal(
  root: NotionAtlasTreeNode,
  callback: TraversalCallback,
  maxDepth: number = 50,
): NotionAtlasTreeNode[] {
  const visited: NotionAtlasTreeNode[] = [];
  const visitedIds = new Set<string>();

  function traverse(node: NotionAtlasTreeNode, depth: number, parent?: NotionAtlasTreeNode): void {
    if (depth > maxDepth) {
      throw new Error(`Maximum traversal depth (${maxDepth}) exceeded`);
    }

    if (visitedIds.has(node.notion_page_id)) {
      throw new Error(`Circular reference detected at node ${node.notion_page_id}`);
    }

    visitedIds.add(node.notion_page_id);
    visited.push(node);

    try {
      const shouldContinue = callback(node, depth, parent);
      if (!shouldContinue) {
        return;
      }

      // Visit all children in order
      const allChildren = [
        ...node.scopes,
        ...node.articles,
        ...node.sectionsAndPrimaryDocs,
        ...node.annotations,
        ...node.tenets,
        ...node.scenarios,
        ...node.scenarioVariations,
        ...node.activeData,
        ...node.agentScopeDocs,
        ...node.neededResearch,
      ];

      for (const child of allChildren) {
        traverse(child, depth + 1, node);
      }
    } finally {
      // IMPORTANT: Remove from visitedIds when backtracking to allow legitimate multiple references
      visitedIds.delete(node.notion_page_id);
    }
  }

  traverse(root, 0);
  return visited;
}

/**
 * Performs a post-order traversal of the Atlas tree structure.
 *
 * Post-order traversal visits children before the current node, making it ideal for:
 * - Cleanup operations
 * - Bottom-up processing
 * - Calculating aggregate values from children
 *
 * @param root - The root node to start traversal from
 * @param callback - Function to call for each visited node
 * @param maxDepth - Maximum depth to traverse (prevents infinite recursion)
 * @returns Array of all visited nodes in post-order
 *
 * @example
 * ```typescript
 * // Calculate total child count for each node
 * const childCounts = new Map<string, number>();
 * postOrderTraversal(scopeTree, (node, depth) => {
 *   const totalChildren = node.scopes.length + node.articles.length + node.sectionsAndPrimaryDocs.length;
 *   childCounts.set(node.notion_page_id, totalChildren);
 *   return true;
 * });
 * ```
 */
export function postOrderTraversal(
  root: NotionAtlasTreeNode,
  callback: TraversalCallback,
  maxDepth: number = 50,
): NotionAtlasTreeNode[] {
  const visited: NotionAtlasTreeNode[] = [];
  const visitedIds = new Set<string>();

  function traverse(node: NotionAtlasTreeNode, depth: number, parent?: NotionAtlasTreeNode): void {
    if (depth > maxDepth) {
      throw new Error(`Maximum traversal depth (${maxDepth}) exceeded`);
    }

    if (visitedIds.has(node.notion_page_id)) {
      throw new Error(`Circular reference detected at node ${node.notion_page_id}`);
    }

    visitedIds.add(node.notion_page_id);

    try {
      // Visit all children first
      const allChildren = [
        ...node.scopes,
        ...node.articles,
        ...node.sectionsAndPrimaryDocs,
        ...node.annotations,
        ...node.tenets,
        ...node.scenarios,
        ...node.scenarioVariations,
        ...node.activeData,
        ...node.agentScopeDocs,
        ...node.neededResearch,
      ];

      for (const child of allChildren) {
        traverse(child, depth + 1, node);
      }

      // Visit current node after children
      visited.push(node);
      callback(node, depth, parent);
    } finally {
      // IMPORTANT: Remove from visitedIds when backtracking to allow legitimate multiple references
      visitedIds.delete(node.notion_page_id);
    }
  }

  traverse(root, 0);
  return visited;
}

/**
 * Performs a level-order (breadth-first) traversal of the Atlas tree structure.
 *
 * Level-order traversal visits nodes level by level, making it ideal for:
 * - Finding nodes at specific depths
 * - Building flat lists with depth information
 * - Breadth-first search operations
 *
 * @param root - The root node to start traversal from
 * @param callback - Function to call for each visited node
 * @param maxDepth - Maximum depth to traverse (prevents infinite recursion)
 * @returns Array of all visited nodes in level-order
 *
 * @example
 * ```typescript
 * // Find all nodes at depth 2
 * const depth2Nodes: NotionAtlasTreeNode[] = [];
 * levelOrderTraversal(scopeTree, (node, depth) => {
 *   if (depth === 2) {
 *     depth2Nodes.push(node);
 *   }
 *   return true;
 * });
 * ```
 */
export function levelOrderTraversal(
  root: NotionAtlasTreeNode,
  callback: TraversalCallback,
  maxDepth: number = 50,
): NotionAtlasTreeNode[] {
  const visited: NotionAtlasTreeNode[] = [];
  const visitedIds = new Set<string>();
  const queue: { node: NotionAtlasTreeNode; depth: number; parent?: NotionAtlasTreeNode }[] = [];

  queue.push({ node: root, depth: 0 });

  while (queue.length > 0) {
    const { node, depth, parent } = queue.shift()!;

    if (depth > maxDepth) {
      throw new Error(`Maximum traversal depth (${maxDepth}) exceeded`);
    }

    if (visitedIds.has(node.notion_page_id)) {
      throw new Error(`Circular reference detected at node ${node.notion_page_id}`);
    }

    visitedIds.add(node.notion_page_id);
    visited.push(node);

    const shouldContinue = callback(node, depth, parent);
    if (!shouldContinue) {
      break;
    }

    // Add all children to queue
    const allChildren = [
      ...node.scopes,
      ...node.articles,
      ...node.sectionsAndPrimaryDocs,
      ...node.annotations,
      ...node.tenets,
      ...node.scenarios,
      ...node.scenarioVariations,
      ...node.activeData,
      ...node.agentScopeDocs,
      ...node.neededResearch,
    ];

    for (const child of allChildren) {
      queue.push({ node: child, depth: depth + 1, parent: node });
    }
  }

  return visited;
}

/**
 * Generic tree traversal function that supports different traversal orders.
 *
 * @param root - The root node to start traversal from
 * @param callback - Function to call for each visited node
 * @param order - The traversal order to use
 * @param maxDepth - Maximum depth to traverse (prevents infinite recursion)
 * @returns Array of all visited nodes in the specified order
 */
export function traverseTree(
  root: NotionAtlasTreeNode,
  callback: TraversalCallback,
  order: TraversalOrder = 'preorder',
  maxDepth: number = 50,
): NotionAtlasTreeNode[] {
  switch (order) {
    case 'preorder':
      return preOrderTraversal(root, callback, maxDepth);
    case 'postorder':
      return postOrderTraversal(root, callback, maxDepth);
    case 'levelorder':
      return levelOrderTraversal(root, callback, maxDepth);
    default:
      throw new Error(`Unknown traversal order: ${order}`);
  }
}

/**
 * Finds a node by its generated document ID using tree traversal.
 *
 * @param root - The root node to search from
 * @param generatedDocID - The document ID to find
 * @returns The found node or undefined if not found
 *
 * @example
 * ```typescript
 * const node = findNodeByDocumentID(scopeTree, 'A.1.2.3');
 * if (node) {
 *   console.log(`Found: ${node.plain_text_name}`);
 * }
 * ```
 */
export function findNodeByDocumentID(
  root: NotionAtlasTreeNode,
  generatedDocID: string,
): NotionAtlasTreeNode | undefined {
  let found: NotionAtlasTreeNode | undefined;

  preOrderTraversal(root, (node) => {
    if (node.generatedDocID === generatedDocID) {
      found = node;
      return false; // Stop traversal
    }
    return true; // Continue traversal
  });

  return found;
}

/**
 * Finds all nodes that match a given predicate using tree traversal.
 *
 * @param root - The root node to search from
 * @param predicate - Function that returns true for matching nodes
 * @returns Array of all matching nodes
 *
 * @example
 * ```typescript
 * // Find all Section documents
 * const sections = findNodesByPredicate(scopeTree, node =>
 *   node.atlas_document_type === 'Section'
 * );
 * ```
 */
export function findNodesByPredicate(
  root: NotionAtlasTreeNode,
  predicate: (node: NotionAtlasTreeNode) => boolean,
): NotionAtlasTreeNode[] {
  const matches: NotionAtlasTreeNode[] = [];

  preOrderTraversal(root, (node) => {
    if (predicate(node)) {
      matches.push(node);
    }
    return true; // Continue traversal
  });

  return matches;
}

/**
 * Gets the path from root to a specific node.
 *
 * @param root - The root node to start from
 * @param targetNode - The target node to find the path to
 * @returns Array of nodes representing the path from root to target, or empty array if not found
 *
 * @example
 * ```typescript
 * const path = getNodePath(scopeTree, someNode);
 * console.log('Path:', path.map(node => node.generatedDocID).join(' -> '));
 * ```
 */
export function getNodePath(root: NotionAtlasTreeNode, targetNode: NotionAtlasTreeNode): NotionAtlasTreeNode[] {
  const path: NotionAtlasTreeNode[] = [];

  function findPath(currentNode: NotionAtlasTreeNode, currentPath: NotionAtlasTreeNode[]): boolean {
    const newPath = [...currentPath, currentNode];

    if (currentNode.notion_page_id === targetNode.notion_page_id) {
      path.push(...newPath);
      return true;
    }

    // Search in all children
    const allChildren = [
      ...currentNode.scopes,
      ...currentNode.articles,
      ...currentNode.sectionsAndPrimaryDocs,
      ...currentNode.annotations,
      ...currentNode.tenets,
      ...currentNode.scenarios,
      ...currentNode.scenarioVariations,
      ...currentNode.activeData,
      ...currentNode.agentScopeDocs,
      ...currentNode.neededResearch,
    ];

    for (const child of allChildren) {
      if (findPath(child, newPath)) {
        return true;
      }
    }

    return false;
  }

  findPath(root, []);
  return path;
}

/**
 * Gets the depth of a node in the tree.
 *
 * @param root - The root node to start from
 * @param targetNode - The target node to find the depth of
 * @returns The depth of the target node (0 for root), or -1 if not found
 */
export function getNodeDepth(root: NotionAtlasTreeNode, targetNode: NotionAtlasTreeNode): number {
  const path = getNodePath(root, targetNode);
  return path.length > 0 ? path.length - 1 : -1;
}

/**
 * Gets the total count of nodes in the tree.
 *
 * @param root - The root node to start from
 * @returns Total number of nodes in the tree
 */
export function getNodeCount(root: NotionAtlasTreeNode): number {
  let count = 0;

  preOrderTraversal(root, () => {
    count++;
    return true; // Continue traversal
  });

  return count;
}

/**
 * Validates the tree structure for common issues.
 *
 * @param root - The root node to validate
 * @returns Array of validation errors, empty if tree is valid
 */
export function validateTree(root: NotionAtlasTreeNode): string[] {
  const errors: string[] = [];
  const visitedIds = new Set<string>();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  preOrderTraversal(root, (node, depth) => {
    // Check for duplicate IDs
    if (visitedIds.has(node.notion_page_id)) {
      errors.push(`Duplicate node ID found: ${node.notion_page_id}`);
    }
    visitedIds.add(node.notion_page_id);

    // Check for missing generatedDocID
    if (!node.generatedDocID) {
      errors.push(`Missing generatedDocID for node: ${node.notion_page_id}`);
    }

    // Check for invalid document numbers
    if (node.generatedDocID && isValidDocumentNumber(node.generatedDocID) === false) {
      errors.push(`Invalid generatedDocID format: ${node.generatedDocID} for node ${node.notion_page_id}`);
    }

    return true; // Continue traversal
  });

  return errors;
}
