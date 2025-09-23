import { ATLAS_DATABASES, AtlasDatabaseName, TYPE_SPECIFICATION_PARENT_SECTION_ID } from '../atlas/constants';

// Detect if a Notion page is a "Type Specification" document
// TODO: This is a data issue in Notion, fix it at the source, then remove this workaround
export function isTypeSpecificationAtlasDocument(
  atlasDatabaseName: AtlasDatabaseName,
  atlasDocumentType: string,
  notionPageId: string,
): boolean {
  return (
    (atlasDatabaseName === ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS && atlasDocumentType === 'Type Specification') ||
    notionPageId === TYPE_SPECIFICATION_PARENT_SECTION_ID
  );
}
