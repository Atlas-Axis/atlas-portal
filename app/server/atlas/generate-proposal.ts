/**
 * Main Atlas proposal generator
 * Converts TreeChange[] to formatted Atlas proposal markdown
 */
import { diffWords } from 'diff';
import { TreeChange } from '@/app/server/diff/diff-trees';
import { TreeNode } from '@/app/server/diff/tree';
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

  // Include subtree if requested (for additions we source from duplicate side)
  const children = options.includeSubtree
    ? getSubtreeChanges(change.node, context, options, 1, 'duplicate')
    : undefined;

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

  // Fetch top-level content from original side
  const content = context.originalContentMap.get(change.node.id) || undefined;

  // Include subtree if requested (for deletions we source from original side)
  const children = options.includeSubtree ? getSubtreeChanges(change.node, context, options, 1, 'original') : undefined;

  return {
    type: 'delete',
    documentRef,
    content,
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

  // Generate inline diff showing changes
  const content = generateInlineDiffText(change.changes.oldContent || '', change.changes.newContent || '');

  // Include subtree if requested (for replacements, show structure from duplicate side)
  const children = options.includeSubtree
    ? getSubtreeChanges(change.node, context, options, 1, 'duplicate')
    : undefined;

  return {
    type: 'replace',
    documentRef,
    content: content || undefined,
    children,
  };
}

/**
 * Generate inline diff text with markdown formatting for added/removed content
 */
function generateInlineDiffText(oldContent: string, newContent: string): string {
  const diff = diffWords(oldContent, newContent);

  const parts: string[] = [];

  diff.forEach((part, index) => {
    // If the first character was a space, and this is added/removed text, add a trailing space, because we will remove it
    if (part.value.trim().startsWith(' ') && (part.added || part.removed)) {
      parts.push(' ');
    }

    if (part.added) {
      // Added text with bold/underline formatting for emphasis
      parts.push(`**${part.value.trim()}**`);
    } else if (part.removed) {
      // Red text with strikethrough for deletions (using markdown strikethrough)
      parts.push(`~~${part.value.trim()}~~`);

      // Add a space after removed text if the next part is added text
      const nextPart = diff[index + 1];
      if (nextPart && nextPart.added) {
        console.log('Adding space after removed text before added text', {
          removed: part.value,
          added: nextPart.value,
        });
        parts.push(' ');
      }
    } else {
      // Unchanged text
      parts.push(part.value);
    }

    // If the last character was a space, and this is added/removed text, add a trailing space, because we removed it
    // We trimmed the added/removed text, otherwise Notion won't understand the formatting operators
    if (part.value.trim().endsWith(' ') && (part.added || part.removed)) {
      parts.push(' ');
    }
  });

  return parts.join('');
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

  // Include subtree if requested (structure from duplicate side)
  const children = options.includeSubtree
    ? getSubtreeChanges(change.node, context, options, 1, 'duplicate')
    : undefined;

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
  contentSide: 'original' | 'duplicate',
): FormattedChange[] | undefined {
  // Check depth limit
  if (options.maxSubtreeDepth !== undefined && currentDepth > options.maxSubtreeDepth) {
    return undefined;
  }

  const children = node.children || [];
  if (children.length === 0) return undefined;

  const subtreeChanges: FormattedChange[] = [];

  children.forEach((child) => {
    const canonical = child.canonicalDocumentTitle || '[Untitled Document]';
    const documentRef = formatDocumentReference(canonical);
    const content =
      contentSide === 'original' ? context.originalContentMap.get(child.id) : context.duplicateContentMap.get(child.id);

    // Recursively get children if within depth limit
    const grandchildren = getSubtreeChanges(child, context, options, currentDepth + 1, contentSide);

    subtreeChanges.push({
      type: 'add', // Represent structure uniformly in subtree listing
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

  // Helpers to render nested subtree as bullets under the main bullet format
  function renderSubtree(children: FormattedChange[] | undefined, indent: string): string[] {
    if (!children || children.length === 0) return [];
    const out: string[] = [];
    children.forEach((child) => {
      // Title line
      out.push(`${indent}- **${child.documentRef.canonicalTitle}**`);
      // Content line (truly blank allowed) - use 4 spaces for paragraph under bullet
      out.push(`${indent}    ${child.content ? child.content : ''}`);
      // Recurse deeper with increased indent
      out.push(...renderSubtree(child.children, indent + '  '));
    });
    return out;
  }

  changes.forEach((change) => {
    const entry = formatChangeEntry(change);
    lines.push(entry);

    // Append nested subtree for ADDED and DELETED only, preserving bullet formatting
    if (change.type === 'add') {
      // formatChangeEntry already includes the top-level doc as an indented bullet (4 spaces)
      // Render only the children beneath it with 8-space indent
      const subtree = renderSubtree(change.children, '        ');
      if (subtree.length > 0) {
        lines.push(...subtree);
      }
    } else if (change.type === 'delete') {
      // For deletions, add a new indented bullet for the top-level doc, then its subtree
      const topTitle = `    - **${change.documentRef.canonicalTitle}**`;
      const topContent = `      ${change.content ? change.content : ''}`;
      lines.push(topTitle);
      lines.push(topContent);
      const subtree = renderSubtree(change.children, '        ');
      if (subtree.length > 0) {
        lines.push(...subtree);
      }
    }

    // spacing between entries
    lines.push('');
  });

  // Remove trailing empty line
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  return lines.join('\n');
}
