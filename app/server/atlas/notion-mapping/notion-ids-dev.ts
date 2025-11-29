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
  Scopes: '2baf2ff0-8d73-8159-b7b7-eb5bbb259fa7',
  Articles: '2baf2ff0-8d73-817f-a819-fa7683429721',
  'Sections & Primary Docs': '2baf2ff0-8d73-8107-87d9-ca2baa3e6d75',
  Annotations: '2baf2ff0-8d73-8162-b8dc-ffc87749716e',
  Tenets: '2baf2ff0-8d73-8114-ad32-e236a8c14eeb',
  Scenarios: '2baf2ff0-8d73-818f-bd5b-d7b4b5b2bcd2',
  'Scenario Variations': '2baf2ff0-8d73-8189-bcb0-e6a8e355cf0d',
  'Needed Research': '2baf2ff0-8d73-8121-869d-dc073a54e7db',
  'Active Data': '2baf2ff0-8d73-81dc-906f-eff5fe194abc',
  'Agent Scope Database': '2baf2ff0-8d73-81f5-b9dd-fa130816e58d',
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
