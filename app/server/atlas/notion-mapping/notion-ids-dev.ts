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
  Scopes: '2b8f2ff0-8d73-810d-a661-c96e3f681461',
  Articles: '2b8f2ff0-8d73-8145-bb79-ecbae23389b8',
  'Sections & Primary Docs': '2b8f2ff0-8d73-81dc-9a7c-eec612286944',
  Annotations: '2b8f2ff0-8d73-81c1-ab23-dad2d14ad9a4',
  Tenets: '2b8f2ff0-8d73-81d6-9400-f86c5015840c',
  Scenarios: '2b8f2ff0-8d73-817d-82bf-cca382596f83',
  'Scenario Variations': '2b8f2ff0-8d73-8113-adfa-f32411de7bb9',
  'Needed Research': '2b8f2ff0-8d73-81b0-8970-f63ea80e4b29',
  'Active Data': '2b8f2ff0-8d73-812e-a866-d3f0f1a361e7',
  'Agent Scope Database': '2b8f2ff0-8d73-8167-976c-d0577ace0076',
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
