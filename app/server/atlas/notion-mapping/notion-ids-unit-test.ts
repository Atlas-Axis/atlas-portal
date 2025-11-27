/**
 * Hard-coded Notion database IDs and other Notion-specific identifiers (UNIT TEST VERSION)
 *
 * This file contains made-up UUID values for unit testing.
 * These UUIDs are used to avoid requiring real Notion credentials in tests
 * and to ensure tests are isolated from production data.
 */
import type { AtlasDatabaseName } from '../atlas-types';

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
