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
  Scopes: '2b8f2ff0-8d73-819d-a60d-dc3c5c2a399a',
  Articles: '2b8f2ff0-8d73-8171-9ebd-fbbf93673628',
  'Sections & Primary Docs': '2b8f2ff0-8d73-819e-b8a3-ea2c4cdbf523',
  Annotations: '2b8f2ff0-8d73-8161-84e5-eeeec79cef01',
  Tenets: '2b8f2ff0-8d73-81ee-9d9f-e1685df183f8',
  Scenarios: '2b8f2ff0-8d73-816a-92d9-f8ddb4b3dc57',
  'Scenario Variations': '2b8f2ff0-8d73-81f7-8472-c2625fc8b963',
  'Needed Research': '2b8f2ff0-8d73-81e4-87e5-da1079597b47',
  'Active Data': '2b8f2ff0-8d73-81fc-845a-fd25cfb33e3d',
  'Agent Scope Database': '2b8f2ff0-8d73-8151-98b9-d1b47bb67777',
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
