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
 * ```
 */

/**
 * Valid Atlas document number patterns based on Atlas Document Numbering Rules.
 * Used internally by isValidDocumentNumber.
 */
const documentNumberPatterns = [
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
 * Used by atlas-tree-traversal for validation.
 *
 * @param docNumber - The document number to validate
 * @returns True if the number format is valid
 */
export function isValidDocumentNumber(docNumber: string): boolean {
  return documentNumberPatterns.some((pattern) => pattern.test(docNumber));
}

// Re-export core functions and types
export { buildAtlasTree } from './atlas-tree-builder';
export { assignDocumentNumbersToTreesRecursively } from './atlas-tree-numbering';
export { preOrderTraversal, findNodeByDocumentID, getNodeCount } from './atlas-tree-traversal';
export type { AtlasTreeNode, AtlasTreeResult, TreeConstructionOptions } from './atlas-tree-types';
