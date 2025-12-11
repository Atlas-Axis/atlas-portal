import { compareDocNumbers } from '@/app/server/atlas/document-numbering/atlas-utils';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { applyNestingOverrides } from '@/app/server/services/notion/apply-nesting-overrides';
import {
  NotionNestingBugMapping,
  loadNotionNestingFixMappings,
} from '@/app/server/services/supabase/notion-nesting-bug-mappings';
import { UuidMappings } from '../load-uuid-mapping';
import { getDocumentTitle, sortAtlasDocuments } from './atlas-tree-helpers';
import { updateRichTextMentionsInTree } from './atlas-tree-mentions';
import { assignDocumentNumbersToTreesRecursively } from './atlas-tree-numbering';
import {
  NotionAtlasTreeConstructionError,
  NotionAtlasTreeConstructionOptions,
  NotionAtlasTreeDuplicatedNodeEntry,
  NotionAtlasTreeLookupMaps,
  NotionAtlasTreeNode,
  NotionAtlasTreeNodeRelationship,
  NotionAtlasTreeResult,
  NotionAtlasTreeUUIDToDocNoAndDocNameMaps,
} from './atlas-tree-types';

/**
 * Builds the Notion Atlas Tree structure (Internal Atlas Representation) from Supabase data.
 *
 * This function takes a flat array of all Atlas pages from `loadAtlasFromSupabase`
 * and creates a hierarchical tree structure where each root node is a Scope document
 * and contains all its descendant documents as embedded child nodes.
 *
 * The function uses efficient lookup maps to handle ~6000 Atlas documents with deep nesting,
 * providing O(1) access to nodes and relationships during construction.
 *
 * Process steps:
 * 1. Load nesting fix mappings
 * 2. Apply nesting overrides to flat array
 * 3. Create lookup maps for O(1) access
 * 4. Generate normalized document names
 * 5. Find root Scope documents
 * 6. Build tree structures for each root scope
 * 7. Find orphaned nodes (after tree building, so overrides have been applied)
 * 8. Assign document numbers
 * 9. Generate Atlas UUID maps (document numbers and names)
 * 10. Update Rich Text mentions with correct document numbers and names
 * 11. Generate duplicated nodes list
 *
 * @param allPages - Flat array of all pages from loadAtlasFromSupabase
 * @param options - Configuration options for tree construction
 * @returns NotionAtlasTreeResult containing scope trees, orphaned nodes, and any errors
 *
 * @example
 * ```typescript
 * const allPages = await loadAtlasFromSupabase();
 * const uuidMappings = await loadUuidMappings();
 * const result = buildNotionAtlasTree(allPages, { uuidMappings });
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
export async function buildNotionAtlasTree(
  allPages: NotionDatabasePage[],
  options: NotionAtlasTreeConstructionOptions,
): Promise<NotionAtlasTreeResult> {
  const { uuidMappings, verbose = true, maxDepth = 50, reportMissingChildNodes = false } = options;

  if (verbose) {
    console.log('🌳 Building Atlas tree structure...');
  }

  // Step 1: Load nesting fix mappings from Supabase
  const nestingMappings = await loadNotionNestingFixMappings();

  if (nestingMappings.length > 0 && verbose) {
    console.log(`🔧 Loaded ${nestingMappings.length} nesting fix mapping(s) to apply during tree building`);
  }

  // Pre-index sibling positioning mappings by parent ID for O(1) lookup
  // This avoids filtering through all mappings for every parent node
  const siblingPositioningMappingsByParent = createSiblingPositioningIndex(nestingMappings);

  // Step 2: Apply nesting overrides to flat array (handles all databases in one pass)
  // This must happen before tree building so orphaned node detection is accurate - this may fix previously orphaned nodes' parents
  const pagesWithOverrides = applyNestingOverrides(allPages, nestingMappings);

  // Step 3: Create lookup maps for efficient O(1) access
  const lookupMaps: NotionAtlasTreeLookupMaps = createLookupMaps(pagesWithOverrides);

  // Step 4: Normalize document names for all nodes
  generateNormalizedDocumentNames(lookupMaps);

  // Step 5: Find root Scope documents
  const unsortedRootScopes = pagesWithOverrides.filter((page) => page.atlas_database_name === 'Scopes');

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

  // Step 6: Build tree structures for each root scope
  const scopeTrees: NotionAtlasTreeNode[] = [];
  const errors: NotionAtlasTreeConstructionError[] = [];

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

  // Step 7: Find orphaned nodes (nodes not connected to any root tree, after overrides have been applied)
  const orphanedNodes = findOrphanedNodes(pagesWithOverrides, lookupMaps, scopeTrees);

  if (verbose) {
    console.log(`📊 Found ${orphanedNodes.length} orphaned nodes`);
  }

  // Step 7b: Convert orphaned nodes to NotionAtlasTreeNode format
  const orphanedNodesAsTreeNodes: NotionAtlasTreeNode[] = orphanedNodes.map((orphanedPage) => {
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
        true, // isOrphanedNode = true
      );
    } catch (conversionError) {
      // If conversion fails, create a minimal NotionAtlasTreeNode
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

  // Step 8: Assign document numbers
  assignDocumentNumbersToTreesRecursively(scopeTrees);

  // Step 9: Generate Atlas UUID maps (document numbers and names)
  const { atlasUUIDsToGeneratedDocNumbers, atlasUUIDsToDocNames } = generateAtlasUUIDToDocNoAndDocNameMaps(
    scopeTrees,
    orphanedNodesAsTreeNodes,
    uuidMappings,
  );

  // Step 10: Update Rich Text mentions with correct document numbers and names
  updateRichTextMentionsInTree(
    scopeTrees,
    orphanedNodesAsTreeNodes,
    atlasUUIDsToGeneratedDocNumbers,
    atlasUUIDsToDocNames,
    uuidMappings,
    verbose,
  );

  // Step 11: Generate duplicated nodes from parent tracking
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
function generateNormalizedDocumentNames(lookupMaps: NotionAtlasTreeLookupMaps): void {
  for (const treeNode of lookupMaps.nodeMapByPageId.values()) {
    treeNode.generatedDocName = getDocumentTitle(treeNode).trim();
  }
}

/**
 * Creates efficient lookup maps for O(1) access to nodes and relationships.
 *
 * This function processes all pages and creates:
 * - nodeMap: pageId -> NotionAtlasTreeNode for instant node access
 * - parentMap: childId -> parentId for efficient parent lookup
 * - childrenMap: parentId -> childIds[] for efficient child lookup
 * - processedIds: Set of processed IDs for circular reference detection
 *
 * @param allPages - Flat array of all pages
 * @returns NotionAtlasTreeLookupMaps with efficient lookup structures
 */
function createLookupMaps(allPages: NotionDatabasePage[]): NotionAtlasTreeLookupMaps {
  const nodeMap = new Map<string, NotionAtlasTreeNode>();
  const originalPageMap = new Map<string, NotionDatabasePage>();
  const parentMap = new Map<string, string>();
  const childrenMap = new Map<string, string[]>();
  const processedIds = new Set<string>();

  // Create NotionAtlasTreeNode for each page and build relationship maps
  for (const page of allPages) {
    const treeNode: NotionAtlasTreeNode = {
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

  // Second pass: For internally nested databases (Agent Scope Database, Sections & Primary Docs),
  // also use parent_notion_page_id to build relationships. This handles cases where Notion's
  // bidirectional relations are not synced (e.g., when a page has "Parent item" set but the
  // parent's "Sub-item" is empty due to Notion API limitations).
  //
  // Related: sync-operations.ts (lines 214-218) intentionally skips updating parent child
  // relation properties during Markdown→Notion sync due to the same Notion API bug that
  // causes 500 errors. This second pass compensates by using parent_notion_page_id.
  //
  // We need to update BOTH childrenMap AND the parent page's child_*_ids array because
  // buildTreeNode uses page.child_agent_scope_ids directly.
  let addedFromParentNotionPageId = 0;
  for (const page of allPages) {
    if (page.parent_notion_page_id) {
      const isInternallyNestedDatabase =
        page.atlas_database_name === 'Sections & Primary Docs' || page.atlas_database_name === 'Agent Scope Database';

      if (isInternallyNestedDatabase) {
        const parentPage = originalPageMap.get(page.parent_notion_page_id);

        if (parentPage) {
          // Determine which child array to update based on the child's database
          let childArray: string[];
          if (page.atlas_database_name === 'Agent Scope Database') {
            childArray = parentPage.child_agent_scope_ids;
          } else {
            childArray = parentPage.child_section_and_primary_doc_ids;
          }

          if (!childArray.includes(page.notion_page_id)) {
            // Add this page to its parent's child array
            childArray.push(page.notion_page_id);

            // Also update childrenMap
            let parentChildIds = childrenMap.get(page.parent_notion_page_id);
            if (!parentChildIds) {
              parentChildIds = [];
              childrenMap.set(page.parent_notion_page_id, parentChildIds);
            }
            if (!parentChildIds.includes(page.notion_page_id)) {
              parentChildIds.push(page.notion_page_id);
            }

            // Also update parentMap
            parentMap.set(page.notion_page_id, page.parent_notion_page_id);
            addedFromParentNotionPageId++;
          }
        }
      }
    }
  }

  if (addedFromParentNotionPageId > 0) {
    console.log(`📊 Added ${addedFromParentNotionPageId} children from parent_notion_page_id`);
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
function findPageById(pageId: string, lookupMaps: NotionAtlasTreeLookupMaps): NotionDatabasePage | undefined {
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
function filterDirectChildren(
  descendantIds: string[],
  lookupMaps: NotionAtlasTreeLookupMaps,
  parentPageId?: string,
): string[] {
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

    // Same database (Sections & Primary Docs or Agent Scope Database):
    // For internally nested databases, if parent_notion_page_id is null, treat it as a direct child
    // (no internal parent within the database).
    const isInternallyNestedDatabase =
      childPage.atlas_database_name === 'Sections & Primary Docs' ||
      childPage.atlas_database_name === 'Agent Scope Database';

    if (isInternallyNestedDatabase && childPage.parent_notion_page_id === null) {
      // If parent ID is null, it's a direct child (no internal parent)
      return true;
    }

    // Standard case: Direct child if the child's immediate parent is the current parentPageId
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
 * @returns NotionAtlasTreeNode with all descendants embedded
 * @throws Error if circular reference is detected
 */
function buildTreeNode(
  page: NotionDatabasePage,
  lookupMaps: NotionAtlasTreeLookupMaps,
  depth: number,
  maxDepth: number,
  verbose: boolean,
  reportMissingChildNodes: boolean = false,
  parentPageId?: string,
  siblingPositioningMappingsByParent?: Map<string, NotionNestingBugMapping[]>,
  _isOrphanedNode: boolean = false,
): NotionAtlasTreeNode {
  const { nodeMapByPageId: nodeMap, processedIds, nodeToParentsMap } = lookupMaps;

  // Track parent-child relationship for duplicate detection
  if (parentPageId) {
    if (!nodeToParentsMap.has(page.notion_page_id)) {
      nodeToParentsMap.set(page.notion_page_id, new Set());
    }
    nodeToParentsMap.get(page.notion_page_id)!.add(parentPageId);
  }

  // Note: We no longer skip duplicate documents - they are allowed to exist in the tree
  // The duplicate tracking in nodeToParentsMap is still maintained for reporting purposes

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

    const childArrays: { array: string[]; type: NotionAtlasTreeNodeRelationship }[] = [
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
        const childNodes: NotionAtlasTreeNode[] = [];

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
        let sortedChildren = sortAtlasDocuments<NotionAtlasTreeNode>(childNodes);

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
  sortedChildren: NotionAtlasTreeNode[],
  parentPageId: string,
  siblingPositioningByParent: Map<string, NotionNestingBugMapping[]>,
  verbose: boolean,
): NotionAtlasTreeNode[] {
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
 * @param allPages - Flat array of all pages
 * @param lookupMaps - Lookup maps for efficient access
 * @param scopeTrees - Built scope trees to check against
 * @returns Array of orphaned NotionDatabasePage objects
 */
function findOrphanedNodes(
  allPages: NotionDatabasePage[],
  lookupMaps: NotionAtlasTreeLookupMaps,
  _scopeTrees: NotionAtlasTreeNode[],
): NotionDatabasePage[] {
  const { nodeMapByPageId: nodeMap, originalPageMap, processedIds } = lookupMaps;

  // Use processedIds Set which accurately tracks all nodes processed during tree building

  // Find orphaned nodes: any node that exists but wasn't processed
  const orphanedNodes: NotionDatabasePage[] = [];
  for (const [pageId] of nodeMap.entries()) {
    if (!processedIds.has(pageId)) {
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
  scopeTrees: NotionAtlasTreeNode[],
  orphanedNodesAsTreeNodes: NotionAtlasTreeNode[],
  uuidMappings: UuidMappings,
): NotionAtlasTreeUUIDToDocNoAndDocNameMaps {
  const atlasUUIDsToDocNumbers = new Map<string, string>();
  const atlasUUIDsToDocNames = new Map<string, string>();

  function processNode(node: NotionAtlasTreeNode) {
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
function generateDuplicatedNodeList(lookupMaps: NotionAtlasTreeLookupMaps): NotionAtlasTreeDuplicatedNodeEntry[] {
  const { nodeToParentsMap, nodeMapByPageId } = lookupMaps;
  const duplicatedNodes: NotionAtlasTreeDuplicatedNodeEntry[] = [];

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
