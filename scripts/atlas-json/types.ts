import { AtlasDatabaseName, AtlasDocumentType, GitHubAtlasDocumentType } from '@/app/server/services/atlas/constants';

export interface AtlasDocumentJson {
  type: AtlasDocumentType;
  generatedDocNumber: string;
  originalDocNumber: string;
  name: string;
  content: string;
  uuid: string | null;
}

export interface AtlasCategoryJson {
  type: GitHubAtlasDocumentType | AtlasDatabaseName;
  documents: AtlasDocumentJson[];
}
