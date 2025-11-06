import { AtlasDatabaseName, GitHubAtlasDocumentType } from '@/app/server/atlas/atlas-types';

const CATEGORIES_REQUIRING_A_PREFIX: ReadonlyArray<GitHubAtlasDocumentType | AtlasDatabaseName> = [
  'Active Data',
  'Type Specifications',
  'Articles',
  'Sections & Primary Docs',
];

export function fixDocumentNumberPrefix(
  docNumber: string,
  category: GitHubAtlasDocumentType | AtlasDatabaseName,
): string {
  if (!docNumber) return docNumber;
  if (CATEGORIES_REQUIRING_A_PREFIX.includes(category)) {
    if (!docNumber.startsWith('A.')) {
      return `A.${docNumber}`;
    }
  }
  return docNumber;
}
