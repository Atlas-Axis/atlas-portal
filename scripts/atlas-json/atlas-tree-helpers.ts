// Original name example: "A.1.5 - Aligned Delegates - Budget And Participation Requirements - Eligibility To Receive Budget"
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { ATLAS_DATABASES } from '@/app/server/services/atlas/constants';
import { AtlasTreeNode } from './atlas-tree-system';
import { compareDocNumbers } from './utils';

// See `makeDocTitle` in Powerhouse Notion importer for original logic reference
// I made changes to simplify and better fit our needs
export function getDocumentTitle(node: AtlasTreeNode | NotionDatabasePage): string {
  switch (node.atlas_database_name) {
    // Return the plain text name as-is for these databases
    case 'Scopes':
    case 'Articles':
    case 'Annotations':
    case 'Scenarios':
    case 'Active Data':
    case 'Scenario Variations':
      return node.plain_text_name ?? '';

    // Example: atlas_document_number = "A.1.6 - Facilitators - Budgets" → "Budgets"
    case 'Sections & Primary Docs':
    case 'Agent Scope Database':
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

/**
 * Sorts child nodes by sort_order and document type priority.
 *
 * This function implements the same sorting logic as the original document numbering system,
 * ensuring consistent ordering across the tree structure.
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

    // Then sort by Atlas database priority
    // Example where this is wrong: A.1.5 - A1... Active Data Controller and Core documents are on the same level under this Section
    const typePriority: Record<string, number> = {
      [ATLAS_DATABASES.SCOPES]: 1,
      [ATLAS_DATABASES.AGENTS]: 1,
      [ATLAS_DATABASES.ARTICLES]: 2,
      [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: 3,
      [ATLAS_DATABASES.ANNOTATIONS]: 4,
      [ATLAS_DATABASES.TENETS]: 5,
      [ATLAS_DATABASES.ACTIVE_DATA]: 6,
      [ATLAS_DATABASES.SCENARIOS]: 7,
      [ATLAS_DATABASES.SCENARIO_VARIATIONS]: 8,
      [ATLAS_DATABASES.NEEDED_RESEARCH]: 9,
    };

    const aPriority = typePriority[a.atlas_document_type] || 999;
    const bPriority = typePriority[b.atlas_document_type] || 999;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // Final fallback: use atlas_document_number
    const an = a.atlas_document_number || '';
    const bn = b.atlas_document_number || '';
    return compareDocNumbers(an, bn);
  });
}
