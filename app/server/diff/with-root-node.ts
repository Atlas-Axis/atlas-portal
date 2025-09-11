import { TreeNode } from './tree';

/**
 * Adds a synthetic root node to the tree nodes if there are multiple root nodes.
 */
export function withRootNode(treeNodes: TreeNode[]) {
  if (treeNodes.length === 0) return [];

  const rootNode: TreeNode = {
    id: 'root',
    parentId: null,
    type: 'root',
    sortOrder: 0,
    canonicalDocumentTitle: '',
  };
  treeNodes.push(rootNode);

  // Set parentId of original root nodes to the new root node
  const originalRootNodes = treeNodes.filter((node) => node.parentId === null && node.id !== rootNode.id);
  console.log('Original root node count: ', originalRootNodes.length);
  for (const node of originalRootNodes) {
    node.parentId = rootNode.id;
  }

  const newRootNodes = treeNodes.filter((node) => node.parentId === null && node.id !== rootNode.id);
  console.log('New root node count: ', newRootNodes.length);

  return treeNodes;
}
