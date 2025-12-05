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
  Scopes: '2c0f2ff0-8d73-818f-ab94-cacf04090004',
  Articles: '2c0f2ff0-8d73-8119-9dce-dab36bd33982',
  'Sections & Primary Docs': '2c0f2ff0-8d73-8185-bee1-e77b4d66723b',
  Annotations: '2c0f2ff0-8d73-8125-a316-e65fc8cf23e9',
  Tenets: '2c0f2ff0-8d73-81d5-83b3-ef386d28151d',
  Scenarios: '2c0f2ff0-8d73-81de-8b0f-ff067d7ef711',
  'Scenario Variations': '2c0f2ff0-8d73-819b-a8bf-eb156b794a4a',
  'Needed Research': '2c0f2ff0-8d73-81a2-b590-d66e6d29acef',
  'Active Data': '2c0f2ff0-8d73-811c-ba64-d1e24d985d20',
  'Agent Scope Database': '2c0f2ff0-8d73-81e5-9b08-e82cd55d546d',
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
