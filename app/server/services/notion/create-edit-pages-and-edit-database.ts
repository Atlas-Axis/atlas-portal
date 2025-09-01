import type {
  CreateDatabaseParameters,
  CreatePageParameters,
  DatabaseObjectResponse,
} from '@notionhq/client/build/src/api-endpoints';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { convertSupabaseDatabasePagesToTreeNodes } from '@/app/server/services/diff/convert-supabase-database-pages-to-tree-nodes';
import { TreeNode, buildTree } from '@/app/server/services/diff/tree';
import { notion } from '@/app/server/services/notion/notion-client';
import { loadNotionDatabasePagesFromSupabase } from '@/app/server/services/supabase/load-notion-database-pages-from-supabase';
import { formatUtcTimestamp } from '@/app/shared/utils/utils';
import { NOTION_DATABASE_PROPERTY_NAMES } from './database-property-names';
import { importDatabasePagesFromNotionToSupabase } from './import-database-to-supabase';
import { TextRichTextItemRequest } from './types';

export interface CreateEditPagesAndDatabaseResult {
  newDatabaseId: string;
  pageIdMapping: Map<string, string>; // new page ID -> original page ID
  pagesCreatedCount: number;
  originalDatabaseTitle: string;
  newDatabaseTitle: string;
}

/**
 * Creates a new Notion database containing a subset of pages from an existing database,
 * based on data stored in Supabase. The subset includes a specified root page and all its descendants.
 */
export async function createNotionEditPagesAndDatabase({
  originalNotionDatabaseId,
  rootNotionPageId,
  taskRunId,
  propertyWhitelist,
  parent,
}: {
  originalNotionDatabaseId: string;
  rootNotionPageId: string;
  taskRunId: string;
  propertyWhitelist?: string[];
  parent: CreateDatabaseParameters['parent'];
}): Promise<CreateEditPagesAndDatabaseResult> {
  const startTime = performance.now();
  console.log(`➡️ Creating edit database from Notion database ${originalNotionDatabaseId}...`);
  console.log(`Root page ID: ${rootNotionPageId}`);
  console.log(`Trigger.dev task run ID: ${taskRunId}`);

  let newDatabaseId: string | null = null;

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

    // Validate that rootNotionPageId exists
    const rootPage = allPages.find((page) => page.notion_page_id === rootNotionPageId);
    if (!rootPage) {
      throw new Error(`Root page ${rootNotionPageId} not found in database ${originalNotionDatabaseId}`);
    }

    console.log(`Loaded ${allPages.length} pages from Supabase`);

    // Step 2: Build tree structure and extract subtree
    console.log('Step 2: Building tree structure and extracting subtree...');
    const treeNodes = convertSupabaseDatabasePagesToTreeNodes(allPages);

    // Add a dummy root node to connect all top-level pages, solving the multiple roots issue. This node will be omitted later anyway
    const dummyRootId = '__DUMMY_ROOT__';
    const dummyRootNode: TreeNode = {
      id: dummyRootId,
      parentId: null,
      blockType: 'dummy_root',
      sortOrder: 0,
      rootNotionBlockId: originalNotionDatabaseId,
    };

    // Make all current root nodes (parentId === null) children of the dummy root
    const treeNodesWithDummyRoot = treeNodes.map((node) =>
      node.parentId === null ? { ...node, parentId: dummyRootId } : node,
    );
    treeNodesWithDummyRoot.unshift(dummyRootNode);

    const tree = buildTree(treeNodesWithDummyRoot);
    const pageIdMap = new Map(allPages.map((page) => [page.notion_page_id, page]));

    // Extract subtree starting from rootNotionPageId using efficient tree traversal
    const subtreePageIds = extractSubtreeFromTree(tree, rootNotionPageId);
    const subtreePages = subtreePageIds.map((pageId: string) => pageIdMap.get(pageId)!).filter(Boolean);

    console.log(`Extracted subtree with ${subtreePages.length} pages`);
    console.log(`Subtree page IDs: ${subtreePageIds.join(', ')}`);
    console.log(
      `Subtree pages found:`,
      subtreePages.map((p) => `${p.notion_page_id} (${p.plain_text_name})`),
    );

    // Step 3: Retrieve original database schema
    console.log('Step 3: Retrieving original database schema...');
    const originalDatabase = (await notion('read').databases.retrieve({
      database_id: originalNotionDatabaseId,
    })) as DatabaseObjectResponse;

    const originalDatabaseTitle = extractDatabaseTitle(originalDatabase);
    console.log(`Original database title: "${originalDatabaseTitle}"`);

    // Step 4: Create new Notion database
    console.log('Step 4: Creating new Notion database...');
    const rootPageName = rootPage.plain_text_name || 'Untitled Page';
    const newDatabaseTitle = `${rootPageName} - Editable Copy`;
    console.log(`New database title (based on root page): "${newDatabaseTitle}"`);

    // Use provided whitelist or default to common properties (excluding Sub-item which is handled separately)
    const defaultWhitelist = ['Name', 'Content', 'Doc No (or Temp Name)'];
    const baseWhitelist = propertyWhitelist || defaultWhitelist;

    // Remove Sub-item from whitelist if present, as it's handled separately as a relation property
    const effectiveWhitelist = baseWhitelist.filter((prop) => prop !== 'Sub-item');
    console.log(`Using property whitelist: ${effectiveWhitelist.join(', ')}`);
    console.log(`Sub-item property will be added separately as a self-referential dual relation`);

    const newDatabase = await createDatabase(originalDatabase, newDatabaseTitle, effectiveWhitelist, parent);
    newDatabaseId = newDatabase.id;

    console.log(`Created new database: ${newDatabaseId}`);

    // Step 5: Create database pages in Notion
    console.log('Step 5: Creating database pages...');
    const pageIdMapping = await createDatabasePages(newDatabase.id, subtreePages, rootNotionPageId);

    console.log(`Created ${pageIdMapping.size} pages in new database`);

    // Step 6: Import new database back to Supabase
    console.log('Step 6: Importing new database to Supabase...');
    await importDatabasePagesFromNotionToSupabase({
      notionDatabaseId: newDatabaseId,
      taskRunId,
      editPageProps: {
        isEditDatabase: true,
        originalDatabaseId: originalNotionDatabaseId,
        pageIdMapping,
      },
    });

    // Step 7: Update the database description to indicate sync is complete
    console.log('Step 7: Updating database description to indicate sync completion...');
    const syncCompletionTime = formatUtcTimestamp();
    const completionDescription: TextRichTextItemRequest[] = [
      {
        type: 'text',
        text: { content: `Created at: ${syncCompletionTime}` },
      },
    ];
    await updateDatabaseDescription(newDatabaseId, completionDescription);

    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(
      `✅ Edit database creation completed successfully in ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(2)}s)`,
    );

    return {
      newDatabaseId,
      pageIdMapping,
      pagesCreatedCount: pageIdMapping.size,
      originalDatabaseTitle,
      newDatabaseTitle,
    };
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.error(
      `❌ Edit database creation failed after ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(2)}s):`,
      error,
    );

    // Attempt cleanup if database was created
    if (newDatabaseId) {
      try {
        console.log(`Attempting to clean up database ${newDatabaseId}...`);
        // Note: Notion API doesn't support deleting databases, so we can't clean up automatically // TODO: Verify this and find a fix
        console.warn(`Cannot automatically delete database ${newDatabaseId}. Manual cleanup required.`);
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError);
      }
    }

    throw error;
  }
}

/**
 * Extract all page IDs in the subtree starting from rootPageId using efficient tree traversal
 * This is O(k) where k is the subtree size, much more efficient than the linear O(n) approach
 */
function extractSubtreeFromTree(
  tree: { root: TreeNode; nodeMap: Map<string, TreeNode> },
  rootPageId: string,
): string[] {
  const result: string[] = [];

  // Find the root node in the tree
  const rootNode = tree.nodeMap.get(rootPageId);
  if (!rootNode) {
    throw new Error(`Root page ${rootPageId} not found in tree`);
  }

  // Perform depth-first traversal from the root node
  function traverse(node: TreeNode) {
    result.push(node.id);

    // Visit children in sort order (they're already sorted by buildTree)
    if (node.children) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(rootNode);
  return result;
}

/**
 * Extract database title from database object
 */
function extractDatabaseTitle(database: DatabaseObjectResponse): string {
  // TODO: This logic may not be correct
  if (database.title && database.title.length > 0) {
    return database.title.map((t) => t.plain_text).join('');
  }
  return '<Untitled>';
}

/**
 * Create a new database with properties from a whitelist
 */
async function createDatabase(
  originalDatabase: DatabaseObjectResponse,
  newTitle: string,
  propertyWhitelist: string[],
  parent: CreateDatabaseParameters['parent'],
): Promise<DatabaseObjectResponse> {
  // Clone only whitelisted properties from the original database
  const properties: CreateDatabaseParameters['properties'] = {};

  // Clone the property configuration from the original database
  for (const [propName, propConfig] of Object.entries(originalDatabase.properties)) {
    if (propertyWhitelist.includes(propName)) {
      // Clone the property configuration, removing the id field
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...propConfigWithoutId } = propConfig;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      properties[propName] = propConfigWithoutId as any; // Type assertion needed due to Notion API complexity
    }
  }

  console.log('Setting initial database description to indicate sync in progress...');
  const syncStartTime = formatUtcTimestamp();
  const createParams: CreateDatabaseParameters = {
    parent,
    title: [
      {
        type: 'text',
        text: { content: newTitle },
      },
    ],
    description: [
      {
        type: 'text',
        text: { content: 'SYNCING' },
        annotations: {
          bold: true,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          color: 'orange_background',
        },
      },
      {
        type: 'text',
        text: { content: ` Syncing with Supabase... (${syncStartTime})` },
      },
    ],
    properties,
  };

  const newDatabase = await notion('write').databases.create(createParams);

  // Add Sub-item relation property after database creation (required for self-referential relations)
  // Create a new Sub-item dual relation property that will auto-create a mirrored "Parent" property
  const subItemPropName = 'Sub-item';
  console.log(`Adding Sub-item dual relation property to reference new database: ${newDatabase.id}`);

  try {
    await notion('write').databases.update({
      database_id: newDatabase.id,
      properties: {
        [subItemPropName]: {
          type: 'relation',
          relation: {
            database_id: newDatabase.id,
            type: 'dual_property',
            dual_property: {
              synced_property_name: 'Parent item',
            },
          },
        } as unknown as CreateDatabaseParameters['properties'][string], // Type assertion needed due to outdated Notion API types
      },
    });
    console.log('Sub-item relation property added successfully with Parent item as mirrored property');
  } catch (error) {
    console.error('Failed to add Sub-item relation property:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    throw error;
  }

  // Retrieve the updated database to see what properties were actually created
  const updatedDatabase = (await notion('read').databases.retrieve({
    database_id: newDatabase.id,
  })) as DatabaseObjectResponse;

  console.log(`Database properties after dual relation setup:`, Object.keys(updatedDatabase.properties));

  return updatedDatabase;
}

/**
 * Create pages in the new database, maintaining parent-child relationships.
 * Returns a mapping of new page IDs to original page IDs.
 */
async function createDatabasePages(
  newDatabaseId: string,
  subtreePages: NotionDatabasePage[],
  rootPageId: string,
): Promise<Map<string, string>> {
  // Since we explicitly created the dual relation with "Parent item" as the mirrored property name,
  // we can now use "Parent item" directly instead of trying to detect it
  const parentPropertyName = 'Parent item';
  console.log(`Using parent property name: ${parentPropertyName} (explicitly created via dual relation)`);

  // Debug: Get the current database schema to see what relation properties exist
  const currentDatabase = (await notion('read').databases.retrieve({
    database_id: newDatabaseId,
  })) as DatabaseObjectResponse;

  const relationProperties = Object.entries(currentDatabase.properties).filter(([, prop]) => prop.type === 'relation');
  console.log(
    `Available relation properties:`,
    relationProperties.map(([name]) => name),
  );
  // new page ID -> original page ID
  const newToOriginalPageIdMapping = new Map<string, string>();
  const originalToNewPageIdMapping = new Map<string, string>(); // original page ID -> new page ID
  const pagesByOriginalId = new Map(subtreePages.map((page) => [page.notion_page_id, page]));

  // Process pages in dependency order (parents before children)
  const processedPagesIds = new Set<string>();

  // Create pages recursively. Returns the new page ID.
  async function createPageRecursively(originalPageId: string): Promise<string> {
    if (processedPagesIds.has(originalPageId)) {
      return originalToNewPageIdMapping.get(originalPageId)!;
    }

    const originalPage = pagesByOriginalId.get(originalPageId);
    if (!originalPage) {
      throw new Error(`Page ${originalPageId} not found in subtree`);
    }

    console.log(`Creating page: ${originalPageId} (${originalPage.plain_text_name})`);

    // Create parent first if it exists and is in our subtree
    let newParentId: string | null = null;
    if (originalPage.parent_notion_page_id && pagesByOriginalId.has(originalPage.parent_notion_page_id)) {
      newParentId = await createPageRecursively(originalPage.parent_notion_page_id);
    }

    // Create the page
    const newPageId = await createSinglePage(newDatabaseId, originalPage, newParentId, parentPropertyName);

    newToOriginalPageIdMapping.set(newPageId, originalPageId);
    originalToNewPageIdMapping.set(originalPageId, newPageId);
    processedPagesIds.add(originalPageId);

    // Note: No need to manually update parent's Sub-item property - the dual relation handles this automatically

    // Now create all children of this page
    const children = subtreePages.filter((p) => p.parent_notion_page_id === originalPageId);
    for (const child of children) {
      if (!processedPagesIds.has(child.notion_page_id)) {
        await createPageRecursively(child.notion_page_id);
      }
    }

    return newPageId;
  }

  // Start with the root page - this will recursively create all descendants
  console.log(`Starting page creation with root page: ${rootPageId}`);
  await createPageRecursively(rootPageId);

  console.log(`Processed ${processedPagesIds.size} pages total`);
  console.log(`Processed page IDs:`, Array.from(processedPagesIds));
  console.log(`Expected to process ${subtreePages.length} pages`);

  return newToOriginalPageIdMapping;
}

/**
 * Create a single page in the new database
 */
async function createSinglePage(
  databaseId: string,
  originalPage: NotionDatabasePage,
  parentPageId?: string | null,
  parentPropertyName?: string,
): Promise<string> {
  const propertyNames = NOTION_DATABASE_PROPERTY_NAMES['Sections & Primary Docs'];

  // Build properties object
  const properties: CreatePageParameters['properties'] = {};

  // Set the title (Doc No field) - this is a title type property
  if (originalPage.canonical_document_title) {
    properties[propertyNames.docNo] = {
      // TODO: Verify this
      title: [
        {
          type: 'text',
          text: { content: originalPage.canonical_document_title },
        },
      ],
    };
  }

  // Set the name field - use full rich text from JSON
  if (originalPage.json_name && Array.isArray(originalPage.json_name)) {
    properties[propertyNames.name] = {
      rich_text: originalPage.json_name as TextRichTextItemRequest[],
    };
  } else if (originalPage.plain_text_name) {
    // Fallback to plain text if json_name is not available
    console.warn(`Using plain text name for page ${originalPage.plain_text_name}`);
    properties[propertyNames.name] = {
      rich_text: [
        {
          type: 'text',
          text: { content: originalPage.plain_text_name },
        },
      ],
    };
  }

  // Set the content field - use full rich text from JSON
  if (originalPage.json_content && Array.isArray(originalPage.json_content)) {
    properties[propertyNames.content] = {
      rich_text: originalPage.json_content as TextRichTextItemRequest[],
    };
  } else if (originalPage.plain_text_content) {
    // Fallback to plain text if json_content is not available
    console.warn(`Using plain text content for page ${originalPage.plain_text_name}`);
    properties[propertyNames.content] = {
      rich_text: [
        {
          type: 'text',
          text: { content: originalPage.plain_text_content },
        },
      ],
    };
  }

  // Set the Parent property if this page has a parent
  // This will automatically update the parent's Sub-item property due to the dual relation
  if (parentPageId && parentPropertyName) {
    console.log(
      `Setting ${parentPropertyName} relation for page ${originalPage.plain_text_name} to parent ${parentPageId}`,
    );
    properties[parentPropertyName] = {
      relation: [{ id: parentPageId }],
    };
  } else if (parentPageId && !parentPropertyName) {
    console.warn(`Parent page ID provided but no parent property name found - skipping parent relation setup`);
  }

  const createParams: CreatePageParameters = {
    parent: {
      type: 'database_id',
      database_id: databaseId,
    },
    properties,
  };

  const newPage = await notion('write').pages.create(createParams);
  return newPage.id;
}

/**
 * Update the description of a database
 */
async function updateDatabaseDescription(
  databaseId: string,
  content: string | TextRichTextItemRequest[],
): Promise<void> {
  let description: TextRichTextItemRequest[];

  if (typeof content === 'string') {
    // Handle plain text content
    description = content
      ? [
          {
            type: 'text',
            text: { content },
          },
        ]
      : [];
  } else {
    // Handle rich text content (array)
    description = content;
  }

  await notion('write').databases.update({
    database_id: databaseId,
    description,
  });
}
