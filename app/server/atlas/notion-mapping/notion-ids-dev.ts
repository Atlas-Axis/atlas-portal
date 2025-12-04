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
  Scopes: '2bff2ff0-8d73-81d7-8713-ccca1ffb7ac6',
  Articles: '2bff2ff0-8d73-81c0-8d47-c749b6e47264',
  'Sections & Primary Docs': '2bff2ff0-8d73-810e-98d2-d2b56caaff6a',
  Annotations: '2bff2ff0-8d73-810f-9c82-e95ec45e781e',
  Tenets: '2bff2ff0-8d73-81b3-ab35-c83da6630689',
  Scenarios: '2bff2ff0-8d73-8137-847c-da464ba3a871',
  'Scenario Variations': '2bff2ff0-8d73-8153-b2d8-d31c6fe1f44b',
  'Needed Research': '2bff2ff0-8d73-8168-afae-d6a0fb167139',
  'Active Data': '2bff2ff0-8d73-814b-9fe9-c24687b315d2',
  'Agent Scope Database': '2bff2ff0-8d73-8156-8210-c2e809e62634',
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
