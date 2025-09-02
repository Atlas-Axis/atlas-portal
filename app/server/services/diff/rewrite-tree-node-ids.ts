import { Tree, TreeNode, buildTree } from './tree';

/**
 * Rewrite node IDs in a tree using a mapping from old IDs to new IDs.
 * This creates a new tree with updated IDs, leaving the original tree unchanged.
 *
 * @param tree The tree to rewrite
 * @param idMapping Map from old node IDs to new node IDs
 * @returns A new tree with rewritten node IDs
 */
export function rewriteTreeNodeIds(tree: Tree, idMapping: Map<string, string>): Tree {
  console.log(`Rewriting tree node IDs using mapping with ${idMapping.size} entries`);

  const newNodes: TreeNode[] = [];
  const unmappedIds: string[] = [];

  // Traverse the tree and create new nodes with rewritten IDs
  function traverse(node: TreeNode) {
    const newId = idMapping.get(node.id);
    const newParentId = node.parentId ? idMapping.get(node.parentId) || node.parentId : null;

    if (!newId) {
      unmappedIds.push(node.id);
      console.warn(`No mapping found for node ID: ${node.id}, keeping original ID`);
    }

    const newNode: TreeNode = {
      id: newId || node.id, // Use mapped ID or keep original if no mapping exists
      parentId: newParentId,
      blockType: node.blockType,
      sortOrder: node.sortOrder,
      rootNotionPageId: node.rootNotionPageId,
      canonicalDocumentTitle: node.canonicalDocumentTitle,
      // children will be set by buildTree
    };

    newNodes.push(newNode);

    // Traverse children
    if (node.children) {
      node.children.forEach(traverse);
    }
  }

  traverse(tree.root);

  // Build the new tree with rewritten IDs
  const newTree = buildTree(newNodes);

  console.log(
    `Rewritten tree: ${newNodes.length} nodes processed, root ID changed from ${tree.root.id} to ${newTree.root.id}`,
  );
  if (unmappedIds.length > 0) {
    console.log(`Unmapped node IDs: ${unmappedIds.join(', ')}`);
  }

  return newTree;
}
