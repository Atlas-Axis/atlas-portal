/**
 * Public API barrel module for the Notion Atlas Tree system (Internal Atlas Representation).
 *
 * This module provides a stable import point for external consumers of the Notion Atlas Tree system.
 * It re-exports all public functions and types from the underlying implementation files.
 *
 * IMPORT POLICY:
 * - EXTERNAL files (outside tree/) MUST import from this module
 * - INTERNAL files (within tree/) MUST import directly from source files to avoid circular dependencies
 *
 * NOTE: This exports the Notion Tree types (Internal Atlas Representation). For external consumption
 * (JSON/Markdown export, APIs), use the Export Tree types from '@/app/server/atlas/export/types' instead.
 */

// Re-export core functions and types
export { buildNotionAtlasTree } from './atlas-tree-builder';
export { updateMentionInRichTextArray, updateRichTextMentionsInTree } from './atlas-tree-mentions';
export { assignDocumentNumbersToTreesRecursively, isValidDocumentNumber } from './atlas-tree-numbering';
export { preOrderTraversal, findNodeByDocumentID, getNodeCount } from './atlas-tree-traversal';
export type {
  NotionAtlasTreeNode,
  NotionAtlasTreeResult,
  NotionAtlasTreeConstructionOptions,
} from './atlas-tree-types';
