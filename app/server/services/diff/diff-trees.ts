// import { TreeNode, TreeNodeMap } from './tree';

// export type TreeChange =
//   | { type: 'added'; node: TreeNode; parentId: string | null; content: string | null }
//   | { type: 'deleted'; node: TreeNode; parentId: string | null; content: string | null }
//   | {
//       type: 'edited';
//       node: TreeNode;
//       parentId: string | null;
//       changes: { newContent: string | null; oldContent: string | null };
//     }
//   | {
//       type: 'moved';
//       node: TreeNode;
//       parentId: string | null;
//       content: string | null;
//       changes: { newParentId: string | null; oldParentId: string | null; newPosition: number; oldPosition: number };
//     };

// export function diffTrees({
//   originalNodeMap,
//   duplicateNodeMap,
//   originalRoots,
//   duplicateRoots,
// }: {
//   originalNodeMap: TreeNodeMap;
//   duplicateNodeMap: TreeNodeMap;
//   originalRoots: TreeNode[];
//   duplicateRoots: TreeNode[];
// }): TreeChange[] {
//   const changes: TreeChange[] = [];
//   const processedNodes = new Set<string>();

//   console.log(`Starting diff: ${originalNodeMap.size} original nodes, ${duplicateNodeMap.size} duplicate nodes`);

//   // Helper function to recursively mark all descendants as processed for added/deleted/moved nodes
//   function markDescendantsAsProcessed(node: TreeNode) {
//     if (node.children) {
//       node.children.forEach((child) => {
//         processedNodes.add(child.id);
//         markDescendantsAsProcessed(child);
//       });
//     }
//   }

//   // Depth-First Search helper function to compare nodes hierarchically
//   function compareNode(nodeId: string) {
//     if (processedNodes.has(nodeId)) return;
//     processedNodes.add(nodeId);

//     const originalNode = originalNodeMap.get(nodeId);
//     const duplicateNode = duplicateNodeMap.get(nodeId);

//     // Handle the current node
//     if (!originalNode && duplicateNode) {
//       // Added (exists in duplicate but not in original)
//       changes.push({
//         type: 'added',
//         node: duplicateNode,
//         parentId: duplicateNode.parent_id,
//         content: duplicateNode.content,
//       });
//       // Mark all descendants as processed since they're part of the added subtree
//       markDescendantsAsProcessed(duplicateNode);
//       return; // Skip processing children since the whole subtree is added
//     } else if (originalNode && !duplicateNode) {
//       // Deleted (exists in original but missing from duplicate)
//       changes.push({
//         type: 'deleted',
//         node: originalNode,
//         parentId: originalNode.parent_id,
//         content: originalNode.content,
//       });
//       // Mark all descendants as processed since they're part of the deleted subtree
//       markDescendantsAsProcessed(originalNode);
//       return; // Skip processing children since the whole subtree is deleted
//     } else if (originalNode && duplicateNode) {
//       // Check for moves (parent or position changed)
//       const parentChanged = originalNode.parent_id !== duplicateNode.parent_id;
//       const positionChanged = originalNode.position !== duplicateNode.position;
//       const wasMoved = parentChanged || positionChanged;

//       if (wasMoved) {
//         // Only record moves where the parent changed (ignore position-only moves)
//         if (parentChanged) {
//           changes.push({
//             type: 'moved',
//             node: duplicateNode,
//             parentId: duplicateNode.parent_id,
//             content: duplicateNode.content,
//             changes: {
//               newParentId: duplicateNode.parent_id,
//               newPosition: duplicateNode.position,
//               oldParentId: originalNode.parent_id,
//               oldPosition: originalNode.position,
//             },
//           });
//           // Mark all descendants as processed since they're part of the moved subtree
//           markDescendantsAsProcessed(duplicateNode);
//           return; // Skip processing children since the whole subtree was moved
//         }
//         // If only position changed (parent is the same), continue processing as normal
//         // This allows checking for content edits without marking as moved
//         // We can implement a more complex logic later if needed
//       }

//       // Check for edits (only if not moved)
//       if (originalNode.content !== duplicateNode.content) {
//         changes.push({
//           type: 'edited',
//           node: duplicateNode,
//           parentId: duplicateNode.parent_id,
//           changes: { newContent: duplicateNode.content, oldContent: originalNode.content },
//         });
//       }
//     }

//     // Only process children if the node wasn't added, deleted, or moved
//     // Recursively process children in hierarchical order
//     const originalChildren = originalNode?.children || [];
//     const duplicateChildren = duplicateNode?.children || [];

//     // Process children in position order to maintain hierarchical consistency
//     // Use a Map for O(1) lookups instead of O(n) Array.find
//     const childrenMap = new Map<string, { id: string; position: number; inOriginal: boolean; inDuplicate: boolean }>();

//     // Add original children
//     originalChildren.forEach((child) => {
//       childrenMap.set(child.id, { id: child.id, position: child.position, inOriginal: true, inDuplicate: false });
//     });

//     // Add/update duplicate children
//     duplicateChildren.forEach((child) => {
//       const existing = childrenMap.get(child.id);
//       if (existing) {
//         existing.inDuplicate = true;
//         // Use the newer position (from duplicate) if it exists
//         existing.position = child.position;
//       } else {
//         childrenMap.set(child.id, { id: child.id, position: child.position, inOriginal: false, inDuplicate: true });
//       }
//     });

//     // Convert to array and sort by position to process in correct hierarchical order
//     const allChildren = Array.from(childrenMap.values());
//     allChildren.sort((a, b) => a.position - b.position);

//     // Recursively process each child in position order (skip if already processed)
//     allChildren.forEach(({ id }) => {
//       if (!processedNodes.has(id)) {
//         compareNode(id);
//       }
//     });
//   }

//   // Start DFS from root nodes in their correct position order
//   // Use a Map for O(1) lookups instead of O(n) Array.find
//   const rootsMap = new Map<string, { id: string; position: number }>();

//   // Add original roots
//   originalRoots.forEach((root) => {
//     rootsMap.set(root.id, { id: root.id, position: root.position });
//   });

//   // Add duplicate roots (will overwrite with newer position if exists)
//   duplicateRoots.forEach((root) => {
//     rootsMap.set(root.id, { id: root.id, position: root.position });
//   });

//   // Convert to array and sort by position to process in correct hierarchical order
//   const allRoots = Array.from(rootsMap.values());
//   // Sorting root nodes by position ensures hierarchical consistency in the diff process
//   allRoots.sort((a, b) => a.position - b.position);

//   // Process each root and its subtree in position order
//   allRoots.forEach(({ id }) => compareNode(id));

//   console.log(`Diff complete: found ${changes.length} changes, processed ${processedNodes.size} nodes`);

//   return changes;
// }
