import { AtlasDatabaseName, AtlasDocumentType, GitHubAtlasDocumentType } from '@/app/server/atlas/constants';

export interface AtlasDocumentJson {
  type: AtlasDocumentType;
  generatedDocNumber: string;
  originalDocNumber: string;
  name: string;
  content: string;
  uuid: string | null;
  inactive: boolean;
}

export interface AtlasCategoryJson {
  type: GitHubAtlasDocumentType | AtlasDatabaseName;
  documents: AtlasDocumentJson[];
}
