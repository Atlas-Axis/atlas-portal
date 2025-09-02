import { TreeNode, TreeNodeMap } from './tree';

export type TreeChange =
  | { type: 'added'; node: TreeNode; parentId: string | null; content: string | null; canonicalDocumentTitle: string }
  | { type: 'deleted'; node: TreeNode; parentId: string | null; content: string | null; canonicalDocumentTitle: string }
  | {
      type: 'edited';
      node: TreeNode;
      parentId: string | null;
      changes: { newContent: string | null; oldContent: string | null };
      canonicalDocumentTitle: string;
    }
  | {
      type: 'moved';
      node: TreeNode;
      parentId: string | null;
      content: string | null;
      changes: { newParentId: string | null; oldParentId: string | null; newPosition: number; oldPosition: number };
      canonicalDocumentTitle: string;
    };

// TODO: Make sure to pre-sort blocks by position in the Supabase query for better performance during diffing
export function diffTrees({
  originalNodeMap,
  duplicateNodeMap,
  originalRoot,
  duplicateRoot,
  originalContentMap,
  duplicateContentMap,
}: {
  originalNodeMap: TreeNodeMap;
  duplicateNodeMap: TreeNodeMap;
  originalRoot: TreeNode;
  duplicateRoot: TreeNode;
  originalContentMap: Map<string, string | null>;
  duplicateContentMap: Map<string, string | null>;
}): TreeChange[] {
  const changes: TreeChange[] = [];
  const processedNodes = new Set<string>();

  console.log(`Starting diff: ${originalNodeMap.size} original nodes, ${duplicateNodeMap.size} duplicate nodes`);

  // Helper function to recursively mark all descendants as processed for added/deleted/moved nodes
  function markDescendantsAsProcessed(node: TreeNode) {
    if (node.children) {
      node.children.forEach((child) => {
        processedNodes.add(child.id);
        markDescendantsAsProcessed(child);
      });
    }
  }

  // Depth-First Search helper function to compare nodes hierarchically
  function compareNode(nodeId: string) {
    if (processedNodes.has(nodeId)) return;
    processedNodes.add(nodeId);

    const originalNode = originalNodeMap.get(nodeId);
    const duplicateNode = duplicateNodeMap.get(nodeId);

    // Handle the current node
    if (!originalNode && duplicateNode) {
      // Added (exists in duplicate but not in original)
      changes.push({
        type: 'added',
        node: duplicateNode,
        parentId: duplicateNode.parentId,
        content: duplicateContentMap.get(duplicateNode.id) || null,
        canonicalDocumentTitle: duplicateNode.canonicalDocumentTitle || '',
      });
      // Mark all descendants as processed since they're part of the added subtree
      markDescendantsAsProcessed(duplicateNode);
      return; // Skip processing children since the whole subtree is added
    } else if (originalNode && !duplicateNode) {
      // Deleted (exists in original but missing from duplicate)
      changes.push({
        type: 'deleted',
        node: originalNode,
        parentId: originalNode.parentId,
        content: originalContentMap.get(originalNode.id) || null,
        canonicalDocumentTitle: originalNode.canonicalDocumentTitle || '',
      });
      // Mark all descendants as processed since they're part of the deleted subtree
      markDescendantsAsProcessed(originalNode);
      return; // Skip processing children since the whole subtree is deleted
    } else if (originalNode && duplicateNode) {
      // Check for moves (parent or position changed)
      const parentChanged = originalNode.parentId !== duplicateNode.parentId;
      const positionChanged = originalNode.sortOrder !== duplicateNode.sortOrder;
      const wasMoved = parentChanged || positionChanged;

      if (wasMoved) {
        // Only record moves where the parent changed (ignore position-only moves, those depend on Notion database sorting settings anyway)
        if (parentChanged) {
          changes.push({
            type: 'moved',
            node: duplicateNode,
            parentId: duplicateNode.parentId,
            content: duplicateContentMap.get(duplicateNode.id) || null,
            changes: {
              newParentId: duplicateNode.parentId,
              newPosition: duplicateNode.sortOrder,
              oldParentId: originalNode.parentId,
              oldPosition: originalNode.sortOrder,
            },
            canonicalDocumentTitle: duplicateNode.canonicalDocumentTitle || '',
          });
          // Mark all descendants as processed since they're part of the moved subtree
          markDescendantsAsProcessed(duplicateNode);
          return; // Skip processing children since the whole subtree was moved
        }
        // If only position changed (parent is the same), continue processing as normal
        // This allows checking for content edits without marking as moved
        // We can implement a more complex logic later if needed
      }

      // Check for edits (only if not moved)
      if (originalContentMap.get(originalNode.id) !== duplicateContentMap.get(duplicateNode.id)) {
        changes.push({
          type: 'edited',
          node: duplicateNode,
          parentId: duplicateNode.parentId,
          changes: {
            newContent: duplicateContentMap.get(duplicateNode.id) || null,
            oldContent: originalContentMap.get(originalNode.id) || null,
          },
          canonicalDocumentTitle: duplicateNode.canonicalDocumentTitle || '',
        });
      }
    }

    // Only process children if the node wasn't added, deleted, or moved
    // Recursively process children in hierarchical order
    const originalChildren = originalNode?.children || [];
    const duplicateChildren = duplicateNode?.children || [];

    // Process children in position order to maintain hierarchical consistency
    // Use a Map for O(1) lookups instead of O(n) Array.find
    const childrenMap = new Map<string, { id: string; sortOrder: number; inOriginal: boolean; inDuplicate: boolean }>();

    // Add original children
    originalChildren.forEach((child) => {
      childrenMap.set(child.id, { id: child.id, sortOrder: child.sortOrder, inOriginal: true, inDuplicate: false });
    });

    // Add/update duplicate children
    duplicateChildren.forEach((child) => {
      const existing = childrenMap.get(child.id);
      if (existing) {
        existing.inDuplicate = true;
        // Use the newer position (from duplicate) if it exists
        existing.sortOrder = child.sortOrder;
      } else {
        childrenMap.set(child.id, { id: child.id, sortOrder: child.sortOrder, inOriginal: false, inDuplicate: true });
      }
    });

    // Convert to array and sort by position to process in correct hierarchical order
    const allChildren = Array.from(childrenMap.values());
    allChildren.sort((a, b) => a.sortOrder - b.sortOrder);

    // Recursively process each child in position order (skip if already processed)
    allChildren.forEach(({ id }) => {
      if (!processedNodes.has(id)) {
        compareNode(id);
      }
    });
  }

  // Start DFS from both root nodes to ensure we catch all changes
  // Process original root first, then duplicate root (if different)
  compareNode(originalRoot.id);
  if (duplicateRoot.id !== originalRoot.id) {
    compareNode(duplicateRoot.id);
  }

  console.log(`Diff complete: found ${changes.length} changes, processed ${processedNodes.size} nodes`);

  return changes;
}
