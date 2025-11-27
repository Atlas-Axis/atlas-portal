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
  Scopes: '2b8f2ff0-8d73-81b4-9333-fa68a20d987a',
  Articles: '2b8f2ff0-8d73-81b1-a3d1-ec75fb55eda0',
  'Sections & Primary Docs': '2b8f2ff0-8d73-8156-bf9f-caebae50c629',
  Annotations: '2b8f2ff0-8d73-81b8-834f-dd8ad3f3b4ea',
  Tenets: '2b8f2ff0-8d73-81fc-97c7-c519c00be373',
  Scenarios: '2b8f2ff0-8d73-8127-95d8-daeaceb914a3',
  'Scenario Variations': '2b8f2ff0-8d73-8140-b82e-d0840fad2045',
  'Needed Research': '2b8f2ff0-8d73-81ae-9304-e5dd386d4a44',
  'Active Data': '2b8f2ff0-8d73-81e3-900a-f62df1791595',
  'Agent Scope Database': '2b8f2ff0-8d73-8160-8525-e83e4e1caf3c',
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
