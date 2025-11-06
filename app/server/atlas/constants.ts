import type {
  AtlasDatabaseID,
  AtlasDatabaseName,
  AtlasDocumentType,
  GitHubAtlasDocumentType,
  MasterStatus,
} from './atlas-types';

// Re-export types for backward compatibility
export type { AtlasDatabaseName, AtlasDatabaseID, AtlasDocumentType, GitHubAtlasDocumentType, MasterStatus };

export const ATLAS_DOCUMENT_TYPES: AtlasDocumentType[] = [
  'Section',
  'Core',
  'Type Specification',
  'Active Data Controller',
  'Action Tenet',
  'Active Data',
  'Annotation',
  'Scope',
  'Article',
  'Scenario',
  'Scenario Variation',
  'Needed Research',
] as const;

export const ATLAS_DATABASES = {
  SCOPES: 'Scopes',
  ARTICLES: 'Articles',
  SECTIONS_AND_PRIMARY_DOCS: 'Sections & Primary Docs',
  ANNOTATIONS: 'Annotations',
  TENETS: 'Tenets',
  SCENARIOS: 'Scenarios',
  SCENARIO_VARIATIONS: 'Scenario Variations',
  NEEDED_RESEARCH: 'Needed Research',
  ACTIVE_DATA: 'Active Data',
  AGENTS: 'Agent Scope Database',
} as const;

export const ATLAS_DATABASE_NAMES: AtlasDatabaseName[] = [
  ATLAS_DATABASES.SCOPES,
  ATLAS_DATABASES.ARTICLES,
  ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS,
  ATLAS_DATABASES.ANNOTATIONS,
  ATLAS_DATABASES.TENETS,
  ATLAS_DATABASES.SCENARIOS,
  ATLAS_DATABASES.SCENARIO_VARIATIONS,
  ATLAS_DATABASES.NEEDED_RESEARCH,
  ATLAS_DATABASES.ACTIVE_DATA,
  ATLAS_DATABASES.AGENTS,
] as const;

// export type AtlasDatabaseName = (typeof ATLAS_DATABASE_NAMES)[number];

// Re-export Notion IDs from centralized file
export {
  ATLAS_DATABASE_ID_MAP,
  ATLAS_DATABASE_ID_MAP_REVERSED,
  MASTER_STATUS_ID_MAP,
  MASTER_STATUS_IDS,
  AGENT_ROOT_SECTION_UUID_FOR_NESTING,
  AGENT_ROOT_SECTION_UUIDS,
  AGENT_ROOT_SECTION_UUIDS_MAPPED,
  AGENT_ANCESTOR_ARTICLE_ID,
} from './notion-ids';

export const MASTER_STATUSES = {
  APPROVED: 'Approved',
  PROVISIONAL: 'Provisional',
  PLACEHOLDER: 'Placeholder',
  DEFERRED: 'Deferred',
  ARCHIVED: 'Archived',
};

export const IMPORT_DATABASES: AtlasDatabaseName[] = [
  ATLAS_DATABASES.SCOPES,
  ATLAS_DATABASES.ARTICLES,
  ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS,
  ATLAS_DATABASES.AGENTS,
  ATLAS_DATABASES.ANNOTATIONS,
  ATLAS_DATABASES.TENETS,
  ATLAS_DATABASES.ACTIVE_DATA,
  ATLAS_DATABASES.SCENARIOS,
  ATLAS_DATABASES.SCENARIO_VARIATIONS,
  ATLAS_DATABASES.NEEDED_RESEARCH,
] as const;

export const ATLAS_GITHUB_HTML_URL =
  'https://raw.githubusercontent.com/sky-ecosystem/next-gen-atlas/main/Sky%20Atlas/Sky%20Atlas.html';
