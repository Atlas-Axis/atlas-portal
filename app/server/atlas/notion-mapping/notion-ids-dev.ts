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
  Scopes: '2baf2ff0-8d73-816d-8968-e55f4d6e57f4',
  Articles: '2baf2ff0-8d73-8130-a42d-f404abb486fc',
  'Sections & Primary Docs': '2baf2ff0-8d73-8101-84d4-c181049bf54c',
  Annotations: '2baf2ff0-8d73-813d-88ed-d01fad3beadd',
  Tenets: '2baf2ff0-8d73-8123-9e2f-c7d5a1ff8f25',
  Scenarios: '2baf2ff0-8d73-8152-ad18-da2649b02b61',
  'Scenario Variations': '2baf2ff0-8d73-81af-9edd-edd4e628929e',
  'Needed Research': '2baf2ff0-8d73-8138-b4bd-d6e7098ee55c',
  'Active Data': '2baf2ff0-8d73-812f-9e28-eae18edb10d5',
  'Agent Scope Database': '2baf2ff0-8d73-8165-a2f7-cf57d650e0bf',
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
