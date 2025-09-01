import { Tree, TreeNode } from './tree';

// Create a function which accepts a tree and writes a formatted representation of it to the console
export function logTree(tree: Tree) {
  const logNode = (node: TreeNode, depth: number) => {
    console.log(`${'  '.repeat(depth)}- ${node.id} (${node.blockType})`);
    if (node.children) {
      node.children.forEach((child) => logNode(child, depth + 1));
    }
  };
  logNode(tree.root, 0);
}
