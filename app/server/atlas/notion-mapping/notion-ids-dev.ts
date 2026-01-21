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
  Scopes: '2e7f2ff0-8d73-81fd-87f3-fb6b9ed04cba',
  Articles: '2e7f2ff0-8d73-8153-9b9f-c75c6444394e',
  'Sections & Primary Docs': '2e7f2ff0-8d73-81bb-ab60-e87a364b1ee5',
  Annotations: '2e7f2ff0-8d73-817d-a46d-e4d74c80d1aa',
  Tenets: '2e7f2ff0-8d73-8111-9d4a-fb1453516e06',
  Scenarios: '2e7f2ff0-8d73-8132-beab-c3d3e30231fb',
  'Scenario Variations': '2e7f2ff0-8d73-81f9-9134-f705bccc2645',
  'Needed Research': '2e7f2ff0-8d73-81c7-8c32-d514082fc137',
  'Active Data': '2e7f2ff0-8d73-81fe-a5b1-c29e564f5aff',
  'Agent Scope Database': '2e7f2ff0-8d73-8138-95d9-e7bf787e3855',
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
