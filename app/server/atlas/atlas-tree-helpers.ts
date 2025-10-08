// Original name example: "A.1.5 - Aligned Delegates - Budget And Participation Requirements - Eligibility To Receive Budget"
import { compareDocNumbers } from '@/app/server/atlas/atlas-utils';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { AtlasTreeNode } from './atlas-tree-system';

// See `makeDocTitle` in Powerhouse Notion importer for original logic reference
// I made changes to simplify and better fit our needs
export function getDocumentTitle(node: AtlasTreeNode | NotionDatabasePage): string {
  switch (node.atlas_database_name) {
    // Return the plain text name as-is for these databases
    case 'Scopes':
    case 'Articles':
    case 'Agent Scope Database':
    case 'Tenets': // ?
    case 'Needed Research': // ?
    case 'Annotations':
    case 'Scenarios':
    case 'Active Data':
    case 'Scenario Variations':
      return node.plain_text_name ?? '';

    // Example: atlas_document_number = "A.1.6 - Facilitators - Budgets" → "Budgets"
    case 'Sections & Primary Docs':
      return getLastTitlePart(node.atlas_document_number ?? '') ?? '';

    default:
      console.warn(`getDocumentTitle: Unhandled atlas_database_name '${node.atlas_database_name}'`);
      return node.plain_text_name ?? '';
  }
}

// Returns the last part of a title, split by " - ", or if not found, returns the full string
export function getLastTitlePart(s: string) {
  return s.split(' - ').at(-1);
}

// Returns the first part of a title, split by " - ", or if not found, returns the full string
// TODO: Delete - unused
export function getFirstTitlePart(s: string) {
  return s.split(' - ').at(0);
}

// Returns all the parts except the last part of a title, split by " - ", or if not found, returns the full string
// TODO: Delete - unused
export function getAllButLastTitlePart(s: string) {
  const parts = s.split(' - ');
  if (parts.length <= 1) return s;
  return parts.slice(0, -1).join(' - ');
}

/**
 * Sorts child nodes by sort_order and document number.
 *
 * @param documents - Array of child tree nodes to sort
 * @returns Sorted array of child tree nodes
 */
export function sortAtlasDocuments<
  T extends {
    sort_order: number | null;
    atlas_document_type: string;
    atlas_document_number: string;
  },
>(documents: T[]): T[] {
  return [...documents].sort((a, b) => {
    // First sort by sort_order
    const aOrder = a.sort_order;
    const bOrder = b.sort_order;
    const aHasOrder = aOrder != null;
    const bHasOrder = bOrder != null;

    // If both have sort_order and they differ, sort by that
    if (aHasOrder && bHasOrder && aOrder! !== bOrder!) {
      return aOrder! - bOrder!;
    }
    // If only one has sort_order, it comes first
    if (aHasOrder && !bHasOrder) return -1;
    if (!aHasOrder && bHasOrder) return 1;

    // Final fallback: use atlas_document_number
    const an = a.atlas_document_number || '';
    const bn = b.atlas_document_number || '';
    return compareDocNumbers(an, bn);
  });
}
