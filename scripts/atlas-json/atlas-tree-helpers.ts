// Original name example: "A.1.5 - Aligned Delegates - Budget And Participation Requirements - Eligibility To Receive Budget"
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { AtlasTreeNode } from './atlas-tree-system';

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
