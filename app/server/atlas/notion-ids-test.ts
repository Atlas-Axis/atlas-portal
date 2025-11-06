/**
 * Hard-coded Notion database IDs and other Notion-specific identifiers
 *
 * This file contains all Notion-specific IDs that reference actual Notion databases,
 * pages, and properties. These are environment-specific and may differ between
 * development and production environments.
 */
import type { AtlasDatabaseName } from './atlas-types';
import { ATLAS_DATABASES } from './constants';

/**
 * Maps Atlas database names to their corresponding Notion database IDs
 */
export const ATLAS_DATABASE_ID_MAP: Record<AtlasDatabaseName, string> = {
  [ATLAS_DATABASES.SCOPES]: '',
  [ATLAS_DATABASES.ARTICLES]: '',
  [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: '',
  [ATLAS_DATABASES.ANNOTATIONS]: '',
  [ATLAS_DATABASES.TENETS]: '',
  [ATLAS_DATABASES.SCENARIOS]: '',
  [ATLAS_DATABASES.SCENARIO_VARIATIONS]: '',
  [ATLAS_DATABASES.NEEDED_RESEARCH]: '',
  [ATLAS_DATABASES.ACTIVE_DATA]: '',
  [ATLAS_DATABASES.AGENTS]: '',
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
