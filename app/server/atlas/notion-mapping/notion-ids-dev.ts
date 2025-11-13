/**
 * Hard-coded Notion database IDs and other Notion-specific identifiers (DEVELOPMENT VERSION)
 *
 * This file contains Notion-specific IDs for development and manual QA environments.
 * These IDs are separate from production to prevent accidental access to production data.
 * Unit tests use notion-ids-unit-test.ts instead.
 */
import type { AtlasDatabaseName } from '../atlas-types';

/**
 * Maps Atlas database names to their corresponding Notion database IDs for development/QA
 * NOTE: Keys use string literals instead of ATLAS_DATABASES constants to avoid circular dependency
 */
export const ATLAS_DATABASE_ID_MAP: Record<AtlasDatabaseName, string> = {
  Scopes: '',
  Articles: '',
  'Sections & Primary Docs': '',
  Annotations: '',
  Tenets: '',
  Scenarios: '',
  'Scenario Variations': '',
  'Needed Research': '',
  'Active Data': '',
  'Agent Scope Database': '',
} as const;

/**
 * Reverse mapping: Notion database ID to Atlas database name
 */
export const ATLAS_DATABASE_ID_MAP_REVERSED: Record<string, AtlasDatabaseName> = Object.fromEntries(
  Object.entries(ATLAS_DATABASE_ID_MAP).map(([key, value]) => [value, key as AtlasDatabaseName]),
);

/**
 * Maps Master Status names to their Notion property option IDs
 */
export const MASTER_STATUS_ID_MAP: Record<string, string> = {
  Archived: '',
  Deferred: '',
  Approved: '',
  Provisional: '',
  Placeholder: '',
};

/**
 * All Master Status option IDs as an array
 */
export const MASTER_STATUS_IDS = Object.values(MASTER_STATUS_ID_MAP);

/**
 * The specific Section & Primary Doc page ID under which root Agent documents will be nested
 * TODO: In the future, there may be two agent ancestor sections, one for Prime Agents and one for Executor Agents.
 * Currently, we only have one (Prime Agents).
 * This relationship is not defined in Notion, so we define it here to mirror how the Atlas Explorer UI does it
 */
export const AGENT_ROOT_SECTION_UUID_FOR_NESTING = '';

/**
 * UUIDs of agent root documents whose subtrees can be omitted via --omit-agents
 */
export const AGENT_ROOT_SECTION_UUIDS = new Set<string>(['', '']);

/**
 * Map Notion UUIDs of agent root sections to Atlas UUIDs
 */
export const AGENT_ROOT_SECTION_UUIDS_MAPPED = new Map<string, string>([
  ['', ''],
  ['', ''],
]);

/**
 * This is the specific Article Notion page ID under which agent parent section(s) is/are nested
 * This is not the direct parent of the agent documents, but their common grandparent that they all inherit from
 */
export const AGENT_ANCESTOR_ARTICLE_ID = '';
