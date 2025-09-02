/**
 * Main Atlas proposal generator
 * Converts TreeChange[] to formatted Atlas proposal markdown
 */
import { TreeChange } from '../../diff/diff-trees';
import { TreeNode } from '../../diff/tree';
import { calculateRelativePosition, formatChangeEntry, formatDocumentReference } from './proposal-formatter';
import { FormattedChange, GroupedChanges, ProposalContext, ProposalOptions } from './proposal-types';

/**
 * Main function to convert TreeChange[] to Atlas proposal markdown
 */
export function convertTreeChangesToAtlasProposal(
  changes: TreeChange[],
  context: ProposalContext,
  options: ProposalOptions = {},
): string {
  // Set default options
  const opts = {
    includeSubtree: options.includeSubtree ?? true,
    maxSubtreeDepth: options.maxSubtreeDepth,
    groupingStrategy: options.groupingStrategy ?? ('none' as const),
  };

  // Group changes by type
  const groupedChanges = groupChangesByType(changes);

  // Convert to formatted changes
  const formattedChanges = convertToFormattedChanges(groupedChanges, context, opts);

  // Generate markdown
  return generateProposalMarkdown(formattedChanges, opts);
}

type ProcessedOptions = {
  includeSubtree: boolean;
  maxSubtreeDepth: number | undefined;
  groupingStrategy: 'none' | 'hierarchy' | 'type';
};

/**
 * Group changes by their type (add, delete, edit, move)
 */
function groupChangesByType(changes: TreeChange[]): GroupedChanges {
  const grouped: GroupedChanges = {
    additions: [],
    deletions: [],
    replacements: [],
    moves: [],
  };

  changes.forEach((change) => {
    switch (change.type) {
      case 'added':
        grouped.additions.push(change);
        break;
      case 'deleted':
        grouped.deletions.push(change);
        break;
      case 'edited':
        grouped.replacements.push(change);
        break;
      case 'moved':
        grouped.moves.push(change);
        break;
    }
  });

  return grouped;
}

/**
 * Convert grouped changes to formatted changes with all necessary information
 */
function convertToFormattedChanges(
  grouped: GroupedChanges,
  context: ProposalContext,
  options: ProcessedOptions,
): FormattedChange[] {
  const formatted: FormattedChange[] = [];

  // Process additions
  grouped.additions.forEach((change) => {
    const formattedChange = processAddition(change, context, options);
    if (formattedChange) formatted.push(formattedChange);
  });

  // Process deletions
  grouped.deletions.forEach((change) => {
    const formattedChange = processDeletion(change, context, options);
    if (formattedChange) formatted.push(formattedChange);
  });

  // Process replacements (edits)
  grouped.replacements.forEach((change) => {
    const formattedChange = processReplacement(change, context, options);
    if (formattedChange) formatted.push(formattedChange);
  });

  // Process moves
  grouped.moves.forEach((change) => {
    const formattedChange = processMove(change, context, options);
    if (formattedChange) formatted.push(formattedChange);
  });

  return formatted;
}

/**
 * Process an addition change
 */
function processAddition(
  change: TreeChange,
  context: ProposalContext,
  options: ProcessedOptions,
): FormattedChange | null {
  if (change.type !== 'added') return null;

  const documentRef = formatDocumentReference(change.canonicalDocumentTitle);

  // Find parent for context
  let targetParentRef: FormattedChange['targetParentRef'] = undefined;
  let position: string | undefined = undefined;

  if (change.parentId) {
    const parentNode = context.duplicateNodeMap.get(change.parentId);
    if (parentNode?.canonicalDocumentTitle) {
      targetParentRef = formatDocumentReference(parentNode.canonicalDocumentTitle);

      // Calculate relative position among siblings
      const siblings = parentNode.children || [];
      position = calculateRelativePosition(change.node, siblings) || undefined;
    }
  }

  // Get content
  const content = change.content;

  // Include subtree if requested
  const children = options.includeSubtree ? getSubtreeChanges(change.node, context, options, 1) : undefined;

  return {
    type: 'add',
    documentRef,
    content: content || undefined,
    position,
    targetParentRef,
    children,
  };
}

/**
 * Process a deletion change
 */
function processDeletion(
  change: TreeChange,
  context: ProposalContext,
  options: ProcessedOptions,
): FormattedChange | null {
  if (change.type !== 'deleted') return null;

  const documentRef = formatDocumentReference(change.canonicalDocumentTitle);

  // Include subtree if requested
  const children = options.includeSubtree ? getSubtreeChanges(change.node, context, options, 1) : undefined;

  return {
    type: 'delete',
    documentRef,
    children,
  };
}

/**
 * Process a replacement (edit) change
 */
function processReplacement(
  change: TreeChange,
  context: ProposalContext,
  options: ProcessedOptions,
): FormattedChange | null {
  if (change.type !== 'edited') return null;

  const documentRef = formatDocumentReference(change.canonicalDocumentTitle);

  // Use new content from the edit
  const content = change.changes.newContent;

  // Include subtree if requested
  const children = options.includeSubtree ? getSubtreeChanges(change.node, context, options, 1) : undefined;

  return {
    type: 'replace',
    documentRef,
    content: content || undefined,
    children,
  };
}

/**
 * Process a move change
 */
function processMove(change: TreeChange, context: ProposalContext, options: ProcessedOptions): FormattedChange | null {
  if (change.type !== 'moved') return null;

  const documentRef = formatDocumentReference(change.canonicalDocumentTitle);

  // Find new parent
  let targetParentRef: FormattedChange['targetParentRef'] = undefined;
  let position: string | undefined = undefined;

  if (change.changes.newParentId) {
    const newParentNode = context.duplicateNodeMap.get(change.changes.newParentId);
    if (newParentNode?.canonicalDocumentTitle) {
      targetParentRef = formatDocumentReference(newParentNode.canonicalDocumentTitle);

      // Calculate relative position among new siblings
      const newSiblings = newParentNode.children || [];
      position = calculateRelativePosition(change.node, newSiblings) || undefined;
    }
  }

  // Include subtree if requested
  const children = options.includeSubtree ? getSubtreeChanges(change.node, context, options, 1) : undefined;

  return {
    type: 'move',
    documentRef,
    position,
    targetParentRef,
    children,
  };
}

/**
 * Get subtree changes for a node (unchanged children to include in proposals)
 */
function getSubtreeChanges(
  node: TreeNode,
  context: ProposalContext,
  options: ProcessedOptions,
  currentDepth: number,
): FormattedChange[] | undefined {
  // Check depth limit
  if (options.maxSubtreeDepth !== undefined && currentDepth > options.maxSubtreeDepth) {
    return undefined;
  }

  const children = node.children || [];
  if (children.length === 0) return undefined;

  const subtreeChanges: FormattedChange[] = [];

  children.forEach((child) => {
    if (!child.canonicalDocumentTitle) return;

    const documentRef = formatDocumentReference(child.canonicalDocumentTitle);
    const content = context.duplicateContentMap.get(child.id);

    // Recursively get children if within depth limit
    const grandchildren = getSubtreeChanges(child, context, options, currentDepth + 1);

    subtreeChanges.push({
      type: 'add', // Subtree items are treated as additions to show structure
      documentRef,
      content: content || undefined,
      children: grandchildren,
    });
  });

  return subtreeChanges.length > 0 ? subtreeChanges : undefined;
}

/**
 * Generate the final markdown from formatted changes
 */
function generateProposalMarkdown(changes: FormattedChange[], options: ProcessedOptions): string {
  // Suppress lint warning for future implementation
  void options;

  if (changes.length === 0) {
    return 'No changes detected.';
  }

  const lines: string[] = [];

  // TODO: Implement logical grouping based on options.groupingStrategy
  // For now, just process all changes in order

  changes.forEach((change) => {
    const entry = formatChangeEntry(change);
    lines.push(entry);

    // Add spacing between entries for readability
    lines.push('');
  });

  // Remove trailing empty line
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  return lines.join('\n');
}
