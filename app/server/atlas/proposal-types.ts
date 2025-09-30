/**
 * Type definitions for Atlas proposal generation
 */
import { TreeChange } from '@/app/server/diff/diff-trees';
import { TreeNode, TreeNodeMap } from '@/app/server/diff/tree';

export interface ProposalContext {
  originalNodeMap: TreeNodeMap;
  duplicateNodeMap: TreeNodeMap;
  originalRoot: TreeNode;
  duplicateRoot: TreeNode;
  originalContentMap: Map<string, string | null>;
  duplicateContentMap: Map<string, string | null>;
}

export interface GroupedChanges {
  additions: TreeChange[];
  deletions: TreeChange[];
  replacements: TreeChange[]; // edited changes
  moves: TreeChange[];
}

export interface ProposalOptions {
  includeSubtree?: boolean; // Whether to include unchanged children in subtree operations
  maxSubtreeDepth?: number | undefined; // Maximum depth for subtree inclusion (undefined = no limit)
  groupingStrategy?: 'none' | 'hierarchy' | 'type'; // Future: how to group changes logically
}

export interface DocumentReference {
  portalTitle: string;
  githubTitle: string;
  canonicalTitle: string;
}

export interface FormattedChange {
  type: 'add' | 'delete' | 'replace' | 'move';
  documentRef: DocumentReference;
  content?: string;
  position?: string; // "directly after X" or "directly before Y"
  targetParentRef?: DocumentReference; // For moves and additions
  children?: FormattedChange[]; // For subtree operations
}
