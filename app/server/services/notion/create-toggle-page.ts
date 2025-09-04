import type {
  BlockObjectRequest,
  CreatePageParameters,
  DatabaseObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { NotionBlock } from '@/app/server/database/notion-block';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { convertSupabaseDatabasePagesToTreeNodes } from '@/app/server/diff/convert-supabase-database-pages-to-tree-nodes';
import { extractSubtreePageIds } from '@/app/server/diff/extract-subtree';
import { TreeNode, buildTree } from '@/app/server/diff/tree';
import { notion } from '@/app/server/services/notion/notion-client';
import { loadNotionDatabasePagesFromSupabase } from '@/app/server/services/supabase/load-notion-database-pages-from-supabase';
import { supabase } from '@/app/server/services/supabase/supabase-client';
import { fetchBlocksRecursively } from './fetch-blocks-recursively';
import { endSyncStatus, startSyncStatus } from './reset-sync-status';
import { TextRichTextItemRequest } from './types';
import { verifySyncLock } from './verify-sync-lock';

export interface CreateEditPageResult {
  newNotionPageId: string;
  blocksCreatedCount: number;
}

/**
 * Creates a single Notion page containing hierarchical toggle blocks from database pages,
 * based on data stored in Supabase. Each database page becomes a toggle block with its
 * content and children nested within.
 */
export async function createNotionPageWithToggleBlocks({
  originalNotionDatabaseId,
  rootNotionPageId,
  taskRunId,
  parent,
}: {
  originalNotionDatabaseId: string;
  rootNotionPageId: string;
  taskRunId: string;
  parent: CreatePageParameters['parent'];
}): Promise<CreateEditPageResult> {
  const startTime = performance.now();
  console.log(`➡️ Creating toggle page from Notion database ${originalNotionDatabaseId}...`);
  console.log(`Root page ID: ${rootNotionPageId}`);
  console.log(`Trigger.dev task run ID: ${taskRunId}`);

  let newPageId: string | null = null;

  try {
    // Step 1: Load and validate data from Supabase
    console.log('Step 1: Loading pages from Supabase...');
    const allPages = await loadNotionDatabasePagesFromSupabase(originalNotionDatabaseId);

    // Validate that all pages are original pages (not edit copies)
    const editPages = allPages.filter((page) => page.belongs_to_edit_page);
    if (editPages.length > 0) {
      throw new Error(
        `Found ${editPages.length} edit pages in the source database. Only original pages are supported.`,
      );
    }

    // Validate that we have pages to work with
    if (allPages.length === 0) {
      throw new Error(`No pages found in database ${originalNotionDatabaseId}`);
    }

    // Validate that rootNotionPageId exists
    const rootPage = allPages.find((page) => page.notion_page_id === rootNotionPageId);
    if (!rootPage) {
      throw new Error(`Root page ${rootNotionPageId} not found in database ${originalNotionDatabaseId}`);
    }

    // Validate that the root page is not archived or in trash
    if (rootPage.archived || rootPage.in_trash) {
      throw new Error(`Root page ${rootNotionPageId} is archived or in trash and cannot be used as a source`);
    }

    // Validate that the root page has a valid title
    if (!rootPage.canonical_document_title && !rootPage.plain_text_name) {
      console.warn(`Warning: Root page ${rootNotionPageId} has no title, will use fallback`);
    }

    console.log(`Loaded ${allPages.length} pages from Supabase`);

    // Step 2: Build tree structure and extract subtree
    console.log('Step 2: Building tree structure and extracting subtree...');
    const treeNodes = convertSupabaseDatabasePagesToTreeNodes(allPages);
    console.log(`Converted ${treeNodes.length} database pages to tree nodes`);

    // Add a dummy root node to connect all top-level pages
    const dummyRootId = '__DUMMY_ROOT__';
    const dummyRootNode: TreeNode = {
      id: dummyRootId,
      parentId: null,
      blockType: 'dummy_root',
      sortOrder: 0,
      rootNotionPageId: originalNotionDatabaseId,
      canonicalDocumentTitle: '',
    };

    // Make all current root nodes (parentId === null) children of the dummy root
    const treeNodesWithDummyRoot = treeNodes.map((node) =>
      node.parentId === null ? { ...node, parentId: dummyRootId } : node,
    );
    treeNodesWithDummyRoot.unshift(dummyRootNode);

    const tree = buildTree(treeNodesWithDummyRoot);
    const pageIdMap = new Map(allPages.map((page) => [page.notion_page_id, page]));

    // Extract subtree starting from rootNotionPageId using efficient tree traversal
    const subtreePageIds = extractSubtreePageIds(tree, rootNotionPageId);

    if (subtreePageIds.length === 0) {
      throw new Error(
        `No subtree found starting from page ${rootNotionPageId}. This might indicate a tree structure issue.`,
      );
    }

    const subtreePages = subtreePageIds.map((pageId: string) => pageIdMap.get(pageId)!).filter(Boolean);

    // Validate that all subtree pages were found
    if (subtreePages.length !== subtreePageIds.length) {
      const missingPages = subtreePageIds.filter((pageId) => !pageIdMap.has(pageId));
      console.warn(`Warning: ${missingPages.length} pages from subtree were not found in page map:`, missingPages);
    }

    console.log(`Extracted subtree with ${subtreePages.length} pages`);
    console.log(`Subtree page IDs: ${subtreePageIds.join(', ')}`);

    // Log the hierarchy structure for debugging
    console.log('Subtree hierarchy:');

    // Build a map to track the depth of each page
    const pageDepthMap = new Map<string, number>();

    // Calculate depth for each page by traversing up the parent chain
    function calculatePageDepth(pageId: string): number {
      if (pageDepthMap.has(pageId)) {
        return pageDepthMap.get(pageId)!;
      }

      const page = subtreePages.find((p) => p.notion_page_id === pageId);
      if (!page || !page.parent_notion_page_id) {
        const depth = 0;
        pageDepthMap.set(pageId, depth);
        return depth;
      }

      // Recursively calculate parent depth and add 1
      const parentDepth = calculatePageDepth(page.parent_notion_page_id);
      const depth = parentDepth + 1;
      pageDepthMap.set(pageId, depth);
      return depth;
    }

    // Calculate depths for all pages
    subtreePages.forEach((page) => calculatePageDepth(page.notion_page_id));

    subtreePages.forEach((page) => {
      const depth = pageDepthMap.get(page.notion_page_id) || 0;
      const indent = '  '.repeat(depth);
      const title = page.canonical_document_title || page.plain_text_name || 'Untitled';
      console.log(`${indent}${title} (${page.notion_page_id})`);

      // Validate canonical document title format
      // Expected format: A.1.2.3 - Document Title (e.g., "A.3.2 - Core Stability Parameters - Parameters - Sky Savings Rate")
      if (page.canonical_document_title && !/^[A-Z]\.[0-9]+(\.[0-9]+)* - .+$/.test(page.canonical_document_title)) {
        console.warn(
          `Warning: Page ${page.notion_page_id} has non-standard canonical document title: "${page.canonical_document_title}"`,
        );
      }
    });

    // Step 3: Retrieve original database schema for title
    console.log('Step 3: Retrieving original database schema...');
    const originalDatabase = (await notion('read').databases.retrieve({
      database_id: originalNotionDatabaseId,
    })) as DatabaseObjectResponse;

    const originalDatabaseTitle = extractDatabaseTitle(originalDatabase);
    console.log(`Original database title: "${originalDatabaseTitle}"`);

    // Step 4: Create new Notion page
    console.log('Step 4: Creating new Notion page...');
    const rootPageTitle = rootPage.canonical_document_title || rootPage.plain_text_name || 'Untitled Page';
    const newPageTitle = `${rootPageTitle} - Editable`;
    console.log(`New page title: "${newPageTitle}"`);

    // Validate that we have pages to create toggles for
    if (subtreePages.length === 0) {
      throw new Error(`No pages found in subtree starting from ${rootNotionPageId}`);
    }

    // Validate that the root page is included in the subtree
    const rootPageInSubtree = subtreePages.find((page) => page.notion_page_id === rootNotionPageId);
    if (!rootPageInSubtree) {
      console.warn(
        `Warning: Root page ${rootNotionPageId} is not included in the subtree. This might be expected if the root page has no children.`,
      );
    }

    // Validate that all pages in the subtree are not archived or in trash
    const invalidPages = subtreePages.filter((page) => page.archived || page.in_trash);
    if (invalidPages.length > 0) {
      console.warn(
        `Warning: ${invalidPages.length} pages in subtree are archived or in trash:`,
        invalidPages.map((p) => ({ id: p.notion_page_id, title: p.canonical_document_title || p.plain_text_name })),
      );
    }

    // Validate that all pages in the subtree have valid content
    const pagesWithoutContent = subtreePages.filter((page) => !page.json_content && !page.plain_text_content);
    if (pagesWithoutContent.length > 0) {
      console.log(`${pagesWithoutContent.length} pages in subtree have no content (this is expected for some pages)`);
    }

    // Validate that all pages in the subtree have valid titles
    const pagesWithoutTitle = subtreePages.filter((page) => !page.canonical_document_title && !page.plain_text_name);
    if (pagesWithoutTitle.length > 0) {
      console.warn(
        `Warning: ${pagesWithoutTitle.length} pages in subtree have no title:`,
        pagesWithoutTitle.map((p) => ({ id: p.notion_page_id })),
      );
    }

    // Validate that all pages in the subtree have valid sort orders
    const pagesWithoutSortOrder = subtreePages.filter(
      (page) => typeof page.sort_order !== 'number' || page.sort_order < 0,
    );
    if (pagesWithoutSortOrder.length > 0) {
      console.warn(
        `Warning: ${pagesWithoutSortOrder.length} pages in subtree have invalid sort order:`,
        pagesWithoutSortOrder.map((p) => ({ id: p.notion_page_id, sortOrder: p.sort_order })),
      );
    }

    // Validate that all pages in the subtree have valid parent references
    const pagesWithInvalidParent = subtreePages.filter(
      (page) => page.parent_notion_page_id && !subtreePageIds.includes(page.parent_notion_page_id),
    );
    if (pagesWithInvalidParent.length > 0) {
      console.warn(
        `Warning: ${pagesWithInvalidParent.length} pages in subtree have invalid parent references:`,
        pagesWithInvalidParent.map((p) => ({ id: p.notion_page_id, parent: p.parent_notion_page_id })),
      );
    }

    // Validate that all pages in the subtree have valid canonical document titles
    // Expected format: e.g., "A.3.2 - Core Stability Parameters - Parameters - Sky Savings Rate", "Grove"
    const pagesWithInvalidCanonicalTitle = subtreePages.filter(
      (page) => page.canonical_document_title && !/^..+$/.test(page.canonical_document_title),
    );
    if (pagesWithInvalidCanonicalTitle.length > 0) {
      console.warn(
        `Warning: ${pagesWithInvalidCanonicalTitle.length} pages in subtree have non-standard canonical document titles:`,
        pagesWithInvalidCanonicalTitle.map((p) => ({ id: p.notion_page_id, title: p.canonical_document_title })),
      );
    }

    const newPage = await notion('write').pages.create({
      parent,
      properties: {
        title: {
          title: [
            {
              type: 'text',
              text: { content: newPageTitle },
            },
          ],
        },
      },
    });

    if (!newPage || !newPage.id) {
      throw new Error('Failed to create new Notion page - no page ID returned');
    }

    newPageId = newPage.id;
    console.log(`Created new page: ${newPageId}`);

    // Step 5: Create toggle blocks hierarchically
    console.log('Step 5: Creating toggle blocks...');
    const { blocksCreated, databasePageToBlockMapping } = await createToggleBlocksHierarchy(
      newPageId,
      subtreePages,
      rootNotionPageId,
      pageIdMap,
    );

    console.log(`Created ${blocksCreated} toggle blocks`);
    console.log(`Database page to block mapping:`, databasePageToBlockMapping.size, 'mappings');

    // Step 6: Import new page and blocks to Supabase with edit page properties
    console.log('Step 6: Importing new page and blocks to Supabase...');
    await importToggleBlocksFromNotionToSupabase({
      notionPageId: newPageId,
      taskRunId,
      databasePageToBlockMapping,
    });

    console.log(`Imported and mapped ${databasePageToBlockMapping.size} toggle blocks`);

    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(
      `✅ Toggle page creation completed successfully in ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(2)}s)`,
    );

    return {
      newNotionPageId: newPageId,
      blocksCreatedCount: blocksCreated,
    };
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.error(
      `❌ Toggle page creation failed after ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(2)}s):`,
      error,
    );

    // Attempt to update page description with error info if page was created
    if (newPageId) {
      try {
        console.log(`Updating page ${newPageId} description to indicate partial creation...`);
        await notion('write').pages.update({
          page_id: newPageId,
          properties: {
            // Note: This might not work if the page doesn't have a description property
            // The exact property name depends on the parent database schema
          },
        });
      } catch (updateError) {
        console.error('Failed to update page description:', updateError);
      }
    }

    throw error;
  }
}

/**
 * Extract database title from database object
 */
function extractDatabaseTitle(database: DatabaseObjectResponse): string {
  if (database.title && database.title.length > 0) {
    return database.title.map((t) => t.plain_text).join('');
  }
  return '<Untitled>';
}

/**
 * Creates toggle blocks hierarchically, processing level by level for reliability
 */
async function createToggleBlocksHierarchy(
  pageId: string,
  subtreePages: NotionDatabasePage[],
  rootPageId: string,
  _pageIdMap: Map<string, NotionDatabasePage>, // Unused parameter, prefixed with _
): Promise<{ blocksCreated: number; databasePageToBlockMapping: Map<string, string> }> {
  const databasePageToBlockMapping = new Map<string, string>(); // original page ID -> toggle block ID
  let blocksCreated = 0;

  // Build tree structure for processing
  const pagesByParent = new Map<string | null, NotionDatabasePage[]>();
  subtreePages.forEach((page) => {
    const parentId = page.parent_notion_page_id || null;
    if (!pagesByParent.has(parentId)) {
      pagesByParent.set(parentId, []);
    }
    pagesByParent.get(parentId)!.push(page);
  });

  // Validate parent references
  const allPageIds = new Set(subtreePages.map((p) => p.notion_page_id));
  const invalidParentRefs = subtreePages.filter(
    (p) => p.parent_notion_page_id && !allPageIds.has(p.parent_notion_page_id),
  );

  if (invalidParentRefs.length > 0) {
    console.warn(
      `Warning: ${invalidParentRefs.length} pages have invalid parent references:`,
      invalidParentRefs.map((p) => ({ id: p.notion_page_id, parent: p.parent_notion_page_id })),
    );
  }

  // Sort pages at each level by sort_order
  pagesByParent.forEach((pages) => {
    pages.sort((a, b) => a.sort_order - b.sort_order);

    // Validate sort order consistency
    const uniqueSortOrders = new Set(pages.map((p) => p.sort_order));
    if (uniqueSortOrders.size !== pages.length) {
      console.warn(
        `Warning: Duplicate sort orders found in pages with parent ${pages[0]?.parent_notion_page_id || 'null'}`,
      );
    }
  });

  // Process pages level by level
  // Create toggle blocks for ALL pages in the subtree, including the root page
  // The root page should also be a toggle block with its content and children

  // Process children recursively, including the root page itself
  async function processChildren(parentPageId: string, parentBlockId: string, includeRootPage: boolean = false) {
    const children = pagesByParent.get(parentPageId) || [];

    // If this is the root page and we should include it, create a toggle block for it first
    if (includeRootPage && parentPageId === rootPageId) {
      const rootPage = subtreePages.find((p) => p.notion_page_id === rootPageId);
      if (rootPage) {
        try {
          const rootToggleId = await createSingleToggleBlock(parentBlockId, rootPage);
          databasePageToBlockMapping.set(rootPage.notion_page_id, rootToggleId);
          blocksCreated++;
          console.log(`Created root toggle block for page ${rootPageId}`);

          // Process children of the root page using the root toggle block as parent
          await processChildren(rootPageId, rootToggleId, false);
        } catch (error) {
          console.error(`Failed to create root toggle block for page ${rootPageId}:`, error);
          // Continue with children even if root toggle creation fails
        }
      }
      return;
    }

    // Process all children of the current page
    for (const childPage of children) {
      try {
        const childToggleId = await createSingleToggleBlock(parentBlockId, childPage);
        databasePageToBlockMapping.set(childPage.notion_page_id, childToggleId);
        blocksCreated++;

        // Process grandchildren
        await processChildren(childPage.notion_page_id, childToggleId, false);
      } catch (error) {
        console.error(`Failed to create toggle block for page ${childPage.notion_page_id}:`, error);
        // Continue with other children even if one fails
      }
    }
  }

  // Start processing from the root page, including the root page itself as a toggle block
  await processChildren(rootPageId, pageId, true);

  console.log(`Created ${blocksCreated} toggle blocks with ${databasePageToBlockMapping.size} mappings`);

  return { blocksCreated, databasePageToBlockMapping };
}

/**
 * Creates a single toggle block for a database page
 */
async function createSingleToggleBlock(parentId: string, databasePage: NotionDatabasePage): Promise<string> {
  const toggleTitle = databasePage.canonical_document_title || databasePage.plain_text_name || 'Untitled';

  // Validate that we have a valid title
  if (!toggleTitle || toggleTitle.trim() === '') {
    console.warn(`Page ${databasePage.notion_page_id} has no valid title, using fallback`);
  }

  // Prepare toggle block children
  const children: BlockObjectRequest[] = [];

  // Add content paragraph if the page has content
  if (databasePage.json_content && Array.isArray(databasePage.json_content)) {
    // Validate that json_content contains valid rich text items
    const validRichTextItems = databasePage.json_content.filter(
      (item) => item && typeof item === 'object' && 'type' in item && 'text' in item,
    );

    if (validRichTextItems.length > 0) {
      // Check content length to avoid Notion API limits
      const totalContentLength = validRichTextItems.reduce((sum: number, item) => {
        if (
          item &&
          typeof item === 'object' &&
          'text' in item &&
          item.text &&
          typeof item.text === 'object' &&
          'content' in item.text
        ) {
          const content = item.text.content;
          if (typeof content === 'string') {
            return sum + content.length;
          }
        }
        return sum;
      }, 0);

      if (totalContentLength > 2000) {
        console.warn(`Toggle "${toggleTitle}" has long content (${totalContentLength} chars), may hit Notion limits`);
      }

      children.push({
        type: 'paragraph',
        paragraph: {
          rich_text: validRichTextItems as TextRichTextItemRequest[],
        },
      });
    } else {
      console.warn(`Toggle "${toggleTitle}" has invalid json_content format`);
    }
  } else if (databasePage.plain_text_content) {
    // Validate plain text content
    const cleanText = databasePage.plain_text_content.trim();
    if (cleanText.length > 0) {
      if (cleanText.length > 2000) {
        console.warn(
          `Toggle "${toggleTitle}" has long plain text content (${cleanText.length} chars), may hit Notion limits`,
        );
      }

      children.push({
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text' as const,
              text: { content: cleanText },
            },
          ],
        },
      });
    } else {
      console.log(`Toggle "${toggleTitle}" has empty plain text content`);
    }
  }

  // Log if page has no content
  if (children.length === 0) {
    console.log(`Toggle "${toggleTitle}" has no content to display`);
  }

  // Create the toggle block
  const toggleBlock = {
    type: 'toggle' as const,
    toggle: {
      rich_text: [
        {
          type: 'text' as const,
          text: { content: toggleTitle },
          annotations: {
            bold: true,
          },
        },
      ],
    },
  };

  // Append the toggle block to its parent
  const response = await notion('write').blocks.children.append({
    block_id: parentId,
    children: [toggleBlock],
  });

  // Return the ID of the created toggle block
  const createdBlock = response.results[0];
  if (!createdBlock || !('id' in createdBlock)) {
    throw new Error(`Failed to create toggle block for "${toggleTitle}" - no ID returned from Notion API`);
  }

  const toggleBlockId = createdBlock.id;

  // Add children to the toggle block if there are any
  if (children.length > 0) {
    try {
      await notion('write').blocks.children.append({
        block_id: toggleBlockId,
        children: children,
      });
      console.log(`Added ${children.length} content blocks to toggle "${toggleTitle}"`);
    } catch (error) {
      console.warn(`Failed to add content blocks to toggle "${toggleTitle}":`, error);
      // Continue with the toggle block creation even if content addition fails
    }
  }

  return toggleBlockId;
}

/**
 * Import toggle blocks from Notion to Supabase with proper edit page mappings
 */
async function importToggleBlocksFromNotionToSupabase({
  notionPageId,
  taskRunId: _taskRunId, // Unused parameter, prefixed with _
  databasePageToBlockMapping,
}: {
  notionPageId: string;
  taskRunId: string;
  databasePageToBlockMapping: Map<string, string>; // original page ID -> toggle block ID
}): Promise<void> {
  const startTime = performance.now();
  console.log(`➡️ Importing toggle blocks from Notion to Supabase...`);

  // Verify that the sync is not already in progress
  await verifySyncLock(notionPageId);

  try {
    // Update sync status in database
    await startSyncStatus(notionPageId);

    // Create a reverse mapping: toggle block ID -> original page ID
    const blockToPageMapping = new Map<string, string>();
    for (const [pageId, blockId] of databasePageToBlockMapping.entries()) {
      blockToPageMapping.set(blockId, pageId);
    }

    // Fetch all blocks from the Notion page recursively
    const blocks = await fetchBlocksRecursively({
      notionBlockId: notionPageId,
      parentNotionBlockId: null,
      rootNotionBlockId: notionPageId,
      notionBlockType: 'page',
      editPage: {
        belongsToEditPage: true,
        editPageOriginalNotionBlockId: '', // Not applicable for toggle blocks
        editPageOriginalNotionPageId: '', // Will be set per block during mapping
      },
    });

    console.log(`Fetched ${blocks.length} blocks from Notion page ${notionPageId}`);

    // Delete existing blocks in Supabase that belong to this page. Descendants are cascade deleted automatically
    await supabase.from('notion_blocks').delete().eq('root_notion_block_id', notionPageId).throwOnError();

    console.log(`Deleted existing blocks in Supabase for Notion page ${notionPageId}`);

    // Update blocks with edit page properties based on our mapping
    const blocksWithEditProperties = blocks.map((block) => {
      const originalPageId = blockToPageMapping.get(block.notion_block_id);

      // Only toggle blocks should be marked as edit page content
      // The page itself and content blocks (paragraphs) are not edit page content
      if (block.block_type === 'toggle') {
        return {
          ...block,
          belongs_to_edit_page: true,
          edit_page_original_notion_page_id: originalPageId || null,
          edit_page_original_notion_block_id: null, // Not applicable for toggle blocks
        };
      } else {
        // For non-toggle blocks (page, paragraphs, etc.), they are not edit page content
        return {
          ...block,
          belongs_to_edit_page: false,
          edit_page_original_notion_page_id: null,
          edit_page_original_notion_block_id: null,
        };
      }
    });

    // Log mapping statistics for debugging
    const editPageBlocks = blocksWithEditProperties.filter((block) => block.belongs_to_edit_page);
    const nonEditPageBlocks = blocksWithEditProperties.filter((block) => !block.belongs_to_edit_page);
    console.log(
      `Block categorization: ${editPageBlocks.length} edit page blocks, ${nonEditPageBlocks.length} non-edit page blocks`,
    );

    // Check that all toggle blocks are properly mapped
    const toggleBlocks = blocksWithEditProperties.filter((block) => block.block_type === 'toggle');
    const mappedToggleBlocks = toggleBlocks.filter((block) => block.edit_page_original_notion_page_id);
    const unmappedToggleBlocks = toggleBlocks.filter((block) => !block.edit_page_original_notion_page_id);

    console.log(`Toggle block mapping: ${mappedToggleBlocks.length} mapped, ${unmappedToggleBlocks.length} unmapped`);

    if (unmappedToggleBlocks.length > 0) {
      console.warn(
        `Warning: ${unmappedToggleBlocks.length} toggle blocks are not mapped to database pages:`,
        unmappedToggleBlocks.map((b) => ({ id: b.notion_block_id, type: b.block_type })),
      );

      // This is a critical error - all toggle blocks must be mapped
      throw new Error(
        `Found ${unmappedToggleBlocks.length} unmapped toggle blocks. All toggle blocks must have valid mappings to database pages.`,
      );
    }

    // Log details about non-edit page blocks
    if (nonEditPageBlocks.length > 0) {
      console.log(
        `Non-edit page blocks (expected):`,
        nonEditPageBlocks.map((b) => ({ id: b.notion_block_id, type: b.block_type })),
      );
    }

    // Validate that we have the expected number of toggle blocks
    const totalToggleBlocks = blocksWithEditProperties.filter((block) => block.block_type === 'toggle');
    const expectedToggleBlocks = databasePageToBlockMapping.size;

    if (totalToggleBlocks.length !== expectedToggleBlocks) {
      console.warn(`Warning: Expected ${expectedToggleBlocks} toggle blocks but found ${totalToggleBlocks.length}`);
    }

    // Save blocks to Supabase database in batches
    await insertBlocksInBatches(blocksWithEditProperties);

    console.log(`Inserted ${blocksWithEditProperties.length} blocks into Supabase for Notion page ${notionPageId}`);

    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(
      `✅ Toggle block import completed successfully in ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(2)}s)`,
    );

    await endSyncStatus({
      notionPageId,
      syncStatus: 'completed',
      syncErrorMessage: null,
      blocksSyncedCount: blocksWithEditProperties.length,
    });
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.error(
      `❌ Toggle block import failed after ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(2)}s):`,
      error,
    );

    await endSyncStatus({
      notionPageId,
      syncStatus: 'failed',
      syncErrorMessage: JSON.stringify(error),
      blocksSyncedCount: null,
    });

    throw error;
  }
}

/**
 * Insert blocks into Supabase in batches to handle large datasets efficiently
 */
async function insertBlocksInBatches(blocks: NotionBlock[], batchSize: number = 1000): Promise<void> {
  const totalBlocks = blocks.length;

  for (let i = 0; i < totalBlocks; i += batchSize) {
    const batch = blocks.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(totalBlocks / batchSize);

    console.log(`Inserting batch ${batchNumber}/${totalBatches} (${batch.length} blocks)...`);

    await supabase.from('notion_blocks').insert(batch).throwOnError();

    console.log(`✓ Batch ${batchNumber}/${totalBatches} inserted successfully`);
  }
}
