/**
 * Main entry point for the Atlas tree-based document numbering system.
 *
 * This module provides a high-level API for building Atlas document trees
 * and assigning document numbers using the new tree-based approach.
 * It replaces the previous sequential document numbering system with a more
 * efficient and robust tree traversal approach.
 *
 * @example
 * ```typescript
 * import { buildAtlasTree } from './atlas-tree-system';
 * import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/atlas/load-atlas-from-supabase';
 * import { loadUuidMappings } from '@/app/server/atlas/load-uuid-mapping';
 *
 * // Load Atlas data
 * const atlasData = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();
 * const uuidMappings = await loadUuidMappings();
 *
 * // Build tree structure with document numbering
 * const result = await buildAtlasTree(atlasData, { uuidMappings });
 *
 * // Access the tree structure
 * console.log(`Built ${result.scopeTrees.length} scope trees`);
 * console.log(`Found ${result.orphanedNodes.length} orphaned nodes`);
 *
 * // Access document numbers
 * const docNumbers = new Map<string, string>();
 * for (const scopeTree of result.scopeTrees) {
 *   collectDocumentNumbers(scopeTree, docNumbers);
 * }
 *
 * console.log('Document numbers:', docNumbers);
 * ```
 */
import { findNodeByDocumentID, preOrderTraversal } from './atlas-tree-traversal';
import { AtlasTreeNode } from './atlas-tree-types';

/**
 * Collects all document numbers from a tree structure.
 *
 * @param root - The root node to start collection from
 * @param docNumbers - Map to store the collected document numbers
 */
export function collectDocumentNumbers(root: AtlasTreeNode, docNumbers: Map<string, string>): void {
  preOrderTraversal(root, (node) => {
    if (node.generatedDocID) {
      docNumbers.set(node.notion_page_id, node.generatedDocID);
    }
    return true; // Continue traversal
  });
}

/**
 * Finds a document by its generated document ID across all scope trees.
 *
 * @param scopeTrees - Array of root scope trees to search
 * @param generatedDocID - The document ID to find
 * @returns The found node or undefined if not found
 *
 * @example
 * ```typescript
 * const node = findDocumentByID(result.scopeTrees, 'A.1.2.3');
 * if (node) {
 *   console.log(`Found: ${node.plain_text_name} (${node.generatedDocID})`);
 * }
 * ```
 */
export function findDocumentByID(scopeTrees: AtlasTreeNode[], generatedDocID: string): AtlasTreeNode | undefined {
  for (const scopeTree of scopeTrees) {
    const found = findNodeByDocumentID(scopeTree, generatedDocID);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/**
 * Gets comprehensive statistics about the Atlas tree structure.
 *
 * @param scopeTrees - Array of root scope trees to analyze
 * @returns Statistics object with detailed information
 *
 * @example
 * ```typescript
 * const stats = getAtlasTreeStatistics(result.scopeTrees);
 * console.log(`Total nodes: ${stats.totalNodes}`);
 * console.log(`Document types: ${Object.keys(stats.documentTypeCounts).join(', ')}`);
 * ```
 */
export function getAtlasTreeStatistics(scopeTrees: AtlasTreeNode[]): {
  totalNodes: number;
  scopeCount: number;
  documentTypeCounts: Record<string, number>;
  maxDepth: number;
  averageDepth: number;
} {
  let totalNodes = 0;
  let maxDepth = 0;
  let totalDepth = 0;
  const documentTypeCounts: Record<string, number> = {};

  for (const scopeTree of scopeTrees) {
    const scopeStats = analyzeTreeStructure(scopeTree);
    totalNodes += scopeStats.totalNodes;
    maxDepth = Math.max(maxDepth, scopeStats.maxDepth);
    totalDepth += scopeStats.totalDepth;

    // Merge document type counts
    for (const [type, count] of Object.entries(scopeStats.documentTypeCounts)) {
      documentTypeCounts[type] = (documentTypeCounts[type] || 0) + count;
    }
  }

  return {
    totalNodes,
    scopeCount: scopeTrees.length,
    documentTypeCounts,
    maxDepth,
    averageDepth: totalNodes > 0 ? totalDepth / totalNodes : 0,
  };
}

/**
 * Analyzes the structure of a single tree.
 *
 * @param root - The root node to analyze
 * @returns Analysis results for this tree
 */
function analyzeTreeStructure(root: AtlasTreeNode): {
  totalNodes: number;
  maxDepth: number;
  totalDepth: number;
  documentTypeCounts: Record<string, number>;
} {
  let totalNodes = 0;
  let maxDepth = 0;
  let totalDepth = 0;
  const documentTypeCounts: Record<string, number> = {};

  preOrderTraversal(root, (node, depth) => {
    totalNodes++;
    maxDepth = Math.max(maxDepth, depth);
    totalDepth += depth;

    const type = node.atlas_document_type;
    documentTypeCounts[type] = (documentTypeCounts[type] || 0) + 1;

    return true; // Continue traversal
  });

  return {
    totalNodes,
    maxDepth,
    totalDepth,
    documentTypeCounts,
  };
}

/**
 * Validates that all document numbers are unique and follow correct patterns.
 *
 * @param scopeTrees - Array of root scope trees to validate
 * @returns Array of validation errors, empty if all numbers are valid
 *
 * @example
 * ```typescript
 * const errors = validateDocumentNumbers(result.scopeTrees);
 * if (errors.length > 0) {
 *   console.error('Document number validation failed:', errors);
 * }
 * ```
 */
export function validateDocumentNumbers(scopeTrees: AtlasTreeNode[]): string[] {
  const errors: string[] = [];
  const docNumbers = new Map<string, string>();
  const numberSet = new Set<string>();

  // Collect all document numbers
  for (const scopeTree of scopeTrees) {
    collectDocumentNumbers(scopeTree, docNumbers);
  }

  // Validate uniqueness and format
  for (const [pageId, docNumber] of docNumbers.entries()) {
    if (numberSet.has(docNumber)) {
      errors.push(`Duplicate document number: ${docNumber} for page ${pageId}`);
    }
    numberSet.add(docNumber);

    if (!isValidDocumentNumber(docNumber)) {
      errors.push(`Invalid document number format: ${docNumber} for page ${pageId}`);
    }
  }

  return errors;
}

/**
 * Valid Atlas document number patterns based on Atlas Document Numbering Rules.
 */
export const documentNumberPatterns = [
  /^A\.\d+$/, // Scopes: A.0, A.1, A.2, ...
  /^A\.\d+\.\d+$/, // Articles: A.0.1, A.0.2, ...
  /^A\.\d+\.\d+\.\d+$/, // Sections: A.0.1.1, A.0.1.2, ...
  /^A\.\d+\.\d+\.0\.3\.\d+$/, // Annotations: A.0.1.0.3.1, A.0.1.0.3.2, ...
  /^A\.\d+\.\d+\.0\.4\.\d+$/, // Tenets: A.0.1.0.4.1, A.0.1.0.4.2, ...
  /^A\.\d+\.\d+\.0\.4\.\d+\.1\.\d+$/, // Scenarios: A.0.1.0.4.1.1, A.0.1.0.4.1.2, ...
  /^A\.\d+\.\d+\.0\.4\.\d+\.1\.\d+\.var\d+$/, // Variations: A.0.1.0.4.1.1.var1, A.0.1.0.4.1.1.var2, ...
  /^A\.\d+\.\d+\.0\.6\.\d+$/, // Active Data: A.0.1.0.6.1, A.0.1.0.6.2, ...
  /^NR-\d+$/, // Needed Research: NR-1, NR-2, ...
];

/**
 * Checks if an Atlas document number follows the correct format.
 *
 * @param docNumber - The document number to validate
 * @returns True if the number format is valid
 */
export function isValidDocumentNumber(docNumber: string): boolean {
  // Valid patterns based on Atlas Document Numbering Rules

  return documentNumberPatterns.some((pattern) => pattern.test(docNumber));
}

// Re-export all the core functions for convenience
export { buildAtlasTree } from './atlas-tree-builder';
export { assignDocumentNumbersToTreesRecursively } from './atlas-tree-numbering';
export {
  preOrderTraversal,
  postOrderTraversal,
  levelOrderTraversal,
  findNodeByDocumentID,
  getNodeCount,
  validateTree,
} from './atlas-tree-traversal';
export { validateTreeIntegrity, logValidationErrors, createValidationSummary } from './atlas-tree-errors';
export type { AtlasTreeNode, AtlasTreeResult, TreeConstructionOptions } from './atlas-tree-types';
