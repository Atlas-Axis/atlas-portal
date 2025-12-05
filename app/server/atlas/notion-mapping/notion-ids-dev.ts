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
  Scopes: '2c0f2ff0-8d73-8146-9a8f-d84e96798267',
  Articles: '2c0f2ff0-8d73-81ab-83bc-d8d10612a038',
  'Sections & Primary Docs': '2c0f2ff0-8d73-811c-8cd2-e3d31ec83d6d',
  Annotations: '2c0f2ff0-8d73-819b-b3a2-e9f598e34ba6',
  Tenets: '2c0f2ff0-8d73-811e-b2fd-dffbe9c70ae4',
  Scenarios: '2c0f2ff0-8d73-81d8-a78e-f9ea842c5b2b',
  'Scenario Variations': '2c0f2ff0-8d73-8122-90ff-d439879afca2',
  'Needed Research': '2c0f2ff0-8d73-814f-8ffd-ef32eeb4b2df',
  'Active Data': '2c0f2ff0-8d73-816f-a6df-f2042ef1d427',
  'Agent Scope Database': '2c0f2ff0-8d73-8167-83d6-c9e39de2ae53',
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
