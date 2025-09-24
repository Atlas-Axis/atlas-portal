import { AtlasDocumentType, GitHubAtlasDocumentType } from '@/app/server/services/atlas/constants';

export interface AtlasDocumentJson {
  type: AtlasDocumentType;
  name: string;
  content: string;
  uuid: string | null;
}

export interface AtlasCategoryJson {
  type: GitHubAtlasDocumentType;
  name: string;
  content: string;
  uuid: string | null;
}
