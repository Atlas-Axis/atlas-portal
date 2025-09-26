import { NotionDatabasePage } from '../../app/server/database/notion-database-page';
import { ATLAS_DATABASES, AtlasDatabaseName } from '../../app/server/services/atlas/constants';
import { assignDocumentNumbersToTrees } from './atlas-tree-numbering';
import {
  AtlasLookupMaps,
  AtlasTreeNode,
  AtlasTreeNodeRelationship,
  AtlasTreeResult,
  TreeConstructionError,
  TreeConstructionOptions,
} from './atlas-tree-types';
import { compareDocNumbers } from './utils';

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
  const { assignDocumentNumbers = true, verbose = true, maxDepth = 50 } = options;

  if (verbose) {
    console.log('🌳 Building Atlas tree structure...');
  }

  // Step 1: Create lookup maps for efficient O(1) access
  const lookupMaps = createLookupMaps(pagesByDatabase);

  // Step 2: Find root Scope documents
  const scopePages = pagesByDatabase[ATLAS_DATABASES.SCOPES] || [];
  const rootScopes = scopePages.filter((page) => page.parent_notion_page_id === null);

  if (rootScopes.length === 0) {
    throw new Error('No root Scope documents found. Atlas tree requires at least one root Scope.');
  }

  if (verbose) {
    console.log(`📊 Found ${rootScopes.length} root Scope documents`);
  }

  // Step 3: Build tree structures for each root scope
  const scopeTrees: AtlasTreeNode[] = [];
  const errors: TreeConstructionError[] = [];

  for (const rootScope of rootScopes) {
    try {
      const treeNode = buildTreeNode(rootScope, lookupMaps, 0, maxDepth, verbose);
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

  // Step 4: Find orphaned nodes (nodes not connected to any root tree)
  const orphanedNodes = findOrphanedNodes(pagesByDatabase, lookupMaps, scopeTrees);

  // Step 5: Assign document numbers if requested
  if (assignDocumentNumbers) {
    assignDocumentNumbersToTrees(scopeTrees);
  }

  if (verbose) {
    console.log(`✅ Built ${scopeTrees.length} scope trees with ${orphanedNodes.length} orphaned nodes`);
  }

  return {
    scopeTrees,
    orphanedNodes,
    errors,
  };
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

  return { nodeMapByPageId: nodeMap, parentIdMap: parentMap, childrenIdsMap: childrenMap, processedIds };
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
): AtlasTreeNode {
  // TODO: Remove unused vars
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { nodeMapByPageId: nodeMap, parentIdMap: parentMap, childrenIdsMap: childrenMap, processedIds } = lookupMaps;

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
    console.log(`🌲 Building tree for root: ${page.plain_text_name} (${page.notion_page_id})`);
  }

  // Group children by type and build child trees
  const childArrays: { array: string[]; type: AtlasTreeNodeRelationship }[] = [
    { array: page.child_scope_ids, type: 'scopes' },
    { array: page.child_article_ids, type: 'articles' },
    { array: page.child_section_and_primary_doc_ids, type: 'sectionsAndPrimaryDocs' },
    { array: page.child_annotation_ids, type: 'annotations' },
    { array: page.child_tenet_ids, type: 'tenets' },
    { array: page.child_scenario_ids, type: 'scenarios' },
    { array: page.child_scenario_variation_ids, type: 'scenarioVariations' },
    { array: page.child_active_data_ids, type: 'activeData' },
    { array: page.child_agent_scope_ids, type: 'agentScopeDocs' },
    { array: page.child_needed_research_ids, type: 'neededResearch' },
  ];

  for (const { array, type } of childArrays) {
    if (Array.isArray(array)) {
      const childNodes: AtlasTreeNode[] = [];

      for (const childId of array) {
        if (typeof childId === 'string') {
          const childPage = findPageById(childId, lookupMaps);
          if (childPage) {
            try {
              const childTreeNode = buildTreeNode(childPage, lookupMaps, depth + 1, maxDepth, verbose);
              childNodes.push(childTreeNode);
            } catch (error) {
              if (error instanceof Error && error.message.includes('circular reference')) {
                console.error(`Circular reference in ${type} child:`, childId);
                throw error;
              }
              throw error;
            }
          } else {
            console.error(`Missing child document referenced in ${type}:`, childId);
          }
        } else {
          console.error(`Invalid child ID format in ${page.notion_page_id}:`, childId);
        }
      }

      // Sort children by sort_order and document type priority
      const sortedChildren = sortChildren(childNodes);
      treeNode[type] = sortedChildren;
    }
  }

  return treeNode;
}

/**
 * Finds a page by ID across all databases.
 *
 * @param pageId - The page ID to find
 * @param lookupMaps - Lookup maps containing all pages
 * @returns The NotionDatabasePage if found, undefined otherwise
 */
function findPageById(pageId: string, lookupMaps: AtlasLookupMaps): NotionDatabasePage | undefined {
  const treeNode = lookupMaps.nodeMapByPageId.get(pageId);
  if (treeNode) {
    // Convert AtlasTreeNode back to NotionDatabasePage format
    const {
      scopes,
      articles,
      sectionsAndPrimaryDocs,
      annotations,
      tenets,
      scenarios,
      scenarioVariations,
      activeData,
      agentScopeDocs,
      neededResearch,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      generatedDocID,
      ...pageData
    } = treeNode;

    // Reconstruct the child_*_ids arrays from embedded child nodes
    const notionPage: NotionDatabasePage = {
      ...pageData,
      child_scope_ids: scopes.map((child) => child.notion_page_id),
      child_article_ids: articles.map((child) => child.notion_page_id),
      child_section_and_primary_doc_ids: sectionsAndPrimaryDocs.map((child) => child.notion_page_id),
      child_annotation_ids: annotations.map((child) => child.notion_page_id),
      child_tenet_ids: tenets.map((child) => child.notion_page_id),
      child_scenario_ids: scenarios.map((child) => child.notion_page_id),
      child_scenario_variation_ids: scenarioVariations.map((child) => child.notion_page_id),
      child_active_data_ids: activeData.map((child) => child.notion_page_id),
      child_agent_scope_ids: agentScopeDocs.map((child) => child.notion_page_id),
      child_needed_research_ids: neededResearch.map((child) => child.notion_page_id),
    } as NotionDatabasePage;

    return notionPage;
  }
  return undefined;
}

/**
 * Sorts child nodes by sort_order and document type priority.
 *
 * This function implements the same sorting logic as the original document numbering system,
 * ensuring consistent ordering across the tree structure.
 *
 * @param children - Array of child tree nodes to sort
 * @returns Sorted array of child tree nodes
 */
function sortChildren(children: AtlasTreeNode[]): AtlasTreeNode[] {
  return [...children].sort((a, b) => {
    // First sort by sort_order
    const aOrder = a.sort_order;
    const bOrder = b.sort_order;
    const aHasOrder = aOrder != null;
    const bHasOrder = bOrder != null;

    if (aHasOrder && bHasOrder && aOrder! !== bOrder!) {
      return aOrder! - bOrder!;
    }
    if (aHasOrder && !bHasOrder) return -1;
    if (!aHasOrder && bHasOrder) return 1;

    // Then sort by document type priority
    // TODO: Verify this logic is correct
    const typePriority: Record<string, number> = {
      Core: 1,
      'Active Data Controller': 2,
      'Type Specification': 3,
      Section: 4,
      Article: 5,
      Scope: 6,
      Annotation: 7,
      'Action Tenet': 8,
      Scenario: 9,
      'Scenario Variation': 10,
      'Active Data': 11,
      'Needed Research': 12,
    };

    const aPriority = typePriority[a.atlas_document_type] || 999;
    const bPriority = typePriority[b.atlas_document_type] || 999;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // Final fallback: use atlas_document_number
    const an = a.atlas_document_number || '';
    const bn = b.atlas_document_number || '';
    return compareDocNumbers(an, bn);
  });
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
  const { nodeMapByPageId: nodeMap } = lookupMaps;

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
  for (const [pageId, treeNode] of nodeMap.entries()) {
    if (!connectedIds.has(pageId)) {
      // Convert AtlasTreeNode back to NotionDatabasePage
      const {
        scopes,
        articles,
        sectionsAndPrimaryDocs,
        annotations,
        tenets,
        scenarios,
        scenarioVariations,
        activeData,
        agentScopeDocs,
        neededResearch,
        generatedDocID,
        ...pageData
      } = treeNode;
      orphanedNodes.push(pageData as NotionDatabasePage);
    }
  }

  return orphanedNodes;
}
