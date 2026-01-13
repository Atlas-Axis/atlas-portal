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
  Scopes: '2e7f2ff0-8d73-81d3-8c13-f46e73bdce2d',
  Articles: '2e7f2ff0-8d73-815c-a88c-c4ed8790e5b2',
  'Sections & Primary Docs': '2e7f2ff0-8d73-8182-8dcb-e15c5ae244da',
  Annotations: '2e7f2ff0-8d73-817d-967d-fbccbec6cb47',
  Tenets: '2e7f2ff0-8d73-81aa-9b27-d0ac81e84218',
  Scenarios: '2e7f2ff0-8d73-8153-aa63-d8b244af62ca',
  'Scenario Variations': '2e7f2ff0-8d73-81fd-bf7b-e62702e02399',
  'Needed Research': '2e7f2ff0-8d73-814d-a2c0-d655ecee51e4',
  'Active Data': '2e7f2ff0-8d73-81e5-a4ef-c8d54c86ae1b',
  'Agent Scope Database': '2e7f2ff0-8d73-81da-be75-e1a6669013a0',
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
