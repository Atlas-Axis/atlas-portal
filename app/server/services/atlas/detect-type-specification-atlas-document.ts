import { ATLAS_DATABASES, AtlasDatabaseName } from '../atlas/constants';

// Detect if a Notion page is a "Type Specification" document
export function isTypeSpecificationAtlasDocument(
  atlasDatabaseName: AtlasDatabaseName,
  atlasDocumentType: string,
): boolean {
  return atlasDatabaseName === ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS && atlasDocumentType === 'Type Specification';
}
