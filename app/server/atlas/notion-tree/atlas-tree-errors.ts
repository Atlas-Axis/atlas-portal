import { NotionDatabasePage, NotionDatabasePageRelationshipProperty } from '@/app/server/database/notion-database-page';
import { NotionAtlasTreeConstructionError, NotionAtlasTreeNode } from './atlas-tree-types';

/**
 * Comprehensive error handling and validation for Atlas tree construction.
 *
 * This module provides robust error detection and reporting for common issues
 * that can occur during tree construction, including circular references,
 * orphaned nodes, missing references, and data integrity problems.
 */

/**
 * Detects circular references in the Atlas document hierarchy.
 *
 * Circular references occur when a document references itself either directly
 * or through a chain of parent-child relationships, creating an infinite loop.
 *
 * @param pagesByDatabase - All pages organized by database
 * @returns Array of circular reference errors with detailed context
 *
 * @example
 * ```typescript
 * const circularErrors = detectCircularReferences(pagesByDatabase);
 * if (circularErrors.length > 0) {
 *   console.error('Circular references detected:', circularErrors);
 * }
 * ```
 */
export function detectCircularReferences(
  pagesByDatabase: Partial<Record<string, NotionDatabasePage[]>>,
): NotionAtlasTreeConstructionError[] {
  const errors: NotionAtlasTreeConstructionError[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  // Collect all pages
  const allPages: NotionDatabasePage[] = [];
  for (const pages of Object.values(pagesByDatabase)) {
    if (pages) {
      allPages.push(...pages);
    }
  }

  // Build parent-child relationships
  const childToParent = new Map<string, string>();
  const parentToChildren = new Map<string, string[]>();

  for (const page of allPages) {
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

    const children: string[] = [];
    for (const childArray of childArrays) {
      if (Array.isArray(childArray)) {
        for (const childId of childArray) {
          if (typeof childId === 'string') {
            children.push(childId);
            childToParent.set(childId, page.notion_page_id);
          }
        }
      } else {
        console.warn(`Warning: Malformed child array in page ${page.notion_page_id}`);
      }
    }
    parentToChildren.set(page.notion_page_id, children);
  }

  // DFS to detect cycles
  function dfs(nodeId: string, path: string[]): void {
    if (recursionStack.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      const cycle = path.slice(cycleStart).concat([nodeId]);
      errors.push({
        type: 'circular_reference',
        message: `Circular reference detected: ${cycle.join(' -> ')}`,
        pageId: nodeId,
        context: {
          cycle,
          fullPath: path,
          cycleStart,
        },
      });
      return;
    }

    if (visited.has(nodeId)) {
      return;
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);

    const children = parentToChildren.get(nodeId) || [];
    for (const childId of children) {
      dfs(childId, [...path, nodeId]);
    }

    recursionStack.delete(nodeId);
  }

  // Check all nodes for cycles
  for (const page of allPages) {
    if (!visited.has(page.notion_page_id)) {
      dfs(page.notion_page_id, []);
    }
  }

  return errors;
}

/**
 * Finds orphaned nodes that are not connected to any root tree.
 *
 * Orphaned nodes are documents that exist in the database but are not reachable
 * from any root Scope document through the parent-child relationships.
 *
 * @param pagesByDatabase - All pages organized by database
 * @param rootScopeIds - Array of root scope page IDs
 * @returns Array of orphaned page objects with detailed information
 *
 * @example
 * ```typescript
 * const orphanedNodes = findOrphanedNodes(pagesByDatabase, rootScopeIds);
 * if (orphanedNodes.length > 0) {
 *   console.warn(`Found ${orphanedNodes.length} orphaned nodes`);
 * }
 * ```
 */
export function findOrphanedNodes(
  pagesByDatabase: Partial<Record<string, NotionDatabasePage[]>>,
  rootScopeIds: string[],
): NotionDatabasePage[] {
  // Collect all pages
  const allPages: NotionDatabasePage[] = [];
  for (const pages of Object.values(pagesByDatabase)) {
    if (pages) {
      allPages.push(...pages);
    }
  }

  // Build parent-child relationships
  const parentToChildren = new Map<string, string[]>();
  for (const page of allPages) {
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

    const children: string[] = [];
    for (const childArray of childArrays) {
      if (Array.isArray(childArray)) {
        for (const childId of childArray) {
          if (typeof childId === 'string') {
            children.push(childId);
          }
        }
      }
    }
    parentToChildren.set(page.notion_page_id, children);
  }

  // Find all reachable nodes from root scopes
  const reachableIds = new Set<string>();

  function collectReachable(nodeId: string): void {
    if (reachableIds.has(nodeId)) {
      return;
    }

    reachableIds.add(nodeId);
    const children = parentToChildren.get(nodeId) || [];
    for (const childId of children) {
      collectReachable(childId);
    }
  }

  // Start from all root scopes
  for (const rootId of rootScopeIds) {
    collectReachable(rootId);
  }

  // Find orphaned nodes
  const orphanedNodes: NotionDatabasePage[] = [];
  for (const page of allPages) {
    if (!reachableIds.has(page.notion_page_id)) {
      orphanedNodes.push(page);
    }
  }

  return orphanedNodes;
}

/**
 * Detects missing child documents referenced in ID arrays.
 *
 * This function checks if all child IDs referenced in the child_* arrays
 * actually exist in the database, logging errors for missing references.
 *
 * @param pagesByDatabase - All pages organized by database
 * @returns Array of missing child errors
 *
 * @example
 * ```typescript
 * const missingChildErrors = detectMissingChildren(pagesByDatabase);
 * if (missingChildErrors.length > 0) {
 *   console.error('Missing child references:', missingChildErrors);
 * }
 * ```
 */
export function detectMissingChildren(
  pagesByDatabase: Partial<Record<string, NotionDatabasePage[]>>,
): NotionAtlasTreeConstructionError[] {
  const errors: NotionAtlasTreeConstructionError[] = [];

  // Create a set of all existing page IDs
  const existingIds = new Set<string>();
  for (const pages of Object.values(pagesByDatabase)) {
    if (pages) {
      for (const page of pages) {
        existingIds.add(page.notion_page_id);
      }
    }
  }

  // Check all child references
  for (const pages of Object.values(pagesByDatabase)) {
    if (pages) {
      for (const page of pages) {
        const childArrays: { array: string[]; type: NotionDatabasePageRelationshipProperty }[] = [
          { array: page.child_scope_ids, type: 'child_scope_ids' },
          { array: page.child_article_ids, type: 'child_article_ids' },
          { array: page.child_section_and_primary_doc_ids, type: 'child_section_and_primary_doc_ids' },
          { array: page.child_annotation_ids, type: 'child_annotation_ids' },
          { array: page.child_tenet_ids, type: 'child_tenet_ids' },
          { array: page.child_scenario_ids, type: 'child_scenario_ids' },
          { array: page.child_scenario_variation_ids, type: 'child_scenario_variation_ids' },
          { array: page.child_active_data_ids, type: 'child_active_data_ids' },
          { array: page.child_agent_scope_ids, type: 'child_agent_scope_ids' },
          { array: page.child_needed_research_ids, type: 'child_needed_research_ids' },
        ];

        for (const { array, type } of childArrays) {
          if (Array.isArray(array)) {
            for (const childId of array) {
              if (typeof childId === 'string' && !existingIds.has(childId)) {
                errors.push({
                  type: 'missing_child',
                  message: `Missing child document referenced in ${type}: ${childId}`,
                  pageId: page.notion_page_id,
                  context: {
                    missingChildId: childId,
                    parentPageName: page.plain_text_name,
                    relationshipType: type,
                  },
                });
              }
            }
          }
        }
      }
    }
  }

  return errors;
}

/**
 * Validates the integrity of the Atlas tree structure.
 *
 * This function performs comprehensive validation checks on the tree structure,
 * including circular reference detection, orphaned node detection, and data integrity checks.
 *
 * @param scopeTrees - Array of root scope trees
 * @param orphanedNodes - Array of orphaned nodes
 * @param pagesByDatabase - All pages organized by database
 * @returns Array of validation errors
 *
 * @example
 * ```typescript
 * const result = buildNotionAtlasTree(atlasData);
 * const validationErrors = validateTreeIntegrity(
 *   result.scopeTrees,
 *   result.orphanedNodes,
 *   atlasData
 * );
 *
 * if (validationErrors.length > 0) {
 *   console.error('Tree validation failed:', validationErrors);
 * }
 * ```
 */
export function validateTreeIntegrity(
  scopeTrees: NotionAtlasTreeNode[],
  orphanedNodes: NotionDatabasePage[],
  pagesByDatabase: Partial<Record<string, NotionDatabasePage[]>>,
): NotionAtlasTreeConstructionError[] {
  const errors: NotionAtlasTreeConstructionError[] = [];

  // Check for circular references
  const circularErrors = detectCircularReferences(pagesByDatabase);
  errors.push(...circularErrors);

  // Check for missing children
  const missingChildErrors = detectMissingChildren(pagesByDatabase);
  errors.push(...missingChildErrors);

  // Validate tree structure
  for (const scopeTree of scopeTrees) {
    const treeErrors = validateTreeNode(scopeTree);
    errors.push(...treeErrors);
  }

  // Check for orphaned nodes
  if (orphanedNodes.length > 0) {
    for (const orphanedNode of orphanedNodes) {
      errors.push({
        type: 'orphaned_node',
        message: `Orphaned node not connected to any root tree: ${orphanedNode.plain_text_name}`,
        pageId: orphanedNode.notion_page_id,
        context: {
          orphanedNodeName: orphanedNode.plain_text_name,
          orphanedNodeType: orphanedNode.atlas_document_type,
          orphanedNodeDatabase: orphanedNode.atlas_database_name,
        },
      });
    }
  }

  return errors;
}

/**
 * Validates a single tree node and its descendants.
 *
 * @param node - The tree node to validate
 * @returns Array of validation errors for this node
 */
function validateTreeNode(node: NotionAtlasTreeNode): NotionAtlasTreeConstructionError[] {
  const errors: NotionAtlasTreeConstructionError[] = [];

  // Check for required fields
  if (!node.notion_page_id) {
    errors.push({
      type: 'orphaned_node',
      message: 'Tree node missing notion_page_id',
      pageId: node.notion_page_id || 'unknown',
      context: { nodeName: node.plain_text_name },
    });
  }

  if (!node.atlas_document_type) {
    errors.push({
      type: 'orphaned_node',
      message: 'Tree node missing atlas_document_type',
      pageId: node.notion_page_id,
      context: { nodeName: node.plain_text_name },
    });
  }

  // Check for duplicate IDs in children
  const allChildren = [
    ...node.scopes,
    ...node.articles,
    ...node.sectionsAndPrimaryDocs,
    ...node.annotations,
    ...node.tenets,
    ...node.scenarios,
    ...node.scenarioVariations,
    ...node.activeData,
    ...node.agentScopeDocs,
    ...node.neededResearch,
  ];

  const childIds = new Set<string>();
  for (const child of allChildren) {
    if (childIds.has(child.notion_page_id)) {
      errors.push({
        type: 'orphaned_node',
        message: `Duplicate child ID in tree: ${child.notion_page_id}`,
        pageId: node.notion_page_id,
        context: {
          parentName: node.plain_text_name,
          duplicateChildId: child.notion_page_id,
          duplicateChildName: child.plain_text_name,
        },
      });
    }
    childIds.add(child.notion_page_id);

    // Recursively validate children
    const childErrors = validateTreeNode(child);
    errors.push(...childErrors);
  }

  return errors;
}

/**
 * Logs validation errors in a human-readable format.
 *
 * @param errors - Array of validation errors to log
 * @param verbose - Whether to include detailed context information
 * @param reportMissingChildNodes - Whether to report missing_child errors (false by default since they're often expected due to NOTION_DATABASE_FILTERS)
 * @param reportOrphanedNodes - Whether to report orphaned_node errors in detail (false by default, only shows count in summary)
 */
export function logValidationErrors(
  errors: NotionAtlasTreeConstructionError[],
  verbose: boolean = false,
  reportMissingChildNodes: boolean = false,
  reportOrphanedNodes: boolean = false,
): void {
  // Filter out missing_child and orphaned_node errors based on flags
  let filteredErrors = reportMissingChildNodes ? errors : errors.filter((error) => error.type !== 'missing_child');
  filteredErrors = reportOrphanedNodes
    ? filteredErrors
    : filteredErrors.filter((error) => error.type !== 'orphaned_node');

  if (filteredErrors.length === 0) {
    const missingChildCount = !reportMissingChildNodes
      ? errors.filter((error) => error.type === 'missing_child').length
      : 0;
    const orphanedNodeCount = !reportOrphanedNodes
      ? errors.filter((error) => error.type === 'orphaned_node').length
      : 0;

    const silencedMessages: string[] = [];
    if (missingChildCount > 0) {
      silencedMessages.push(`${missingChildCount} missing_child errors silenced`);
    }
    if (orphanedNodeCount > 0) {
      silencedMessages.push(`${orphanedNodeCount} orphaned_node errors silenced`);
    }

    if (silencedMessages.length > 0) {
      console.log(`✅ No validation errors found (${silencedMessages.join(', ')})`);
    } else {
      console.log('✅ No validation errors found');
    }
    return;
  }

  const missingChildSilenced = !reportMissingChildNodes
    ? errors.filter((error) => error.type === 'missing_child').length
    : 0;
  const orphanedNodeSilenced = !reportOrphanedNodes
    ? errors.filter((error) => error.type === 'orphaned_node').length
    : 0;

  const silencedMessages: string[] = [];
  if (missingChildSilenced > 0) {
    silencedMessages.push(`${missingChildSilenced} missing_child errors silenced`);
  }
  if (orphanedNodeSilenced > 0) {
    silencedMessages.push(`${orphanedNodeSilenced} orphaned_node errors silenced`);
  }

  const silencedMessage = silencedMessages.length > 0 ? ` (${silencedMessages.join(', ')})` : '';
  console.error(`❌ Found ${filteredErrors.length} validation errors${silencedMessage}:`);

  for (const error of filteredErrors) {
    console.error(`\n🔍 ${error.type.toUpperCase()}: ${error.message}`);
    console.error(`   Page ID: ${error.pageId}`);
    // Link to Notion page if possible: https://www.notion.so/<page-id-without-dashes>
    console.error(`   https://www.notion.so/${error.pageId.replace(/-/g, '')}`);

    if (verbose && error.context) {
      console.error(`   Context:`, error.context);
    }
  }
}

/**
 * Creates a summary report of validation results.
 *
 * @param errors - Array of validation errors
 * @param reportMissingChildNodes - Whether to count missing_child errors as critical (false by default since they're often expected due to NOTION_DATABASE_FILTERS)
 * @param reportOrphanedNodes - Whether to count orphaned_node errors as critical (false by default, only shows count in summary)
 * @returns Summary report object
 */
export function createValidationSummary(
  errors: NotionAtlasTreeConstructionError[],
  reportMissingChildNodes: boolean = false,
  reportOrphanedNodes: boolean = false,
): {
  totalErrors: number;
  errorTypes: Record<string, number>;
  criticalErrors: number;
  warnings: number;
} {
  const errorTypes: Record<string, number> = {};
  let criticalErrors = 0;
  let warnings = 0;

  for (const error of errors) {
    errorTypes[error.type] = (errorTypes[error.type] || 0) + 1;

    if (
      error.type === 'circular_reference' ||
      (error.type === 'missing_child' && reportMissingChildNodes) ||
      (error.type === 'orphaned_node' && reportOrphanedNodes)
    ) {
      criticalErrors++;
    } else {
      warnings++;
    }
  }

  return {
    totalErrors: errors.length,
    errorTypes,
    criticalErrors,
    warnings,
  };
}
