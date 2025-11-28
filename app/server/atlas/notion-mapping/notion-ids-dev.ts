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
  Scopes: '2b9f2ff0-8d73-8142-ae79-e1e10cf79930',
  Articles: '2b9f2ff0-8d73-813e-9fbc-c735e8134dc8',
  'Sections & Primary Docs': '2b9f2ff0-8d73-8127-8853-c8e5a4b02c20',
  Annotations: '2b9f2ff0-8d73-8101-88e2-fda7f79eaa31',
  Tenets: '2b9f2ff0-8d73-8179-8fb7-d0a77ce8fad1',
  Scenarios: '2b9f2ff0-8d73-81bc-be7b-cae96ee82687',
  'Scenario Variations': '2b9f2ff0-8d73-8179-972c-d7da87b163d9',
  'Needed Research': '2b9f2ff0-8d73-81d3-bd49-e8b550fa4cd9',
  'Active Data': '2b9f2ff0-8d73-81c7-a969-c3b3170ecbc6',
  'Agent Scope Database': '2b9f2ff0-8d73-815a-824f-cd0ea30496fa',
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
