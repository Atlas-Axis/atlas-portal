import { Tree, TreeNode, buildTree } from './tree';

/**
 * Extract a subtree starting from rootPageId and return it as a new Tree object
 * This creates a new tree containing only the subtree nodes, with the specified root as the new root
 */
export function extractSubtreeAsTree(tree: Tree, rootPageId: string): Tree {
  // If the tree's root id is the same as the rootPageId, return the entire tree
  if (tree.root.id === rootPageId) {
    console.log(`Root page ${rootPageId} is the same as tree root - returning entire tree`);
    return tree;
  }

  // Find the root node in the tree
  const rootNode = tree.nodeMap.get(rootPageId);
  if (!rootNode) {
    throw new Error(`Root page ${rootPageId} not found in tree`);
  }

  // Collect all nodes in the subtree
  const subtreeNodes: TreeNode[] = [];

  function traverse(node: TreeNode) {
    // Create a copy of the node for the new tree
    const nodeCopy: TreeNode = {
      id: node.id,
      parentId: node.parentId,
      type: node.type,
      sortOrder: node.sortOrder,
      rootNotionPageId: node.rootNotionPageId,
      canonicalDocumentTitle: node.canonicalDocumentTitle,
      // Don't copy children - they'll be set by buildTree
    };

    subtreeNodes.push(nodeCopy);

    // Visit children in sort order
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(rootNode);

  // Update parent relationships for the new tree
  // The specified root should have no parent (become the new root)
  const updatedNodes = subtreeNodes.map((node) => {
    if (node.id === rootPageId) {
      return { ...node, parentId: null };
    }
    return node;
  });

  // Build the new tree
  const subtree = buildTree(updatedNodes);

  console.log(`Extracted subtree with ${subtreeNodes.length} nodes, root: ${rootPageId}`);

  return subtree;
}

/**
 * Extract all page IDs in the subtree starting from rootPageId
 * This is the original function, kept for backward compatibility
 */
export function extractSubtreePageIds(tree: Tree, rootPageId: string): string[] {
  const result: string[] = [];

  // If the tree's root id is the same as the rootPageId, return all nodes in the tree
  if (tree.root.id === rootPageId) {
    console.log(`Root page ${rootPageId} is the same as tree root - returning entire tree`);
    function traverseEntireTree(node: TreeNode) {
      result.push(node.id);
      if (node.children) {
        for (const child of node.children) {
          traverseEntireTree(child);
        }
      }
    }
    traverseEntireTree(tree.root);
    return result;
  }

  // Find the root node in the tree
  const rootNode = tree.nodeMap.get(rootPageId);
  if (!rootNode) {
    throw new Error(`Root page ${rootPageId} not found in tree`);
  }

  // Perform depth-first traversal from the root node
  function traverse(node: TreeNode) {
    result.push(node.id);

    // Visit children in sort order (they're already sorted by buildTree)
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(rootNode);
  return result;
}
