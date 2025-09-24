import { AtlasDatabaseName, AtlasDocumentType, GitHubAtlasDocumentType } from '@/app/server/services/atlas/constants';

export interface AtlasDocumentJson {
  type: AtlasDocumentType;
  docNumber: string;
  name: string;
  content: string;
  uuid: string | null;
}

export interface AtlasCategoryJson {
  type: GitHubAtlasDocumentType | AtlasDatabaseName;
  documents: AtlasDocumentJson[];
}
