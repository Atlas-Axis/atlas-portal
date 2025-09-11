import { Tree, TreeNode } from './tree';

/**
 * Visualizes a tree hierarchy using console logs with indentation.
 * Each node is displayed with its canonicalDocumentTitle, indented based on its depth.
 */
export function visualizeTree(tree: Tree): void {
  console.log('Tree Structure:');
  console.log('==============');

  if (!tree.root) {
    console.log('(empty tree)');
    return;
  }

  visualizeNode(tree.root, 0);
}

/**
 * Recursively visualizes a node and its children with proper indentation.
 */
function visualizeNode(node: TreeNode, depth: number): void {
  const indent = '  '.repeat(depth); // 2 spaces per level
  const title = node.canonicalDocumentTitle || '(no title)';

  console.log(`${indent}${title}`);

  // Recursively visualize children
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      visualizeNode(child, depth + 1);
    }
  }
}

/**
 * Alternative visualization with tree-like ASCII characters.
 * Uses └── and ├── to show tree structure more clearly.
 */
export function visualizeTreeWithAscii(tree: Tree): void {
  console.log('Tree Structure:');
  console.log('==============');

  if (!tree.root) {
    console.log('(empty tree)');
    return;
  }

  visualizeNodeWithAscii(tree.root, '', true);
}

function visualizeNodeWithAscii(node: TreeNode, prefix: string, isLast: boolean): void {
  const title = node.canonicalDocumentTitle || '(no title)';
  const connector = isLast ? '└── ' : '├── ';

  console.log(`${prefix}${connector}${title}`);

  if (node.children && node.children.length > 0) {
    const childPrefix = prefix + (isLast ? '    ' : '│   ');

    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      const isLastChild = i === node.children.length - 1;
      visualizeNodeWithAscii(child, childPrefix, isLastChild);
    }
  }
}
