import { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import { ATLAS_DATABASES } from '@/app/server/atlas/constants';
import { compareDocNumbers } from '@/app/server/atlas/document-numbering/atlas-utils';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { NotionRichText } from '@/app/server/markdown/notion-types';
import { applyNestingOverrides } from '@/app/server/services/notion/apply-nesting-overrides';
import {
  NotionNestingBugMapping,
  loadNotionNestingFixMappings,
} from '@/app/server/services/supabase/notion-nesting-bug-mappings';
import { UuidMappings } from '../load-uuid-mapping';
import { getDocumentTitle, sortAtlasDocuments } from './atlas-tree-helpers';
import { assignDocumentNumbersToTreesRecursively } from './atlas-tree-numbering';
import {
  AtlasLookupMaps,
  AtlasTreeNode,
  AtlasTreeNodeRelationship,
  AtlasTreeResult,
  AtlasUUIDToDocNoAndDocNameMaps,
  DuplicatedNodeEntry,
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
 * Process steps:
 * 1. Create lookup maps for O(1) access
 * 2. Generate normalized document names
 * 3. Find root Scope documents
 * 4. Build tree structures for each root scope
 * 5. Find orphaned nodes
 * 6. Assign document numbers
 * 7. Generate Atlas UUID maps (document numbers and names)
 * 8. Update Rich Text mentions with correct document numbers and names
 * 9. Generate duplicated nodes list
 *
 * @param pagesByDatabase - Pages organized by database name from loadAtlasFromSupabaseWithNestingAgentsUnderSection
 * @param options - Configuration options for tree construction
 * @returns AtlasTreeResult containing scope trees, orphaned nodes, and any errors
 *
 * @example
 * ```typescript
 * const atlasData = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();
 * const uuidMappings = await loadUuidMappings();
 * const result = buildAtlasTree(atlasData, { uuidMappings });
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
export async function buildAtlasTree(
  pagesByDatabase: Partial<Record<AtlasDatabaseName, NotionDatabasePage[]>>,
  options: TreeConstructionOptions,
): Promise<AtlasTreeResult> {
  const { uuidMappings, verbose = true, maxDepth = 50, reportMissingChildNodes = false } = options;

  if (verbose) {
    console.log('🌳 Building Atlas tree structure...');
  }

  // Load nesting fix mappings from Supabase
  const nestingMappings = await loadNotionNestingFixMappings();

  if (nestingMappings.length > 0 && verbose) {
    console.log(`🔧 Loaded ${nestingMappings.length} nesting fix mapping(s) to apply during tree building`);
  }

  // Pre-index sibling positioning mappings by parent ID for O(1) lookup
  // This avoids filtering through all mappings for every parent node
  const siblingPositioningMappingsByParent = createSiblingPositioningIndex(nestingMappings);

  // Apply nesting overrides to pages in-memory before building tree
  const pagesByDatabaseWithOverrides: Partial<Record<AtlasDatabaseName, NotionDatabasePage[]>> = {};

  (Object.keys(pagesByDatabase) as AtlasDatabaseName[]).forEach((dbName) => {
    const pages = pagesByDatabase[dbName];
    if (pages) {
      pagesByDatabaseWithOverrides[dbName] = applyNestingOverrides(pages, nestingMappings, dbName);
    }
  });

  // Step 1: Create lookup maps for efficient O(1) access
  const lookupMaps = createLookupMaps(pagesByDatabaseWithOverrides);

  // Step 2: Normalize document names for all nodes
  generateNormalizedDocumentNames(lookupMaps);

  // Step 3: Find root Scope documents
  const scopePages = pagesByDatabaseWithOverrides[ATLAS_DATABASES.SCOPES] || [];
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
      const treeNode = buildTreeNode(
        rootScope,
        lookupMaps,
        0,
        maxDepth,
        verbose,
        reportMissingChildNodes,
        undefined,
        siblingPositioningMappingsByParent,
      );
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
  const orphanedNodes = findOrphanedNodes(pagesByDatabaseWithOverrides, lookupMaps, scopeTrees);

  // Step 5b: Convert orphaned nodes to AtlasTreeNode format
  const orphanedNodesAsTreeNodes: AtlasTreeNode[] = orphanedNodes.map((orphanedPage) => {
    try {
      // Build tree node for orphaned page (with reasonable depth limit to avoid performance issues)
      return buildTreeNode(
        orphanedPage,
        lookupMaps,
        0,
        50,
        false,
        false,
        undefined,
        siblingPositioningMappingsByParent,
      );
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

  // Step 6: Assign document numbers
  assignDocumentNumbersToTreesRecursively(scopeTrees);

  // Step 7: Generate Atlas UUID maps (document numbers and names)
  const { atlasUUIDsToGeneratedDocNumbers, atlasUUIDsToDocNames } = generateAtlasUUIDToDocNoAndDocNameMaps(
    scopeTrees,
    orphanedNodesAsTreeNodes,
    uuidMappings,
  );

  // Step 8: Update Rich Text mentions with correct document numbers and names
  updateRichTextMentionsInTree(
    scopeTrees,
    orphanedNodesAsTreeNodes,
    atlasUUIDsToGeneratedDocNumbers,
    atlasUUIDsToDocNames,
    uuidMappings,
    verbose,
  );

  // Step 9: Generate duplicated nodes from parent tracking
  // TODO: What is this?s
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
    atlasUUIDsToGeneratedDocNumbers,
    atlasUUIDsToDocNames,
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
    treeNode.generatedDocName = getDocumentTitle(treeNode).trim();
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
  siblingPositioningMappingsByParent?: Map<string, NotionNestingBugMapping[]>,
): AtlasTreeNode {
  const { nodeMapByPageId: nodeMap, processedIds, nodeToParentsMap } = lookupMaps;

  // Track parent-child relationship for duplicate detection
  if (parentPageId) {
    if (!nodeToParentsMap.has(page.notion_page_id)) {
      nodeToParentsMap.set(page.notion_page_id, new Set());
    }
    nodeToParentsMap.get(page.notion_page_id)!.add(parentPageId);
  }

  // Check for duplicate processing
  // Exception: Needed Research documents can appear in multiple places (handled in finally block)
  if (processedIds.has(page.notion_page_id)) {
    // This is a duplicate occurrence - only allowed for Needed Research
    if (page.atlas_document_type === 'Needed Research') {
      // This shouldn't happen due to the finally block logic, but handle it defensively
      console.warn(
        `[buildTreeNode] Needed Research document processed multiple times: ${page.notion_page_id} - ${page.plain_text_name}`,
      );
    } else {
      // Skip this duplicate occurrence for non-Needed-Research documents
      console.warn(
        `[buildTreeNode] Duplicate document detected (skipping): ${page.notion_page_id} - ${page.plain_text_name} (${page.atlas_document_type})`,
      );
      // Return a stub node without children - will be filtered out later
      return {
        ...page,
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

        // Sort siblings based on rules before processing
        // Docs: https://www.notion.so/atlas-axis/Ordering-Of-Atlas-Documents-280f2ff08d73802e8e08d0bd88e081be
        const childPages = array
          .map((id) => findPageById(id, lookupMaps))
          .filter((page): page is NotionDatabasePage => page !== undefined);

        const sortedChildPages = sortAtlasDocuments(childPages);
        const sortedArray = sortedChildPages.map((page) => page.notion_page_id);

        // Log missing children that could not be resolved to pages
        if (reportMissingChildNodes) {
          for (const originalId of array) {
            if (typeof originalId === 'string') {
              const exists = lookupMaps.originalPageMap.has(originalId);
              if (!exists) {
                console.error(`Missing child document referenced in ${type}:`, originalId);
              }
            }
          }
        }

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
                  siblingPositioningMappingsByParent,
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
        let sortedChildren = sortAtlasDocuments<AtlasTreeNode>(childNodes);

        // Apply sibling positioning adjustments after sorting (if any mappings exist for this parent)
        if (siblingPositioningMappingsByParent) {
          sortedChildren = applySiblingPositioning(
            sortedChildren,
            page.notion_page_id,
            siblingPositioningMappingsByParent,
            verbose,
          );
        }

        treeNode[type] = sortedChildren;
      }
    }

    return treeNode;
  } finally {
    // Only allow Needed Research documents to appear multiple times (they use global numbering like NR-1, NR-2)
    // For all other document types, keep them in processedIds to prevent duplicate processing
    if (page.atlas_document_type === 'Needed Research') {
      processedIds.delete(page.notion_page_id);
    }
  }
}

/**
 * Create an index of sibling positioning mappings by parent ID for O(1) lookup.
 * This pre-processes the mappings once instead of filtering on every parent node.
 *
 * @param nestingMappings - All nesting mappings from Supabase
 * @returns Map of parent page ID to array of sibling positioning mappings
 */
function createSiblingPositioningIndex(
  nestingMappings: NotionNestingBugMapping[],
): Map<string, NotionNestingBugMapping[]> {
  const index = new Map<string, NotionNestingBugMapping[]>();

  for (const mapping of nestingMappings) {
    // Only index mappings that have sibling positioning
    if (mapping.place_after_sibling_notion_page_id) {
      const parentId = mapping.parent_notion_page_id;
      const existing = index.get(parentId);

      if (existing) {
        existing.push(mapping);
      } else {
        index.set(parentId, [mapping]);
      }
    }
  }

  return index;
}

/**
 * Apply sibling positioning adjustments to sorted children.
 * This reorders children based on place_after_sibling_notion_page_id mappings,
 * applying manual positioning after the default sort.
 *
 * **Important**: Multiple mappings for the same parent are applied sequentially.
 * If multiple children reference the same sibling, they will be inserted in
 * the order the mappings are processed (last mapping's child appears after earlier ones).
 *
 * @param sortedChildren - Children already sorted by default rules
 * @param parentPageId - The parent page ID to check for mappings
 * @param siblingPositioningByParent - Pre-indexed map of parent ID to sibling positioning mappings (O(1) lookup)
 * @param verbose - Whether to log positioning actions
 * @returns Reordered children with sibling positioning applied
 */
function applySiblingPositioning(
  sortedChildren: AtlasTreeNode[],
  parentPageId: string,
  siblingPositioningByParent: Map<string, NotionNestingBugMapping[]>,
  verbose: boolean,
): AtlasTreeNode[] {
  // O(1) lookup - get mappings for this specific parent
  const relevantMappings = siblingPositioningByParent.get(parentPageId);

  if (!relevantMappings || relevantMappings.length === 0) {
    return sortedChildren;
  }

  // Create a working copy of the sorted children
  const result = [...sortedChildren];

  // Apply each sibling positioning mapping
  for (const mapping of relevantMappings) {
    const childId = mapping.child_notion_page_id;
    const siblingId = mapping.place_after_sibling_notion_page_id!;

    // Find the child and sibling in the current array
    const childIndex = result.findIndex((node) => node.notion_page_id === childId);
    const siblingIndex = result.findIndex((node) => node.notion_page_id === siblingId);

    if (childIndex === -1) {
      if (verbose) {
        console.warn(`  ⚠ Child ${childId} not found in sorted children for parent ${parentPageId}`);
      }
      continue;
    }

    if (siblingIndex === -1) {
      if (verbose) {
        console.warn(`  ⚠ Sibling ${siblingId} not found in sorted children for parent ${parentPageId}`);
      }
      continue;
    }

    // Remove child from its current position
    const [childNode] = result.splice(childIndex, 1);

    // Recalculate sibling index after removal (if child was before sibling)
    const adjustedSiblingIndex = childIndex < siblingIndex ? siblingIndex - 1 : siblingIndex;

    // Insert child after the sibling
    result.splice(adjustedSiblingIndex + 1, 0, childNode);

    if (verbose) {
      console.log(`  🎯 Repositioned ${childId} after sibling ${siblingId} in parent ${parentPageId}`);
    }
  }

  return result;
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
 * Generates UUID-to-document mappings for Atlas documents.
 *
 * Traverses all nodes in scope trees and orphaned nodes, and creates two maps:
 * 1. Atlas UUID → generated document number (generatedDocID)
 * 2. Atlas UUID → generated document name (generatedDocName)
 *
 * @param scopeTrees - Array of root scope trees
 * @param orphanedNodesAsTreeNodes - Array of orphaned nodes as tree nodes
 * @param uuidMappings - UUID mappings to convert notion_page_id to atlas_document_uuid
 * @returns Object containing both UUID-to-document-number and UUID-to-document-name maps
 */
function generateAtlasUUIDToDocNoAndDocNameMaps(
  scopeTrees: AtlasTreeNode[],
  orphanedNodesAsTreeNodes: AtlasTreeNode[],
  uuidMappings: UuidMappings,
): AtlasUUIDToDocNoAndDocNameMaps {
  const atlasUUIDsToDocNumbers = new Map<string, string>();
  const atlasUUIDsToDocNames = new Map<string, string>();

  function processNode(node: AtlasTreeNode) {
    const atlasUUID = uuidMappings.notionPageIDsToAtlasUUIDs.get(node.notion_page_id);

    if (atlasUUID) {
      // Add document number mapping if defined
      if (node.generatedDocID) {
        atlasUUIDsToDocNumbers.set(atlasUUID, node.generatedDocID);
      }

      // Add document name mapping if defined
      if (node.generatedDocName) {
        atlasUUIDsToDocNames.set(atlasUUID, node.generatedDocName);
      }
    }

    // Recursively process all child arrays
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
        processNode(child);
      }
    }
  }

  // Process all scope trees
  for (const scopeTree of scopeTrees) {
    processNode(scopeTree);
  }

  // Process all orphaned nodes
  for (const orphanedNode of orphanedNodesAsTreeNodes) {
    processNode(orphanedNode);
  }

  return {
    atlasUUIDsToGeneratedDocNumbers: atlasUUIDsToDocNumbers,
    atlasUUIDsToDocNames: atlasUUIDsToDocNames,
  };
}

/**
 * Generates duplicated nodes list from the parent tracking map.
 * Filters for nodes that appear under multiple parents and returns them with all their parent relationships.
 *
 * @param lookupMaps - Lookup maps containing parent tracking information
 * @returns Array of duplicated nodes with their parent relationships
 */
function generateDuplicatedNodeList(lookupMaps: AtlasLookupMaps): DuplicatedNodeEntry[] {
  const { nodeToParentsMap, nodeMapByPageId } = lookupMaps;
  const duplicatedNodes: DuplicatedNodeEntry[] = [];

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

/**
 * Type guard to check if a value is a Rich Text array.
 * Rich Text arrays contain objects with a 'type' property.
 */
function isRichTextArray(value: unknown): value is NotionRichText[] {
  return (
    Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null && 'type' in value[0]
  );
}

/**
 * Updates mention objects in a Rich Text array with correct document numbers and names.
 *
 * For each mention object in the array:
 * 1. Extracts the Notion page ID from mention.page.id
 * 2. Looks up the Atlas UUID using uuidMappings
 * 3. Looks up the document number using atlasUUIDsToGeneratedDocNumbers
 * 4. Looks up the document name using atlasUUIDsToDocNames
 * 5. Updates the plain_text field with format: "{number} - {name}" (e.g., "A.0.1 - General Provisions")
 * 6. If mapping not found, replaces with "[Unknown]"
 *
 * @param richTextArray - Array of Rich Text objects (mutated in-place)
 * @param atlasUUIDsToGeneratedDocNumbers - Map from Atlas UUID to document number
 * @param atlasUUIDsToDocNames - Map from Atlas UUID to document name
 * @param uuidMappings - UUID mappings to convert Notion page ID to Atlas UUID
 * @returns Number of mentions updated
 */
export function updateMentionInRichTextArray(
  richTextArray: NotionRichText[],
  atlasUUIDsToGeneratedDocNumbers: Map<string, string>,
  atlasUUIDsToDocNames: Map<string, string>,
  uuidMappings: UuidMappings,
): number {
  let updatedCount = 0;

  for (const richTextItem of richTextArray) {
    // Only process mention objects
    if (richTextItem.type !== 'mention') {
      continue;
    }

    // Extract Notion page ID from mention object
    // Only process page mentions (not user, database, or date mentions)
    const mention = richTextItem.mention;
    if (!mention || mention.type !== 'page') {
      continue;
    }

    const notionPageId = mention.page.id;
    if (!notionPageId) {
      console.warn(`No Notion page ID found for page mention in Rich Text array`);
      continue;
    }

    // Look up Atlas UUID from Notion page ID
    const atlasUUID = uuidMappings.notionPageIDsToAtlasUUIDs.get(notionPageId);

    if (!atlasUUID) {
      // UUID mapping not found - replace with placeholder
      richTextItem.plain_text = '[Unknown]';
      console.warn(`UUID mapping not found for Notion page ID: ${notionPageId}`);
      updatedCount++;
      continue;
    }

    // Look up document number and name from Atlas UUID
    const documentNumber = atlasUUIDsToGeneratedDocNumbers.get(atlasUUID);
    const documentName = atlasUUIDsToDocNames.get(atlasUUID);

    if (!documentNumber) {
      // Document number not found - replace with placeholder
      richTextItem.plain_text = '[Unknown]';
      console.warn(`Document number not found for Atlas UUID: ${atlasUUID} (Notion page: ${notionPageId})`);
      updatedCount++;
      continue;
    }

    // Format: "A.0.1 - Document Name" or just "A.0.1" if name is not available
    if (documentName) {
      richTextItem.plain_text = `${documentNumber} - ${documentName}`;
    } else {
      richTextItem.plain_text = documentNumber;
      console.warn(`Document name not found for Atlas UUID: ${atlasUUID} (using number only: ${documentNumber})`);
    }

    updatedCount++;
  }

  return updatedCount;
}

/**
 * Updates Rich Text mentions in a single tree node's json_content field.
 *
 * Handles two cases:
 * 1. json_content is a Rich Text array directly
 * 2. json_content is an object containing Rich Text arrays in nested properties
 *
 * Mutates the node's json_content in-place.
 *
 * @param node - Tree node to update (mutated in-place)
 * @param atlasUUIDsToGeneratedDocNumbers - Map from Atlas UUID to document number
 * @param atlasUUIDsToDocNames - Map from Atlas UUID to document name
 * @param uuidMappings - UUID mappings to convert Notion page ID to Atlas UUID
 * @returns Number of mentions updated
 */
function updateRichTextMentionsInNode(
  node: AtlasTreeNode,
  atlasUUIDsToGeneratedDocNumbers: Map<string, string>,
  atlasUUIDsToDocNames: Map<string, string>,
  uuidMappings: UuidMappings,
): number {
  let updatedCount = 0;

  if (!node.json_content) {
    return 0;
  }

  // Case 1: json_content is a Rich Text array directly
  if (isRichTextArray(node.json_content)) {
    updatedCount += updateMentionInRichTextArray(
      node.json_content,
      atlasUUIDsToGeneratedDocNumbers,
      atlasUUIDsToDocNames,
      uuidMappings,
    );
    return updatedCount;
  }

  // Case 2: json_content is an object - recursively search for Rich Text arrays
  if (typeof node.json_content === 'object' && node.json_content !== null && !Array.isArray(node.json_content)) {
    console.warn('json_content is an object', node.notion_page_id);
    // const jsonContent = node.json_content as Record<string, unknown>;

    // for (const value of Object.values(jsonContent)) {
    //   if (isRichTextArray(value)) {
    //     updatedCount += updateMentionInRichTextArray(value, atlasUUIDsToGeneratedDocNumbers, atlasUUIDsToDocNames, uuidMappings);
    //   } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    //     // Recursively check nested objects
    //     const nestedObj = value as Record<string, unknown>;
    //     for (const nestedValue of Object.values(nestedObj)) {
    //       if (isRichTextArray(nestedValue)) {
    //         updatedCount += updateMentionInRichTextArray(nestedValue, atlasUUIDsToGeneratedDocNumbers, atlasUUIDsToDocNames, uuidMappings);
    //       }
    //     }
    //   }
    // }
  }

  return updatedCount;
}

/**
 * Recursively updates Rich Text mentions in all nodes of the Atlas tree.
 *
 * Traverses all scope trees and orphaned nodes, updating mention objects
 * in their json_content fields with correct document numbers and names.
 *
 * @param scopeTrees - Array of root scope trees
 * @param orphanedNodesAsTreeNodes - Array of orphaned nodes as tree nodes
 * @param atlasUUIDsToGeneratedDocNumbers - Map from Atlas UUID to document number
 * @param atlasUUIDsToDocNames - Map from Atlas UUID to document name
 * @param uuidMappings - UUID mappings to convert Notion page ID to Atlas UUID
 * @param verbose - Whether to log detailed update information
 * @returns Total number of mentions updated across all nodes
 */
function updateRichTextMentionsInTree(
  scopeTrees: AtlasTreeNode[],
  orphanedNodesAsTreeNodes: AtlasTreeNode[],
  atlasUUIDsToGeneratedDocNumbers: Map<string, string>,
  atlasUUIDsToDocNames: Map<string, string>,
  uuidMappings: UuidMappings,
  verbose: boolean,
): number {
  let totalUpdatedCount = 0;

  function processNode(node: AtlasTreeNode): void {
    // Update mentions in current node
    const count = updateRichTextMentionsInNode(
      node,
      atlasUUIDsToGeneratedDocNumbers,
      atlasUUIDsToDocNames,
      uuidMappings,
    );
    totalUpdatedCount += count;

    // Recursively process all child arrays
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
        processNode(child);
      }
    }
  }

  // Process all scope trees
  for (const scopeTree of scopeTrees) {
    processNode(scopeTree);
  }

  // Process all orphaned nodes
  for (const orphanedNode of orphanedNodesAsTreeNodes) {
    processNode(orphanedNode);
  }

  if (verbose) {
    console.log(`📝 Updated ${totalUpdatedCount} Rich Text mention(s) with correct document numbers and names`);
  }

  return totalUpdatedCount;
}
