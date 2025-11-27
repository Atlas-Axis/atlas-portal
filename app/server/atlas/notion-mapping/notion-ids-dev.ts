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
  Scopes: '2b8f2ff0-8d73-81a3-8bd3-ff953bdfd8ab',
  Articles: '2b8f2ff0-8d73-81cf-98bd-db80aac57ad9',
  'Sections & Primary Docs': '2b8f2ff0-8d73-81ad-bdaa-d5ba964c1118',
  Annotations: '2b8f2ff0-8d73-8148-b4a4-d128b0a70db8',
  Tenets: '2b8f2ff0-8d73-810c-be35-efd7c9801515',
  Scenarios: '2b8f2ff0-8d73-81d0-935e-efd30be35129',
  'Scenario Variations': '2b8f2ff0-8d73-81f8-9737-cce2049c20d8',
  'Needed Research': '2b8f2ff0-8d73-81a8-a3e8-fab9ccf2196e',
  'Active Data': '2b8f2ff0-8d73-814a-bbcf-f76fbe82fc36',
  'Agent Scope Database': '2b8f2ff0-8d73-81ba-866f-f3b59f91b41e',
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
