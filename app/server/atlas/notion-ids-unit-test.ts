/**
 * Hard-coded Notion database IDs and other Notion-specific identifiers (UNIT TEST VERSION)
 *
 * This file contains made-up UUID values for unit testing.
 * These UUIDs are used to avoid requiring real Notion credentials in tests
 * and to ensure tests are isolated from production data.
 */
import type { AtlasDatabaseName } from './atlas-types';

/**
 * Maps Atlas database names to made-up UUIDs for unit testing
 * NOTE: Keys use string literals instead of ATLAS_DATABASES constants to avoid circular dependency
 */
export const ATLAS_DATABASE_ID_MAP: Record<AtlasDatabaseName, string> = {
  Scopes: '00000000000000000000000000000001',
  Articles: '00000000000000000000000000000002',
  'Sections & Primary Docs': '00000000000000000000000000000003',
  Annotations: '00000000000000000000000000000004',
  Tenets: '00000000000000000000000000000005',
  Scenarios: '00000000000000000000000000000006',
  'Scenario Variations': '00000000000000000000000000000007',
  'Needed Research': '00000000000000000000000000000008',
  'Active Data': '00000000000000000000000000000009',
  'Agent Scope Database': '0000000000000000000000000000000a',
} as const;

/**
 * Reverse mapping: Notion database ID to Atlas database name
 */
export const ATLAS_DATABASE_ID_MAP_REVERSED: Record<string, AtlasDatabaseName> = Object.fromEntries(
  Object.entries(ATLAS_DATABASE_ID_MAP).map(([key, value]) => [value, key as AtlasDatabaseName]),
);

/**
 * Maps Master Status names to made-up UUIDs for unit testing
 */
export const MASTER_STATUS_ID_MAP: Record<string, string> = {
  Archived: '10000000-1000-4000-8000-000000000001',
  Deferred: '10000000-1000-4000-8000-000000000002',
  Approved: '10000000-1000-4000-8000-000000000003',
  Provisional: '10000000-1000-4000-8000-000000000004',
  Placeholder: '10000000-1000-4000-8000-000000000005',
};

/**
 * All Master Status option IDs as an array
 */
export const MASTER_STATUS_IDS = Object.values(MASTER_STATUS_ID_MAP);

/**
 * The specific Section & Primary Doc page ID under which root Agent documents will be nested
 * (Prime Agents ancestor section)
 */
export const AGENT_ROOT_SECTION_UUID_FOR_NESTING = '1b4f2ff0-8d73-8082-862b-dcd586862638';

/**
 * UUIDs of agent root documents whose subtrees can be omitted via --omit-agents
 * - First UUID: Prime Agents ancestor section
 * - Second UUID: Executor Agents ancestor section
 */
export const AGENT_ROOT_SECTION_UUIDS = new Set<string>([
  '1b4f2ff0-8d73-8082-862b-dcd586862638', // Prime Agents
  '1b4f2ff0-8d73-802f-a054-fece4d8731a4', // Executor Agents
]);

/**
 * Map Notion UUIDs of agent root sections to Atlas UUIDs
 */
export const AGENT_ROOT_SECTION_UUIDS_MAPPED = new Map<string, string>([
  ['1b4f2ff0-8d73-8082-862b-dcd586862638', '9fb7f1cc-f60b-4195-892d-5e540f969973'], // Prime Agents
  ['1b4f2ff0-8d73-802f-a054-fece4d8731a4', 'df62511d-afe5-42db-8bd4-6452c5a0f464'], // Executor Agents
]);

/**
 * This is the specific Article Notion page ID under which agent parent section(s) is/are nested
 * This is not the direct parent of the agent documents, but their common grandparent that they all inherit from
 */
export const AGENT_ANCESTOR_ARTICLE_ID = '1b4f2ff0-8d73-805a-af66-de296b4aed33';
