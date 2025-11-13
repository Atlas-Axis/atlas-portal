/* eslint-disable @typescript-eslint/no-unused-vars */
import { convertTreeChangesToAtlasProposal } from '@/app/server/atlas/proposal-generation/old/generate-proposal';
import { ProposalContext } from '@/app/server/atlas/proposal-generation/old/proposal-types';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { convertSupabaseDatabasePagesToTreeNodes } from '@/app/server/diff/to_delete/convert-supabase-database-pages-to-tree-nodes-old';
import { TreeNode, buildTree } from '@/app/server/diff/tree';
import { loadNotionDatabasePagesFromSupabase } from '@/app/server/services/supabase/load-notion-database-pages-from-supabase';
import { _delete_getNotionDatabaseIdFromNotionPage } from '@/app/server/services/supabase/to_delete/_old.get-notion-database-id-from-notion-page';
import { isValidUUID } from '@/app/shared/utils/utils';
import { loadTextContentForNotionPageIds } from '../../services/supabase/load-text-content-for-notion-page-ids';
import { logTree } from '../console-log-tree';
import { TreeChange, diffTrees } from '../diff-trees';
import { extractSubtreeAsTree, extractSubtreePageIds } from '../extract-subtree';
import { rewriteTreeNodeIds } from '../rewrite-tree-node-ids';

export async function _delete_calculateNotionPageHierarchyChanges({
  originalRootNotionPageId,
  duplicatedRootNotionPageId,
}: {
  originalRootNotionPageId: string;
  duplicatedRootNotionPageId: string;
}) {
  // }): Promise<{
  //   changes: TreeChange[];
  //   proposalMarkdown: string;
  //   context: ProposalContext;
  // }> {
  const startTime = Date.now();

  console.log(`Starting calculation of Notion page hierarchy changes...`);
  console.log(`Original root Notion page ID: ${originalRootNotionPageId}`);
  console.log(`Duplicated root Notion page ID: ${duplicatedRootNotionPageId}`);

  // Validate proper UUID formats using isValidUUID
  if (!isValidUUID(originalRootNotionPageId) || !isValidUUID(duplicatedRootNotionPageId)) {
    throw new Error('Invalid UUID format');
  }

  // Step 1: Load Notion database IDs from Supabase
  console.log('Step 1: Loading Notion database IDs from Supabase...');
  const originalNotionDatabaseId = await _delete_getNotionDatabaseIdFromNotionPage(originalRootNotionPageId);
  const duplicatedNotionDatabaseId = await _delete_getNotionDatabaseIdFromNotionPage(duplicatedRootNotionPageId);

  if (!originalNotionDatabaseId || !duplicatedNotionDatabaseId) {
    throw new Error('Failed to retrieve Notion database IDs');
  }

  // Step 2: Load original Notion pages and editable copies with pagination from Supabase
  console.log('Step 2: Loading Notion pages from Supabase...');

  // TODO: I've disabled actual loading for now to avoid type errors
  // const originalPages = await loadNotionDatabasePagesFromSupabase(originalNotionDatabaseId);
  // const duplicatedPages = await loadNotionDatabasePagesFromSupabase(duplicatedNotionDatabaseId);
  const originalPages: NotionDatabasePage[] = []; // await loadNotionDatabasePagesFromSupabase(originalNotionDatabaseId);
  const duplicatedPages: NotionDatabasePage[] = []; // await loadNotionDatabasePagesFromSupabase(duplicatedNotionDatabaseId);

  console.log(`Loaded ${originalPages.length} original and ${duplicatedPages.length} duplicate pages from Supabase`);

  // Step 3: Build tree structure and extract subtree
  console.log('Step 3: Building tree structures and extracting subtrees...');
  const originalTreeNodes = convertSupabaseDatabasePagesToTreeNodes(originalPages);
  const duplicatedTreeNodes = convertSupabaseDatabasePagesToTreeNodes(duplicatedPages);

  // Step 4: Add a dummy root node for both trees to connect all top-level pages, solving the multiple roots issue. These 2 nodes will be omitted later anyway
  console.log('Step 4: Adding root nodes to both trees...');
  const originalDummyRoot = createDummyRootNode(originalNotionDatabaseId);
  // const duplicatedDummyRoot = createDummyRootNode(duplicatedNotionDatabaseId);

  // Make all current root nodes (parentId === null) children of the dummy root
  const originalTreeNodesWithDummyRoot = originalTreeNodes.map((node) =>
    node.parentId === null ? { ...node, parentId: originalDummyRoot.id } : node,
  );
  // const duplicatedTreeNodesWithDummyRoot = duplicatedTreeNodes.map((node) =>
  //   node.parentId === null ? { ...node, parentId: duplicatedDummyRoot.id } : node,
  // );
  // Prepend dummy root nodes to both trees
  originalTreeNodesWithDummyRoot.unshift(originalDummyRoot);
  // duplicatedTreeNodesWithDummyRoot.unshift(duplicatedDummyRoot);

  // Step 5: Build trees and maps
  const originalTree = buildTree(originalTreeNodesWithDummyRoot);
  const originalPageIdMap = new Map(originalPages.map((page) => [page.notion_page_id, page]));

  const duplicateTree = buildTree(duplicatedTreeNodes);
  // const duplicateTree = buildTree(duplicatedTreeNodesWithDummyRoot);
  const duplicatedPageIdMap = new Map(duplicatedPages.map((page) => [page.notion_page_id, page]));

  console.log(`Original tree vs Duplicate tree`);
  logTree(originalTree);
  logTree(duplicateTree);

  // Step 6: Extract subtrees starting from originalRootNotionPageId and duplicatedRootNotionPageId
  console.log('Step 6: Extracting subtrees from both trees...');

  // Extract subtrees as proper Tree objects, not just page IDs
  const originalSubtree = extractSubtreeAsTree(originalTree, originalRootNotionPageId);

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
    originalSubtreePages.map((p) => `${p.notion_page_id} (${p.canonical_document_title})`),
  );

  console.log(`Extracted duplicated subtree with ${duplicatedSubtreePages.length} pages`);
  console.log(`Duplicated subtree page IDs: ${duplicatedSubtreePageIds.join(', ')}`);
  console.log(
    `Subtree pages found:`,
    duplicatedSubtreePages.map((p) => `${p.notion_page_id} (${p.canonical_document_title})`),
  );

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
  // const pageIdMappingDuplicatedToOriginal = duplicatedPages.reduce((map, page) => {
  //   if (page.mapped_notion_page_id) {
  //     map.set(page.notion_page_id, page.mapped_notion_page_id);
  //   }
  //   return map;
  // }, new Map<string, string>());

  // console.log(`Created mapping with ${pageIdMappingDuplicatedToOriginal.size} entries:`);
  // console.log(
  //   'ID mapping:',
  //   Array.from(pageIdMappingDuplicatedToOriginal.entries())
  //     .map(([dupId, origId]) => `  ${dupId} => ${origId}`)
  //     .join('\n'),
  // );

  // Step 9: Rewrite duplicate tree node IDs to match original IDs
  // console.log('Step 9: Rewriting duplicate tree node IDs to match original IDs...');
  // const duplicatedSubtreeWithRewrittenIds = rewriteTreeNodeIds(duplicateTree, pageIdMappingDuplicatedToOriginal);

  // Step 10: Create separate content maps for original and duplicate content
  console.log('Step 10: Creating separate content maps for original and duplicate content...');
  const originalContentMap = new Map<string, string | null>();
  const duplicateContentMap = new Map<string, string | null>();

  // Add original content using original IDs
  for (const [id, content] of Object.entries(originalSubtreeContent)) {
    originalContentMap.set(id, content || null);
  }

  // Add duplicate content using rewritten (original) IDs for existing pages
  // for (const [duplicateId, originalId] of pageIdMappingDuplicatedToOriginal.entries()) {
  //   const duplicateContent = nodeIdToContentMap.get(duplicateId);
  //   if (duplicateContent !== undefined) {
  //     duplicateContentMap.set(originalId, duplicateContent);
  //     console.log(`Mapped duplicate content: ${duplicateId} -> ${originalId}`);
  //   }
  // }

  // Add content for newly created duplicate nodes that don't have original counterparts
  // for (const [duplicateId, content] of Object.entries(duplicatedSubtreeContent)) {
  //   // Skip if this duplicate page has an original (already handled above)
  //   if (pageIdMappingDuplicatedToOriginal.has(duplicateId)) {
  //     continue;
  //   }

  //   // This is a newly created node - use its own ID as the key in duplicateContentMap
  //   duplicateContentMap.set(duplicateId, content || null);
  //   console.log(`Added content for new duplicate node: ${duplicateId}`);
  // }

  // TODO: Delete logs
  console.log('Content comparison preview:');
  for (const [id] of originalContentMap) {
    const originalContent = originalContentMap.get(id);
    const duplicateContent = duplicateContentMap.get(id);
    console.log(`  Node ${id}:`);
    console.log(
      `    Original: "${originalContent?.substring(0, 100)}${originalContent && originalContent.length > 100 ? '...' : ''}"`,
    );
    console.log(
      `    Duplicate: "${duplicateContent?.substring(0, 100)}${duplicateContent && duplicateContent.length > 100 ? '...' : ''}"`,
    );
    console.log(`    Same content: ${originalContent === duplicateContent}`);
  }

  logTree(originalSubtree);
  // logTree(duplicatedSubtreeWithRewrittenIds);

  // // Step 11: Calculate the differences using trees with matching IDs
  // const changes = diffTrees({
  //   originalNodeMap: originalSubtree.nodeMap,
  //   duplicateNodeMap: duplicatedSubtreeWithRewrittenIds.nodeMap,
  //   originalRoot: originalSubtree.root,
  //   duplicateRoot: duplicatedSubtreeWithRewrittenIds.root,
  //   originalContentMap,
  //   duplicateContentMap,
  // });

  // if (DEBUG_LOGGING) {
  //   console.log('Calculated changes:', {
  //     changes,
  //     json: JSON.stringify(
  //       changes.map((change) => ({ ...change, node: JSON.stringify(change.node, null, 2) })),
  //       null,
  //       2,
  //     ),
  //   });
  // }

  // Step 12: Generate Markdown edit proposal
  console.log('Step 12: Generating Atlas edit proposal...');

  // const context: ProposalContext = {
  //   originalNodeMap: originalSubtree.nodeMap,
  //   duplicateNodeMap: duplicatedSubtreeWithRewrittenIds.nodeMap,
  //   originalRoot: originalSubtree.root,
  //   duplicateRoot: duplicatedSubtreeWithRewrittenIds.root,
  //   originalContentMap,
  //   duplicateContentMap,
  // };

  // const proposalMarkdown = convertTreeChangesToAtlasProposal(changes, context, {
  //   includeSubtree: true,
  //   maxSubtreeDepth: undefined, // No depth limit per requirements
  //   groupingStrategy: 'none',
  // });

  console.log('='.repeat(80));
  console.log('📋 ATLAS EDIT PROPOSAL');
  console.log('='.repeat(80));
  console.log('');
  // console.log(proposalMarkdown);
  console.log('');
  console.log('='.repeat(80));
  // console.log(`✅ Generated proposal with ${changes.length} changes`);
  console.log('='.repeat(80));

  const endTime = Date.now();
  const executionTimeSeconds = (endTime - startTime) / 1000;
  console.log(`calculateNotionPageChanges execution time: ${executionTimeSeconds.toFixed(2)} seconds`);

  return {
    changes: [],
    proposalMarkdown: '',
    context: {} as ProposalContext,
  };

  // return {
  //   changes,
  //   proposalMarkdown,
  //   context,
  // };
}

function createDummyRootNode(rootId: string): TreeNode {
  return {
    id: `__DUMMY_ROOT__${rootId}`,
    parentId: null,
    type: 'dummy_root',
    sortOrder: 0,
    canonicalDocumentTitle: '',
  };
}
