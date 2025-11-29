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
  'Scopes': '2baf2ff0-8d73-8186-a04b-d2da4d48e5da',
  'Articles': '2baf2ff0-8d73-8122-bd59-eaa6dc34ed6d',
  'Sections & Primary Docs': '2baf2ff0-8d73-818d-93ac-e04b880e5735',
  'Annotations': '2baf2ff0-8d73-8129-b262-c103850e105e',
  'Tenets': '2baf2ff0-8d73-8104-b0c1-e1834fbb95f1',
  'Scenarios': '2baf2ff0-8d73-814f-8d7b-c59bbc580758',
  'Scenario Variations': '2baf2ff0-8d73-81aa-9bd4-e52eada41a07',
  'Needed Research': '2baf2ff0-8d73-8137-8790-c1f2f8f24100',
  'Active Data': '2baf2ff0-8d73-81bb-b561-dec697232c8a',
  'Agent Scope Database': '2baf2ff0-8d73-810e-9ef5-f4e0b6d6f4ce',
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
