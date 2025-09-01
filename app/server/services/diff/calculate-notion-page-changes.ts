import { convertSupabaseDatabasePagesToTreeNodes } from '@/app/server/services/diff/convert-supabase-database-pages-to-tree-nodes';
import { TreeNode, buildTree } from '@/app/server/services/diff/tree';
import { getNotionDatabaseIdFromNotionPage } from '@/app/server/services/supabase/get-notion-database-id-from-notion-page';
import { loadNotionDatabasePagesFromSupabase } from '@/app/server/services/supabase/load-notion-database-pages-from-supabase';
import { loadTextContentForNotionPageIds } from '../supabase/load-text-content-for-notion-page-ids';
import { logTree } from './console-log-tree';
import { TreeChange, diffTrees } from './diff-trees';
import { extractSubtreeAsTree, extractSubtreePageIds } from './extract-subtree';

const DEBUG_LOGGING = Boolean(process.env.DEBUG_LOGGING);

export async function calculateNotionPageHierarchyChanges({
  originalRootNotionPageId,
  duplicatedRootNotionPageId,
}: {
  originalRootNotionPageId: string;
  duplicatedRootNotionPageId: string;
}): Promise<TreeChange[]> {
  const startTime = Date.now();

  // Step 1: Load Notion database IDs from Supabase
  console.log('Step 1: Loading Notion database IDs from Supabase...');
  const originalNotionDatabaseId = await getNotionDatabaseIdFromNotionPage(originalRootNotionPageId);
  const duplicatedNotionDatabaseId = await getNotionDatabaseIdFromNotionPage(duplicatedRootNotionPageId);

  if (!originalNotionDatabaseId || !duplicatedNotionDatabaseId) {
    throw new Error('Failed to retrieve Notion database IDs');
  }

  // Step 2: Load original Notion pages and editable copies with pagination from Supabase
  console.log('Step 2: Loading Notion pages from Supabase...');
  const originalPages = await loadNotionDatabasePagesFromSupabase(originalNotionDatabaseId);
  const duplicatedPages = await loadNotionDatabasePagesFromSupabase(duplicatedNotionDatabaseId);

  console.log(`Loaded ${originalPages.length} original and ${duplicatedPages.length} duplicate pages from Supabase`);

  // Step 3: Build tree structure and extract subtree
  console.log('Step 3: Building tree structures and extracting subtrees...');
  const originalTreeNodes = convertSupabaseDatabasePagesToTreeNodes(originalPages);
  const duplicatedTreeNodes = convertSupabaseDatabasePagesToTreeNodes(duplicatedPages);

  // Step 4: Add a dummy root node for both trees to connect all top-level pages, solving the multiple roots issue. These 2 nodes will be omitted later anyway
  console.log('Step 4: Adding root nodes to both trees...');
  const originalDummyRoot = createDummyRootNode(originalNotionDatabaseId);
  const duplicatedDummyRoot = createDummyRootNode(duplicatedNotionDatabaseId);

  // Make all current root nodes (parentId === null) children of the dummy root
  const originalTreeNodesWithDummyRoot = originalTreeNodes.map((node) =>
    node.parentId === null ? { ...node, parentId: originalDummyRoot.id } : node,
  );
  const duplicatedTreeNodesWithDummyRoot = duplicatedTreeNodes.map((node) =>
    node.parentId === null ? { ...node, parentId: duplicatedDummyRoot.id } : node,
  );
  // Prepend dummy root nodes to both trees
  originalTreeNodesWithDummyRoot.unshift(originalDummyRoot);
  duplicatedTreeNodesWithDummyRoot.unshift(duplicatedDummyRoot);

  // Step 5: Build trees and maps
  const originalTree = buildTree(originalTreeNodesWithDummyRoot);
  const originalPageIdMap = new Map(originalPages.map((page) => [page.notion_page_id, page]));

  const duplicateTree = buildTree(duplicatedTreeNodesWithDummyRoot);
  const duplicatedPageIdMap = new Map(duplicatedPages.map((page) => [page.notion_page_id, page]));

  logTree(originalTree);
  logTree(duplicateTree);

  // Step 6: Extract subtrees starting from originalRootNotionPageId and duplicatedRootNotionPageId
  console.log('Step 6: Extracting subtrees from both trees...');

  // Extract subtrees as proper Tree objects, not just page IDs
  const originalSubtree = extractSubtreeAsTree(originalTree, originalRootNotionPageId);
  const duplicatedSubtree = extractSubtreeAsTree(duplicateTree, duplicatedRootNotionPageId);

  // Get page IDs from subtrees for content loading
  const originalSubtreePageIds = extractSubtreePageIds(originalTree, originalRootNotionPageId);
  const duplicatedSubtreePageIds = extractSubtreePageIds(duplicateTree, duplicatedRootNotionPageId);

  // Get pages for logging
  const originalSubtreePages = originalSubtreePageIds
    .map((pageId: string) => originalPageIdMap.get(pageId)!)
    .filter(Boolean);

  const duplicatedSubtreePages = duplicatedSubtreePageIds
    .map((pageId: string) => duplicatedPageIdMap.get(pageId)!)
    .filter(Boolean);

  console.log(`Extracted original subtree with ${originalSubtreePages.length} pages`);
  console.log(`Original subtree page IDs: ${originalSubtreePageIds.join(', ')}`);
  console.log(
    `Subtree pages found:`,
    originalSubtreePages.map((p) => `${p.notion_page_id} (${p.plain_text_name})`),
  );

  console.log(`Extracted duplicated subtree with ${duplicatedSubtreePages.length} pages`);
  console.log(`Duplicated subtree page IDs: ${duplicatedSubtreePageIds.join(', ')}`);
  console.log(
    `Subtree pages found:`,
    duplicatedSubtreePages.map((p) => `${p.notion_page_id} (${p.plain_text_name})`),
  );

  // Use the subtree node maps instead of full tree node maps
  const { nodeMap: originalNodeMap, root: originalRoot } = originalSubtree;
  const { nodeMap: duplicateNodeMap, root: duplicateRoot } = duplicatedSubtree;

  // Step 7: Load text content for all nodes from Supabase into a single map
  console.log('Step 7: Loading text content for all subtree pages from Supabase...');
  const originalSubtreeContent = await loadTextContentForNotionPageIds(originalSubtreePageIds);
  const duplicatedSubtreeContent = await loadTextContentForNotionPageIds(duplicatedSubtreePageIds);
  const nodeIdToContentMap = new Map<string, string | null>();
  for (const [id, content] of Object.entries(originalSubtreeContent)) {
    nodeIdToContentMap.set(id, content || null);
  }
  for (const [id, content] of Object.entries(duplicatedSubtreeContent)) {
    nodeIdToContentMap.set(id, content || null);
  }

  // Step 8: Map duplicate pages' Notion page IDs to original page IDs
  const pageIdMappingDuplicatedToOriginal = duplicatedPages.reduce((map, page) => {
    if (page.edit_page_original_notion_page_id) {
      map.set(page.notion_page_id, page.edit_page_original_notion_page_id);
    }
    return map;
  }, new Map<string, string>());

  console.log(`Created mapping with ${pageIdMappingDuplicatedToOriginal.size} entries:`);
  console.log('Sample mapping entries:', Array.from(pageIdMappingDuplicatedToOriginal.entries()).slice(0, 3));

  // Step 9: Calculate the differences
  const changes = diffTrees({
    originalNodeMap,
    duplicateNodeMap,
    originalRoot,
    duplicateRoot,
    nodeIdToContentMap,
    pageIdMappingDuplicatedToOriginal,
    skipRootNodes: true, // Skip dummy root nodes from comparison
  });

  if (DEBUG_LOGGING) {
    console.log('Calculated changes:', {
      changes,
      json: JSON.stringify(
        changes.map((change) => ({ ...change, node: JSON.stringify(change.node, null, 2) })),
        null,
        2,
      ),
    });
  }

  const endTime = Date.now();
  const executionTimeSeconds = (endTime - startTime) / 1000;
  console.log(`calculateNotionPageChanges execution time: ${executionTimeSeconds.toFixed(2)} seconds`);

  return changes;
}

function createDummyRootNode(rootId: string): TreeNode {
  return {
    id: `__DUMMY_ROOT__${rootId}`,
    parentId: null,
    blockType: 'dummy_root',
    sortOrder: 0,
    rootNotionPageId: rootId,
  };
}
