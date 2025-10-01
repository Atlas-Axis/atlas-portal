import { Database } from '@/app/server/services/supabase/database.types';

export type AtlasDatabaseName = Exclude<
  Database['public']['Enums']['atlas_database_name_enum'],
  'Type Specification' | 'Original Context Data'
>;

export type AtlasDocumentType = Exclude<
  Database['public']['Enums']['atlas_document_type_enum'],
  'Spell SP Controller' | 'Placeholder'
>;

export type GitHubAtlasDocumentType =
  | 'Scopes'
  | 'Articles'
  | 'Sections & Primary Docs'
  | 'Type Specifications'
  | 'Annotations'
  | 'Tenets'
  | 'Scenarios'
  | 'Scenario Variations'
  | 'Needed Research'
  | 'Active Data'
  | 'Agent Scope Database';

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

export const ATLAS_DATABASE_ID_MAP: Record<AtlasDatabaseName, string> = {
  [ATLAS_DATABASES.SCOPES]: 'ebdb403a44bd4d169ec8f9330e955247',
  [ATLAS_DATABASES.ARTICLES]: '15e06a0d07364458a5caeb85d7b54408',
  [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: '06d1d4fa1cc44e88a06559d4082163a8',
  [ATLAS_DATABASES.ANNOTATIONS]: 'e147e8835a2143c38264e86b1d9b24fc',
  [ATLAS_DATABASES.TENETS]: '7fcbad225c524dffa20cd4efb2e13b56',
  [ATLAS_DATABASES.SCENARIOS]: '8a05694599194c3ca8c8ee1b86086837',
  [ATLAS_DATABASES.SCENARIO_VARIATIONS]: 'd0de59236e6d4a48a44533fa64d966ac',
  [ATLAS_DATABASES.NEEDED_RESEARCH]: 'effd5738033548a98ec1a7e99cbadd1d',
  [ATLAS_DATABASES.ACTIVE_DATA]: '5b566dd732464927b8eee6e1b2ff99d9',
  [ATLAS_DATABASES.AGENTS]: '1bbf2ff08d73808d9ce3e2122857e262',
} as const;

export const ATLAS_DATABASE_ID_MAP_REVERSED: Record<string, AtlasDatabaseName> = Object.fromEntries(
  Object.entries(ATLAS_DATABASE_ID_MAP).map(([key, value]) => [value, key as AtlasDatabaseName]),
);

export type AtlasDatabaseID = (typeof ATLAS_DATABASE_ID_MAP)[AtlasDatabaseName];

export const MASTER_STATUSES = {
  APPROVED: 'Approved',
  PROVISIONAL: 'Provisional',
  PLACEHOLDER: 'Placeholder',
  DEFERRED: 'Deferred',
  ARCHIVED: 'Archived',
};

export const MASTER_STATUS_ID_MAP: Record<string, string> = {
  [MASTER_STATUSES.ARCHIVED]: '434486e6-0d5e-4541-9f00-40cb9bd67d1c',
  [MASTER_STATUSES.DEFERRED]: 'f38bf53d-96bd-4345-a403-c6629ed202a1',
  [MASTER_STATUSES.APPROVED]: 'fe75a64f-585b-4d08-af00-ef8667d9c307',
  [MASTER_STATUSES.PROVISIONAL]: '3dbb9d9c-fd63-462b-99f3-1ce879f16768',
  [MASTER_STATUSES.PLACEHOLDER]: '3edf54e3-be0e-4bbb-b008-502cfc23394e',
};

export type MasterStatus = (typeof MASTER_STATUSES)[keyof typeof MASTER_STATUSES];

export const MASTER_STATUS_IDS = Object.values(MASTER_STATUS_ID_MAP);

export const IMPORT_DATABASES = [
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

// The specific Section & Primary Doc page ID under which root Agent documents will be nested
// TODO: In the future, there may be two agent ancestor sections, one for Prime Agents and one for Executor Agents. Currently, we only have one (Prime Agents).
// This relationship is not defined in Notion, so we define it here to mirror how the Atlas Explorer UI does it
// TODO: Replace usages of AGENT_PARENT_SECTION_ID with AGENT_ROOT_SECTION_UUIDS
export const AGENT_PARENT_SECTION_ID = '1b4f2ff0-8d73-8082-862b-dcd586862638';
// UUIDs of agent root documents whose subtrees can be omitted via --omit-agents
export const AGENT_ROOT_SECTION_UUIDS = new Set<string>([
  '1b4f2ff0-8d73-8082-862b-dcd586862638',
  '1b4f2ff0-8d73-802f-a054-fece4d8731a4',
]);
// This is the specific Article page ID under which agent parent section(s) is/are nested; This is not the direct parent of the agent documents, but their common grandparent that they all inherit from.
export const AGENT_ANCESTOR_ARTICLE_ID = '1b4f2ff08d73805aaf66de296b4aed33';

export const ATLAS_GITHUB_HTML_URL =
  'https://raw.githubusercontent.com/sky-ecosystem/next-gen-atlas/main/Sky%20Atlas/Sky%20Atlas.html';
