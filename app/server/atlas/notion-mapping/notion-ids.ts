/**
 * Hard-coded Notion database IDs and other Notion-specific identifiers
 *
 * This file contains all Notion-specific IDs that reference actual Notion databases,
 * pages, and properties. These are environment-specific and may differ between
 * development and production environments.
 */
import type { AtlasDatabaseName } from '../atlas-types';

/**
 * Maps Atlas database names to their corresponding Notion database IDs
 * NOTE: Keys use string literals instead of ATLAS_DATABASES constants to avoid circular dependency
 */
export const ATLAS_DATABASE_ID_MAP: Record<AtlasDatabaseName, string> = {
  Scopes: 'ebdb403a44bd4d169ec8f9330e955247',
  Articles: '15e06a0d07364458a5caeb85d7b54408',
  'Sections & Primary Docs': '06d1d4fa1cc44e88a06559d4082163a8',
  Annotations: 'e147e8835a2143c38264e86b1d9b24fc',
  Tenets: '7fcbad225c524dffa20cd4efb2e13b56',
  Scenarios: '8a05694599194c3ca8c8ee1b86086837',
  'Scenario Variations': 'd0de59236e6d4a48a44533fa64d966ac',
  'Needed Research': 'effd5738033548a98ec1a7e99cbadd1d',
  'Active Data': '5b566dd732464927b8eee6e1b2ff99d9',
  'Agent Scope Database': '1bbf2ff08d73808d9ce3e2122857e262',
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
  Archived: '434486e6-0d5e-4541-9f00-40cb9bd67d1c',
  Deferred: 'f38bf53d-96bd-4345-a403-c6629ed202a1',
  Approved: 'fe75a64f-585b-4d08-af00-ef8667d9c307',
  Provisional: '3dbb9d9c-fd63-462b-99f3-1ce879f16768',
  Placeholder: '3edf54e3-be0e-4bbb-b008-502cfc23394e',
};
