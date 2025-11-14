// Original name example: "A.1.5 - Aligned Delegates - Budget And Participation Requirements - Eligibility To Receive Budget"
import { compareDocNumbers } from '@/app/server/atlas/document-numbering/atlas-utils';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { NotionAtlasTreeNode } from './atlas-tree-system';

export function getDocumentTitle(node: NotionAtlasTreeNode | NotionDatabasePage): string {
  switch (node.atlas_database_name) {
    // Return the plain text name as-is for these databases
    case 'Scopes':
    case 'Articles':
    case 'Agent Scope Database':
    case 'Tenets': // ?
    case 'Needed Research': // ?
    case 'Annotations':
    case 'Scenarios':
    case 'Scenario Variations':
      return node.plain_text_name ?? '';

    // Example: plain_text_name = "A.1.6 - Facilitators - Budgets" → "Budgets"
    case 'Sections & Primary Docs':
    case 'Active Data':
      return getLastTitlePart(node.plain_text_name ?? '') ?? '';

    default:
      console.warn(`getDocumentTitle: Unhandled atlas_database_name '${node.atlas_database_name}'`);
      return node.plain_text_name ?? '';
  }
}

// Returns the last part of a title, split by " - ", or if not found, returns the full string
export function getLastTitlePart(s: string) {
  return s.split(' - ').at(-1);
}

/**
 * Sorts child nodes by sort_order and document number.
 *
 * Docs: https://www.notion.so/atlas-axis/Ordering-Of-Atlas-Documents-280f2ff08d73802e8e08d0bd88e081be
 *
 * @param documents - Array of child tree nodes to sort
 * @returns Sorted array of child tree nodes
 */
export function sortAtlasDocuments<
  T extends {
    sort_order: number | null;
    atlas_document_type: string;
    atlas_document_number: string;
    atlas_database_name: string;
  },
>(documents: T[]): T[] {
  return [...documents].sort((a, b) => {
    switch (a.atlas_database_name) {
      case 'Scopes':
      case 'Articles':
      case 'Agent Scope Database':
      case 'Annotations':
      case 'Tenets':
      case 'Active Data':
      case 'Scenarios':
      case 'Scenario Variations':
      case 'Needed Research':
        // Compare document numbers like "A.1" vs "A.10" using compareDocNumbers
        return compareDocNumbers(a.atlas_document_number || '', b.atlas_document_number || '');
      case 'Sections & Primary Docs':
        // Sort by sort_order first, then by document number using compareDocNumbers
        if (a.sort_order !== b.sort_order) {
          return (a.sort_order ?? 0) - (b.sort_order ?? 0);
        }
        return compareDocNumbers(a.atlas_document_number || '', b.atlas_document_number || '');
      default:
        return 0;
    }
  });
}
