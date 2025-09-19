import { ATLAS_DATABASES, AtlasDatabaseName, TYPE_SPECIFICATION_PARENT_SECTION_ID } from '../atlas/constants';

// Detect if a Notion page is a "Type Specification" document
export function isTypeSpecificationAtlasDocument(atlasDatabaseName: AtlasDatabaseName, notionPageId: string): boolean {
  return (
    atlasDatabaseName === ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS &&
    notionPageId === TYPE_SPECIFICATION_PARENT_SECTION_ID
  );
}
