export type Tree = {
  root: TreeNode;
  nodeMap: TreeNodeMap;
};

export type TreeNode = {
  id: string;
  parentId: string | null;
  type: string;
  sortOrder: number | null;
  canonicalDocumentTitle: string;
  // TODO: add docNo field
  // Tree structure
  children?: TreeNode[];
};

export type TreeNodeMap = Map<string, TreeNode>;

export function buildTree(nodes: TreeNode[]): Tree {
  const nodeMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  const orphanedNodes: TreeNode[] = [];

  console.log(`🔧 BuildTree: Processing ${nodes.length} nodes`);

  // Use a Map for O(1) lookups instead of O(n) Array.find
  nodes.forEach((node) => {
    node.children = [];
    nodeMap.set(node.id, node);
  });

  // Build tree - since nodes are pre-sorted by sortOrder in the Supabase query,
  // children will be added to parents in the correct sort order
  nodes.forEach((node) => {
    if (node.parentId) {
      const parent = nodeMap.get(node.parentId);
      if (parent) {
        parent.children!.push(node);
        // If sortOrder is lower than the previous sibling's, log a warning
        verifySortOrder(parent, node);
      } else {
        orphanedNodes.push(node);
      }
    } else {
      roots.push(node); // top-level node
    }
  });

  // Log orphaned nodes if any
  logOrphanedNodes(orphanedNodes);

  // Checks
  verifyRootNodeCount(roots.length);

  console.log(`🔧 BuildTree: Result has ${nodeMap.size} nodes in nodeMap, ${roots.length} root nodes`);

  return { root: roots[0], nodeMap };
}

// If sortOrder is lower than the previous sibling's, log a warning
function verifySortOrder(parent: TreeNode, node: TreeNode) {
  const children = parent.children ?? [];
  const count = children.length;
  if (count > 1) {
    const prevSibling = children[count - 2];
    if (prevSibling && node.sortOrder < prevSibling.sortOrder) {
      console.warn(
        `Child node ${node.id} has a lower sortOrder than the previous sibling. Make sure to pre-sort the nodes by sortOrder in the Supabase query.`,
      );
    }
  }
}

function verifyRootNodeCount(rootCount: number) {
  if (rootCount === 0) {
    throw new Error('No root node found');
  } else if (rootCount > 1) {
    throw new Error(`More than one root node found (${rootCount})`);
  }
}

function logOrphanedNodes(orphanedNodes: TreeNode[]) {
  const orphanedNodeCount = orphanedNodes.length;
  if (orphanedNodeCount > 0) {
    console.log(`⚠️  Found ${orphanedNodeCount} orphaned nodes (parent references missing)`);
    if (orphanedNodeCount <= 10) {
      console.log('Orphaned nodes:');
      orphanedNodes.forEach((node) => {
        console.log(`  - ${node.id} (parent: ${node.parentId}): "${node.canonicalDocumentTitle}"`);
      });
    } else {
      console.log('First 5 orphaned nodes:');
      orphanedNodes.slice(0, 5).forEach((node) => {
        console.log(`  - ${node.id} (parent: ${node.parentId}): "${node.canonicalDocumentTitle}"`);
      });
    }
  }
}
