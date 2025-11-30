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
  Scopes: '2baf2ff0-8d73-819c-8ab7-dfa75f97950b',
  Articles: '2baf2ff0-8d73-8179-b74e-ee17cd1b055b',
  'Sections & Primary Docs': '2baf2ff0-8d73-81a0-8b18-cadb9c5f346a',
  Annotations: '2baf2ff0-8d73-8155-b6b6-e652cbaf09a7',
  Tenets: '2baf2ff0-8d73-819e-b59f-f48694e46945',
  Scenarios: '2baf2ff0-8d73-81a1-8000-ee5b2bb72de8',
  'Scenario Variations': '2baf2ff0-8d73-812f-ab8f-f122ec493523',
  'Needed Research': '2baf2ff0-8d73-81bc-bb50-f1bb02a8d47c',
  'Active Data': '2baf2ff0-8d73-81a5-8d62-c8f13f1657f9',
  'Agent Scope Database': '2baf2ff0-8d73-81eb-ab1d-c8eb4fc2559d',
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
