import type {
  AtlasDatabaseID,
  AtlasDatabaseName,
  AtlasDocumentType,
  GitHubAtlasDocumentType,
  MasterStatus,
} from './atlas-types';
// export type AtlasDatabaseName = (typeof ATLAS_DATABASE_NAMES)[number];

/**
 * Conditionally import Notion IDs based on environment
 *
 * This module imports Notion-specific identifiers (database IDs, status IDs, agent UUIDs)
 * from either the production file (notion-ids.ts) or test file (notion-ids-test.ts)
 * based on the current environment.
 *
 * Environment Selection Logic:
 * - Uses notion-ids-test.ts (empty IDs) when: NODE_ENV !== 'production' OR USE_TEST_NOTION_IDS === 'true'
 * - Uses notion-ids.ts (real IDs) when: NODE_ENV === 'production' AND USE_TEST_NOTION_IDS !== 'true'
 *
 * Benefits:
 * - Tests can run without real Notion credentials
 * - Prevents accidental use of production IDs in development
 * - Allows manual override via USE_TEST_NOTION_IDS environment variable
 */
import * as notionIds from './notion-ids';
import * as notionIdsTest from './notion-ids-test';

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

const useTestIds = process.env.NODE_ENV !== 'production' || process.env.USE_TEST_NOTION_IDS === 'true';
const selectedIds = useTestIds ? notionIdsTest : notionIds;

export const ATLAS_DATABASE_ID_MAP = selectedIds.ATLAS_DATABASE_ID_MAP;
export const ATLAS_DATABASE_ID_MAP_REVERSED = selectedIds.ATLAS_DATABASE_ID_MAP_REVERSED;
export const MASTER_STATUS_ID_MAP = selectedIds.MASTER_STATUS_ID_MAP;
export const MASTER_STATUS_IDS = selectedIds.MASTER_STATUS_IDS;
export const AGENT_ROOT_SECTION_UUID_FOR_NESTING = selectedIds.AGENT_ROOT_SECTION_UUID_FOR_NESTING;
export const AGENT_ROOT_SECTION_UUIDS = selectedIds.AGENT_ROOT_SECTION_UUIDS;
export const AGENT_ROOT_SECTION_UUIDS_MAPPED = selectedIds.AGENT_ROOT_SECTION_UUIDS_MAPPED;
export const AGENT_ANCESTOR_ARTICLE_ID = selectedIds.AGENT_ANCESTOR_ARTICLE_ID;

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
