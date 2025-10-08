import { compareDocNumbers } from '@/app/server/atlas/atlas-utils';
import { ATLAS_DATABASES, AtlasDatabaseName } from '@/app/server/atlas/constants';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { getDocumentTitle, sortAtlasDocuments } from './atlas-tree-helpers';
import { assignDocumentNumbersToTreesRecursively } from './atlas-tree-numbering';
import {
  AtlasLookupMaps,
  AtlasTreeNode,
  AtlasTreeNodeRelationship,
  AtlasTreeResult,
  TreeConstructionError,
  TreeConstructionOptions,
} from './atlas-tree-types';

/**
 * Builds the Atlas document tree structure from Supabase data.
 *
 * This function takes the output of `loadAtlasFromSupabaseWithNestingAgentsUnderSection`
 * and creates a hierarchical tree structure where each root node is a Scope document
 * and contains all its descendant documents as embedded child nodes.
 *
 * The function uses efficient lookup maps to handle ~6000 Atlas documents with deep nesting,
 * providing O(1) access to nodes and relationships during construction.
 *
 * @param pagesByDatabase - Pages organized by database name from loadAtlasFromSupabaseWithNestingAgentsUnderSection
 * @param options - Configuration options for tree construction
 * @returns AtlasTreeResult containing scope trees, orphaned nodes, and any errors
 *
 * @example
 * ```typescript
 * const atlasData = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();
 * const result = buildAtlasTree(atlasData, { assignDocumentNumbers: true });
 *
 * // Access the first scope tree
 * const firstScope = result.scopeTrees[0];
 * console.log(`Scope: ${firstScope.generatedDocID}`);
 *
 * // Access its articles
 * firstScope.articles.forEach(article => {
 *   console.log(`  Article: ${article.generatedDocID}`);
 * });
 * ```
 */
export function buildAtlasTree(
  pagesByDatabase: Partial<Record<AtlasDatabaseName, NotionDatabasePage[]>>,
  options: TreeConstructionOptions = {},
): AtlasTreeResult {
  const { assignDocumentNumbers = true, verbose = true, maxDepth = 50, reportMissingChildNodes = false } = options;

  if (verbose) {
    console.log('🌳 Building Atlas tree structure...');
  }

  // Step 1: Create lookup maps for efficient O(1) access
  const lookupMaps = createLookupMaps(pagesByDatabase);

  // Step 2: Normalize document names for all nodes
  generateNormalizedDocumentNames(lookupMaps);

  // Step 3: Find root Scope documents
  const scopePages = pagesByDatabase[ATLAS_DATABASES.SCOPES] || [];
  const unsortedRootScopes = scopePages.filter((page) => page.parent_notion_page_id === null);

  if (unsortedRootScopes.length === 0) {
    throw new Error('No root Scope documents found. Atlas tree requires at least one root Scope.');
  }

  // Sort root Scope documents by their document numbers
  const rootScopes = [...unsortedRootScopes].sort((a, b) =>
    compareDocNumbers(a.atlas_document_number || '', b.atlas_document_number || ''),
  );

  if (verbose) {
    console.log(`📊 Found ${rootScopes.length} root Scope documents`);
  }

  // Step 4: Build tree structures for each root scope
  const scopeTrees: AtlasTreeNode[] = [];
  const errors: TreeConstructionError[] = [];

  for (const rootScope of rootScopes) {
    try {
      const treeNode = buildTreeNode(rootScope, lookupMaps, 0, maxDepth, verbose, reportMissingChildNodes);
      scopeTrees.push(treeNode);
    } catch (error) {
      if (error instanceof Error && error.message.includes('circular reference')) {
        errors.push({
          type: 'circular_reference',
          message: error.message,
          pageId: rootScope.notion_page_id,
          context: { rootScope: rootScope.plain_text_name },
        });
      } else {
        throw error; // Re-throw unexpected errors
      }
    }
  }

  // Step 5: Find orphaned nodes (nodes not connected to any root tree)
  const orphanedNodes = findOrphanedNodes(pagesByDatabase, lookupMaps, scopeTrees);

  // Step 5b: Convert orphaned nodes to AtlasTreeNode format
  const orphanedNodesAsTreeNodes: AtlasTreeNode[] = orphanedNodes.map((orphanedPage) => {
    try {
      // Build tree node for orphaned page (with reasonable depth limit to avoid performance issues)
      return buildTreeNode(orphanedPage, lookupMaps, 0, 10, false, false);
    } catch (conversionError) {
      // If conversion fails, create a minimal AtlasTreeNode
      if (verbose) {
        console.warn(`Failed to convert orphaned node ${orphanedPage.notion_page_id}: ${conversionError}`);
      }
      return {
        ...orphanedPage,
        generatedDocID: undefined,
        generatedDocName: undefined,
        scopes: [],
        articles: [],
        sectionsAndPrimaryDocs: [],
        annotations: [],
        tenets: [],
        scenarios: [],
        scenarioVariations: [],
        activeData: [],
        agentScopeDocs: [],
        neededResearch: [],
      };
    }
  });

  // Step 6: Assign document numbers if requested
  if (assignDocumentNumbers) {
    assignDocumentNumbersToTreesRecursively(scopeTrees);
  }

  // Step 7: Generate duplicated nodes from parent tracking
  const duplicatedNodes = generateDuplicatedNodeList(lookupMaps);

  if (verbose) {
    console.log(`✅ Built ${scopeTrees.length} scope trees with ${orphanedNodes.length} orphaned nodes`);
  }

  return {
    scopeTrees,
    orphanedNodes,
    orphanedNodesAsTreeNodes,
    errors,
    duplicatedNodes,
  };
}

/**
 * Generates document names for all nodes in the lookup maps.
 *
 * This function iterates through all tree nodes and sets their `generatedDocName`
 * property using the `getDocumentTitle` function.
 *
 * Example: "A.1.6 - Facilitators - Budgets" → "Budgets"
 */
function generateNormalizedDocumentNames(lookupMaps: AtlasLookupMaps): void {
  for (const treeNode of lookupMaps.nodeMapByPageId.values()) {
    treeNode.generatedDocName = getDocumentTitle(treeNode);
  }
}

/**
 * Creates efficient lookup maps for O(1) access to nodes and relationships.
 *
 * This function processes all pages from all databases and creates:
 * - nodeMap: pageId -> AtlasTreeNode for instant node access
 * - parentMap: childId -> parentId for efficient parent lookup
 * - childrenMap: parentId -> childIds[] for efficient child lookup
 * - processedIds: Set of processed IDs for circular reference detection
 *
 * @param pagesByDatabase - All pages organized by database
 * @returns AtlasLookupMaps with efficient lookup structures
 */
function createLookupMaps(pagesByDatabase: Partial<Record<AtlasDatabaseName, NotionDatabasePage[]>>): AtlasLookupMaps {
  const nodeMap = new Map<string, AtlasTreeNode>();
  const originalPageMap = new Map<string, NotionDatabasePage>();
  const parentMap = new Map<string, string>();
  const childrenMap = new Map<string, string[]>();
  const processedIds = new Set<string>();

  // Collect all pages from all databases
  const allPages: NotionDatabasePage[] = [];
  for (const pages of Object.values(pagesByDatabase)) {
    if (pages) {
      allPages.push(...pages);
    }
  }

  // Create AtlasTreeNode for each page and build relationship maps
  for (const page of allPages) {
    const treeNode: AtlasTreeNode = {
      ...page,
      generatedDocID: undefined,
      scopes: [],
      articles: [],
      sectionsAndPrimaryDocs: [],
      annotations: [],
      tenets: [],
      scenarios: [],
      scenarioVariations: [],
      activeData: [],
      agentScopeDocs: [],
      neededResearch: [],
    };

    nodeMap.set(page.notion_page_id, treeNode);
    originalPageMap.set(page.notion_page_id, page);

    // Build parent-child relationships from child_* arrays
    const childArrays = [
      page.child_scope_ids,
      page.child_article_ids,
      page.child_section_and_primary_doc_ids,
      page.child_annotation_ids,
      page.child_tenet_ids,
      page.child_scenario_ids,
      page.child_scenario_variation_ids,
      page.child_active_data_ids,
      page.child_agent_scope_ids,
      page.child_needed_research_ids,
    ];

    // Collect all child IDs and build parent-child relationship map
    const childIds: string[] = [];
    for (const array of childArrays) {
      if (Array.isArray(array)) {
        for (const childId of array) {
          if (typeof childId === 'string') {
            childIds.push(childId);
            parentMap.set(childId, page.notion_page_id);
          } else {
            console.error(`Invalid child ID format in ${page.notion_page_id}:`, childId);
          }
        }
      } else {
        console.error(`Expected array for child IDs but got:`, array);
      }
    }

    childrenMap.set(page.notion_page_id, childIds);
  }

  return {
    nodeMapByPageId: nodeMap,
    originalPageMap,
    parentIdMap: parentMap,
    childrenIdsMap: childrenMap,
    processedIds,
    nodeToParentsMap: new Map<string, Set<string>>(),
  };
}

/**
 * Finds a page by ID across all databases.
 *
 * @param pageId - The page ID to find
 * @param lookupMaps - Lookup maps containing all pages
 * @returns The NotionDatabasePage if found, undefined otherwise
 */
function findPageById(pageId: string, lookupMaps: AtlasLookupMaps): NotionDatabasePage | undefined {
  // Efficient O(1) lookup using original NotionDatabasePage objects
  return lookupMaps.originalPageMap.get(pageId);
}

/**
 * Filters child arrays to include only direct children, removing nested descendants.
 *
 * For child_section_and_primary_doc_ids and child_agent_scope_ids arrays, Core documents
 * can have internal hierarchy where one Core document is a child of another Core document.
 * This function filters out Core documents that have ancestors in the same descendantIds array
 * OR ancestors that are the parentPageId (when filtering a specific page's children).
 * Supports deep nesting (e.g. 2-8+ levels).
 *
 * @param descendantIds - Array of descendant document IDs (not just direct children)
 * @param lookupMaps - Lookup maps to find document details
 * @param parentPageId - ID of the page whose children are being filtered (optional)
 * @returns Filtered array containing only direct children
 */
function filterDirectChildren(descendantIds: string[], lookupMaps: AtlasLookupMaps, parentPageId?: string): string[] {
  if (!Array.isArray(descendantIds)) {
    return [];
  }

  const directParentPageWithinSameDatabase = parentPageId ? findPageById(parentPageId, lookupMaps) : undefined;

  return descendantIds.filter((childId) => {
    const childPage = findPageById(childId, lookupMaps);
    if (!childPage) {
      // Keep missing children for error reporting
      return true;
    }

    // If no parent context is provided, conservatively keep (should not happen in our usage)
    if (!directParentPageWithinSameDatabase) {
      return true;
    }

    const isSameDatabase = directParentPageWithinSameDatabase.atlas_database_name === childPage.atlas_database_name;

    if (!isSameDatabase) {
      // Cross-database: Only direct children are those without internal nesting
      // i.e., child must have parent_notion_page_id === null
      return childPage.parent_notion_page_id === null;
    }

    // Same database (e.g., Sections & Primary Docs or Agent Scope Database):
    // Direct child if the child's immediate parent is the current parentPageId
    return childPage.parent_notion_page_id === parentPageId;
  });
}

/**
 * Recursively builds a tree node and all its descendants.
 *
 * This function performs depth-first traversal to build the complete tree structure,
 * with circular reference detection to prevent infinite recursion.
 *
 * @param page - The NotionDatabasePage to convert to a tree node
 * @param lookupMaps - Efficient lookup maps for O(1) access
 * @param depth - Current recursion depth for cycle detection
 * @param maxDepth - Maximum allowed depth to prevent infinite recursion
 * @param verbose - Whether to log detailed construction information
 * @returns AtlasTreeNode with all descendants embedded
 * @throws Error if circular reference is detected
 */
function buildTreeNode(
  page: NotionDatabasePage,
  lookupMaps: AtlasLookupMaps,
  depth: number,
  maxDepth: number,
  verbose: boolean,
  reportMissingChildNodes: boolean = false,
  parentPageId?: string,
): AtlasTreeNode {
  const { nodeMapByPageId: nodeMap, processedIds, nodeToParentsMap } = lookupMaps;

  // Track parent-child relationship for duplicate detection
  if (parentPageId) {
    if (!nodeToParentsMap.has(page.notion_page_id)) {
      nodeToParentsMap.set(page.notion_page_id, new Set());
    }
    nodeToParentsMap.get(page.notion_page_id)!.add(parentPageId);
  }

  // Check for circular reference
  // TODO: There are some exceptions: Needed Research can appear in multiple places
  if (processedIds.has(page.notion_page_id)) {
    throw new Error(`Circular reference detected at page ${page.notion_page_id} (${page.plain_text_name})`);
  }

  // Check depth limit
  if (depth > maxDepth) {
    throw new Error(`Maximum tree depth (${maxDepth}) exceeded at page ${page.notion_page_id}`);
  }

  // Mark as processed to detect cycles
  processedIds.add(page.notion_page_id);

  // Get the tree node (should exist from createLookupMaps)
  const treeNode = nodeMap.get(page.notion_page_id);
  if (!treeNode) {
    throw new Error(`Tree node not found for page ${page.notion_page_id}`);
  }

  if (verbose && depth === 0) {
    console.log(`Building tree for root: ${page.plain_text_name} (${page.notion_page_id})`);
  }

  try {
    // Group children by type and build child trees
    // Filter child arrays that may contain nested descendants instead of just direct children
    const filteredSectionAndPrimaryDocIds = filterDirectChildren(
      page.child_section_and_primary_doc_ids,
      lookupMaps,
      page.notion_page_id,
    );
    const filteredAgentScopeIds = filterDirectChildren(page.child_agent_scope_ids, lookupMaps, page.notion_page_id);

    const childArrays: { array: string[]; type: AtlasTreeNodeRelationship }[] = [
      { array: page.child_scope_ids, type: 'scopes' },
      { array: page.child_article_ids, type: 'articles' },
      { array: filteredSectionAndPrimaryDocIds, type: 'sectionsAndPrimaryDocs' },
      { array: page.child_annotation_ids, type: 'annotations' },
      { array: page.child_tenet_ids, type: 'tenets' },
      { array: page.child_scenario_ids, type: 'scenarios' },
      { array: page.child_scenario_variation_ids, type: 'scenarioVariations' },
      { array: page.child_active_data_ids, type: 'activeData' },
      { array: filteredAgentScopeIds, type: 'agentScopeDocs' },
      { array: page.child_needed_research_ids, type: 'neededResearch' },
    ];
    for (const { array, type } of childArrays) {
      if (Array.isArray(array)) {
        const childNodes: AtlasTreeNode[] = [];

        // Sort siblings based on rules before processing. Docs: https://www.notion.so/atlas-axis/Ordering-Of-Atlas-Documents-280f2ff08d73802e8e08d0bd88e081be
        const childPages = array
          .map((id) => findPageById(id, lookupMaps))
          .filter((page): page is NotionDatabasePage => page !== undefined);

        const sortedChildPages = sortAtlasDocuments(childPages);
        const sortedArray = sortedChildPages.map((page) => page.notion_page_id);

        for (const childId of sortedArray) {
          if (typeof childId === 'string') {
            const childPage = findPageById(childId, lookupMaps);
            if (childPage) {
              try {
                const childTreeNode = buildTreeNode(
                  childPage,
                  lookupMaps,
                  depth + 1,
                  maxDepth,
                  verbose,
                  reportMissingChildNodes,
                  page.notion_page_id,
                );
                childNodes.push(childTreeNode);
              } catch (error) {
                if (error instanceof Error && error.message.includes('circular reference')) {
                  console.error(`Circular reference in ${type} child:`, childId);
                  throw error;
                }
                throw error;
              }
            } else {
              if (reportMissingChildNodes) {
                console.error(`Missing child document referenced in ${type}:`, childId);
              }
            }
          } else {
            console.error(`Invalid child ID format in ${page.notion_page_id}:`, childId);
          }
        }

        // Sort children by sort_order and document number
        const sortedChildren = sortAtlasDocuments<AtlasTreeNode>(childNodes);
        treeNode[type] = sortedChildren;
      }
    }

    return treeNode;
  } finally {
    // IMPORTANT: Remove from processedIds when backtracking to allow legitimate multiple references
    processedIds.delete(page.notion_page_id);
  }
}

/**
 * Finds orphaned nodes that are not connected to any root tree.
 *
 * @param pagesByDatabase - All pages organized by database
 * @param lookupMaps - Lookup maps for efficient access
 * @param scopeTrees - Built scope trees to check against
 * @returns Array of orphaned NotionDatabasePage objects
 */
function findOrphanedNodes(
  pagesByDatabase: Partial<Record<AtlasDatabaseName, NotionDatabasePage[]>>,
  lookupMaps: AtlasLookupMaps,
  scopeTrees: AtlasTreeNode[],
): NotionDatabasePage[] {
  const { nodeMapByPageId: nodeMap, originalPageMap } = lookupMaps;

  // Collect all page IDs that are connected to root trees
  const connectedIds = new Set<string>();

  function collectConnectedIds(node: AtlasTreeNode) {
    connectedIds.add(node.notion_page_id);

    // Recursively collect from all child arrays
    const childArrays = [
      node.scopes,
      node.articles,
      node.sectionsAndPrimaryDocs,
      node.annotations,
      node.tenets,
      node.scenarios,
      node.scenarioVariations,
      node.activeData,
      node.agentScopeDocs,
      node.neededResearch,
    ];

    for (const children of childArrays) {
      for (const child of children) {
        collectConnectedIds(child);
      }
    }
  }

  // Collect IDs from all scope trees
  for (const scopeTree of scopeTrees) {
    collectConnectedIds(scopeTree);
  }

  // Find orphaned nodes
  const orphanedNodes: NotionDatabasePage[] = [];
  for (const [pageId] of nodeMap.entries()) {
    if (!connectedIds.has(pageId)) {
      // Use original NotionDatabasePage from efficient lookup
      const originalPage = originalPageMap.get(pageId);
      if (originalPage) {
        orphanedNodes.push(originalPage);
      }
    }
  }

  return orphanedNodes;
}

/**
 * Generates duplicated nodes list from the parent tracking map.
 * Filters for nodes that appear under multiple parents and returns them with all their parent relationships.
 *
 * @param lookupMaps - Lookup maps containing parent tracking information
 * @returns Array of duplicated nodes with their parent relationships
 */
function generateDuplicatedNodeList(lookupMaps: AtlasLookupMaps): { parentId: string; node: AtlasTreeNode }[] {
  const { nodeToParentsMap, nodeMapByPageId } = lookupMaps;
  const duplicatedNodes: { parentId: string; node: AtlasTreeNode }[] = [];

  // Find nodes that appear under multiple parents
  for (const [nodeId, parentIds] of nodeToParentsMap.entries()) {
    if (parentIds.size > 1) {
      const treeNode = nodeMapByPageId.get(nodeId);
      if (treeNode) {
        // Add an entry for each parent relationship
        for (const parentId of parentIds) {
          duplicatedNodes.push({ parentId, node: treeNode });
        }
      } else {
        console.error(`Tree node not found for duplicate tracking: ${nodeId}`);
      }
    }
  }

  return duplicatedNodes;
}
