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
  Scopes: '2baf2ff0-8d73-816e-aaed-c0044ed18d64',
  Articles: '2baf2ff0-8d73-8193-bb41-ebcb21a2c408',
  'Sections & Primary Docs': '2baf2ff0-8d73-811b-ba62-ef01468c6630',
  Annotations: '2baf2ff0-8d73-81c0-9c39-d9a680f96d3d',
  Tenets: '2baf2ff0-8d73-81f0-a6a3-ead0a01d37e4',
  Scenarios: '2baf2ff0-8d73-81b1-963c-f8f289792f77',
  'Scenario Variations': '2baf2ff0-8d73-8194-94b0-caa681f2a448',
  'Needed Research': '2baf2ff0-8d73-81c0-893f-d6917ad40b8a',
  'Active Data': '2baf2ff0-8d73-81cc-b086-c51e754c093e',
  'Agent Scope Database': '2baf2ff0-8d73-8139-b25e-efe3e7c1d70c',
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
