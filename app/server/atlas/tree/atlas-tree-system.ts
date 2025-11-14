/**
 * Public API barrel module for the Atlas tree system.
 *
 * This module provides a stable import point for external consumers of the Atlas tree system.
 * It re-exports all public functions and types from the underlying implementation files.
 *
 * IMPORT POLICY:
 * - EXTERNAL files (outside tree/) MUST import from this module
 * - INTERNAL files (within tree/) MUST import directly from source files to avoid circular dependencies
 */

// Re-export core functions and types
export { buildAtlasTree } from './atlas-tree-builder';
export { updateMentionInRichTextArray, updateRichTextMentionsInTree } from './atlas-tree-mentions';
export { assignDocumentNumbersToTreesRecursively, isValidDocumentNumber } from './atlas-tree-numbering';
export { preOrderTraversal, findNodeByDocumentID, getNodeCount } from './atlas-tree-traversal';
export type { AtlasTreeNode, AtlasTreeResult, TreeConstructionOptions } from './atlas-tree-types';
