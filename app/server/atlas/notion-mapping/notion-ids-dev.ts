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
  Scopes: '2e7f2ff0-8d73-81a4-b384-e83907b0d2b9',
  Articles: '2e7f2ff0-8d73-8195-bb75-f35cfe30993d',
  'Sections & Primary Docs': '2e7f2ff0-8d73-81af-a643-fb5f6ca8d3ec',
  Annotations: '2e7f2ff0-8d73-8121-b795-ebd0a1679df1',
  Tenets: '2e7f2ff0-8d73-817b-84ac-c86564c99610',
  Scenarios: '2e7f2ff0-8d73-8191-b5d8-fdab5d7e9e79',
  'Scenario Variations': '2e7f2ff0-8d73-81f3-aed2-d5b44fa1196e',
  'Needed Research': '2e7f2ff0-8d73-81f0-a91f-c99b98631bcb',
  'Active Data': '2e7f2ff0-8d73-8111-a8e7-e3114169d545',
  'Agent Scope Database': '2e7f2ff0-8d73-818e-9822-fb527d13d4d8',
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
