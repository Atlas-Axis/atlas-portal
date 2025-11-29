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
  'Scopes': '2baf2ff0-8d73-8125-8ad5-efd48bca736a',
  'Articles': '2baf2ff0-8d73-81d7-973b-f11b026a0120',
  'Sections & Primary Docs': '2baf2ff0-8d73-8190-b578-eac609bb617d',
  'Annotations': '2baf2ff0-8d73-8137-95cf-e9b788250ffb',
  'Tenets': '2baf2ff0-8d73-81a4-bedb-c49db776f722',
  'Scenarios': '2baf2ff0-8d73-8111-b43a-cb41b25050dd',
  'Scenario Variations': '2baf2ff0-8d73-8131-8890-ec4ebb3e242c',
  'Needed Research': '2baf2ff0-8d73-8132-a35b-e1088890adb3',
  'Active Data': '2baf2ff0-8d73-8196-8c98-f0ad388ddda8',
  'Agent Scope Database': '2baf2ff0-8d73-81f3-bab6-d3373980bcdd',
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
