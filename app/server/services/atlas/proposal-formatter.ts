/**
 * Formatting utilities for Atlas proposal generation
 */
import { TreeNode } from '../../diff/tree';
import { DocumentReference, FormattedChange } from './proposal-types';

/**
 * Format document reference as "Portal / GitHub" format
 * For now, Portal and GitHub titles are the same, but placeholder logic for future differentiation
 */
export function formatDocumentReference(canonicalTitle: string): DocumentReference {
  // TODO: In the future, Portal and GitHub titles may differ
  // For now, they're the same according to project documentation
  const portalTitle = `${canonicalTitle} (Portal)`;
  const githubTitle = `${canonicalTitle} (Github)`; // Note: keeping "Github" as in examples

  return {
    portalTitle,
    githubTitle,
    canonicalTitle,
  };
}

/**
 * Format a document reference for display in proposals
 */
export function formatDocumentReferenceString(docRef: DocumentReference): string {
  return `\`${docRef.portalTitle}\` / \`${docRef.githubTitle}\``;
}

/**
 * Determine relative position of a node among its siblings
 * Returns strings like "directly after X" or "directly before Y"
 */
export function calculateRelativePosition(targetNode: TreeNode, siblings: TreeNode[]): string | null {
  const targetIndex = siblings.findIndex((sibling) => sibling.id === targetNode.id);

  if (targetIndex === -1) return null;

  // For additions, we typically want to specify position relative to existing siblings
  if (targetIndex > 0) {
    const previousSibling = siblings[targetIndex - 1];
    if (previousSibling.canonicalDocumentTitle) {
      const prevDocRef = formatDocumentReference(previousSibling.canonicalDocumentTitle);
      return `directly after ${formatDocumentReferenceString(prevDocRef)}`;
    }
  }

  if (targetIndex < siblings.length - 1) {
    const nextSibling = siblings[targetIndex + 1];
    if (nextSibling.canonicalDocumentTitle) {
      const nextDocRef = formatDocumentReference(nextSibling.canonicalDocumentTitle);
      return `directly before ${formatDocumentReferenceString(nextDocRef)}`;
    }
  }

  return null;
}

/**
 * Format document content with proper hierarchy and indentation
 */
export function formatDocumentContent(content: string | null, children?: FormattedChange[]): string {
  if (!content && (!children || children.length === 0)) {
    return '';
  }

  const lines: string[] = [];

  // Add main content if present
  if (content) {
    lines.push(content);
  }

  // Add children with proper indentation
  if (children && children.length > 0) {
    children.forEach((child) => {
      const childContent = formatDocumentContent(child.content || null, child.children);
      if (childContent) {
        // Add proper indentation for nested content
        const indentedContent = childContent
          .split('\n')
          .map((line) => (line ? `    - ${line}` : line))
          .join('\n');
        lines.push(indentedContent);
      }
    });
  }

  return lines.join('\n');
}

/**
 * Detect document type based on content or block type
 * Returns strings like "(Core)", "(Alignment Artifact)", etc.
 * TODO: Implement logic based on content analysis or block type
 */
export function detectDocumentType(node: TreeNode, content: string | null): string {
  // TODO: Implement document type detection logic
  // For now, return empty string

  // Suppress lint warnings for future implementation
  void node;
  void content;

  return '';
}

/**
 * Format a single change entry for the proposal
 */
export function formatChangeEntry(change: FormattedChange): string {
  const docRefString = formatDocumentReferenceString(change.documentRef);
  const docType = ''; // TODO: Will be populated by detectDocumentType

  switch (change.type) {
    case 'add':
      const additionLine = change.targetParentRef
        ? `**Add** a new subdocument of ${formatDocumentReferenceString(change.targetParentRef)}`
        : `**Add** a new document`;

      const positionText = change.position ? `. This document should be located ${change.position}` : '';
      const contentText = change.content
        ? ` to read as follows:\n    - **${change.documentRef.canonicalTitle}**${docType} - ${change.content}`
        : '';

      return `- ${additionLine}${positionText}${contentText}`;

    case 'delete':
      return `- **Delete** ${docRefString}.`;

    case 'replace':
      const replaceText = change.children && change.children.length > 0 ? ` and all of its subdocuments` : ``;
      const replaceContent = change.content
        ? ` to read as follows:\n    - **${change.documentRef.canonicalTitle}**${docType} - ${change.content}`
        : ``;

      return `- **Replace** ${docRefString}${replaceText}${replaceContent}`;

    case 'move':
      const moveTarget = change.targetParentRef
        ? ` to be subdocuments of ${formatDocumentReferenceString(change.targetParentRef)}`
        : ``;
      const movePosition = change.position ? `. These documents should be located ${change.position}` : '';
      const moveSubtree = change.children && change.children.length > 0 ? ` and its subdocuments` : ``;

      return `- **Move** ${docRefString}${moveSubtree}${moveTarget}${movePosition}.`;

    default:
      return `- **Unknown change type** for ${docRefString}`;
  }
}
