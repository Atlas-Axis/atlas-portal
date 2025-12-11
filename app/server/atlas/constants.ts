// export type AtlasDatabaseName = (typeof ATLAS_DATABASE_NAMES)[number];
/**
 * Conditionally import Notion IDs based on environment
 *
 * This module imports Notion-specific identifiers (database IDs, status IDs, agent UUIDs)
 * from one of three files based on the current environment:
 * - notion-ids.ts: Real production Notion IDs
 * - notion-ids-dev.ts: Notion IDs for development and manual QA environments
 * - notion-ids-unit-test.ts: Made-up UUIDs for unit tests
 *
 * Environment Selection Logic (in priority order):
 * 1. Uses notion-ids-unit-test.ts (made-up UUIDs) when: running in unit tests (isTestEnv() === true)
 * 2. Uses notion-ids-dev.ts (dev IDs) when: NODE_ENV !== 'production'
 * 3. Uses notion-ids.ts (production IDs) when: NODE_ENV === 'production'
 *
 * Benefits:
 * - Unit tests use consistent made-up UUIDs that don't require real credentials
 * - Development/QA automatically uses separate IDs to prevent accidental production data access
 * - Production uses real production Notion IDs
 */
import { isTestEnv } from '../../shared/utils/is-test-env';
import type { AtlasDatabaseID, AtlasDatabaseName, AtlasDocumentType, MasterStatus } from './atlas-types';
import * as notionIds from './notion-mapping/notion-ids';
import * as notionIdsDev from './notion-mapping/notion-ids-dev';
import * as notionIdsUnitTest from './notion-mapping/notion-ids-unit-test';

// Re-export types for backward compatibility
export type { AtlasDatabaseName, AtlasDatabaseID, AtlasDocumentType, MasterStatus };

export const ATLAS_DOCUMENT_TYPES: AtlasDocumentType[] = [
  'Section',
  'Core',
  'Type Specification',
  'Active Data Controller',
  'Action Tenet',
  'Active Data',
  'Annotation',
  'Scope',
  'Article',
  'Scenario',
  'Scenario Variation',
  'Needed Research',
] as const;

export const ATLAS_DATABASES = {
  SCOPES: 'Scopes',
  ARTICLES: 'Articles',
  SECTIONS_AND_PRIMARY_DOCS: 'Sections & Primary Docs',
  ANNOTATIONS: 'Annotations',
  TENETS: 'Tenets',
  SCENARIOS: 'Scenarios',
  SCENARIO_VARIATIONS: 'Scenario Variations',
  NEEDED_RESEARCH: 'Needed Research',
  ACTIVE_DATA: 'Active Data',
  AGENTS: 'Agent Scope Database',
} as const;

export const ATLAS_DATABASE_NAMES: AtlasDatabaseName[] = [
  ATLAS_DATABASES.SCOPES,
  ATLAS_DATABASES.ARTICLES,
  ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS,
  ATLAS_DATABASES.ANNOTATIONS,
  ATLAS_DATABASES.TENETS,
  ATLAS_DATABASES.SCENARIOS,
  ATLAS_DATABASES.SCENARIO_VARIATIONS,
  ATLAS_DATABASES.NEEDED_RESEARCH,
  ATLAS_DATABASES.ACTIVE_DATA,
  ATLAS_DATABASES.AGENTS,
] as const;

// Priority order: unit tests > development (NODE_ENV !== 'production') > production
const selectedIds = isTestEnv() ? notionIdsUnitTest : process.env.NODE_ENV !== 'production' ? notionIdsDev : notionIds;

export const ATLAS_DATABASE_ID_MAP = selectedIds.ATLAS_DATABASE_ID_MAP;
export const ATLAS_DATABASE_ID_MAP_REVERSED = selectedIds.ATLAS_DATABASE_ID_MAP_REVERSED;
export const MASTER_STATUS_ID_MAP = selectedIds.MASTER_STATUS_ID_MAP;

export const MASTER_STATUSES = {
  APPROVED: 'Approved',
  PROVISIONAL: 'Provisional',
  PLACEHOLDER: 'Placeholder',
  DEFERRED: 'Deferred',
  ARCHIVED: 'Archived',
};

/**
 * Hard-coded document name used to identify Agent Scope Database context during markdown import.
 *
 * PURPOSE: The markdown importer (`atlas-markdown-importer.ts`) uses this constant in
 * `mapTypeToDatabase()` to detect whether a Core or Active Data Controller document
 * belongs to Agent Scope Database or Sections & Primary Docs.
 *
 * DETECTION LOGIC: A Core/ADC document belongs to Agent Scope Database if:
 * 1. Its immediate parent's name matches AGENT_ROOT_DOCUMENT_NAME, OR
 * 2. Any ancestor in the chain is from Agent Scope Database
 * Otherwise, it belongs to Sections & Primary Docs.
 *
 * WHY NAME-BASED: The markdown importer parses incrementally line-by-line and must
 * immediately decide which collection to insert each document into during parsing.
 * This requires checking the immediate parent's name for the initial decision.
 *
 * SCOPE: This constant is ONLY used during markdown import. Once documents are in
 * Export Tree format, their database is encoded as collection names. The sync library
 * and diff algorithms do NOT use this constant - they read collection names directly.
 */
export const AGENT_ROOT_DOCUMENT_NAME = 'List Of Prime Agent Artifacts';

export const IMPORT_DATABASES: AtlasDatabaseName[] = [
  ATLAS_DATABASES.SCOPES,
  ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS,
  ATLAS_DATABASES.AGENTS,
  ATLAS_DATABASES.ANNOTATIONS,
  ATLAS_DATABASES.TENETS,
  ATLAS_DATABASES.ACTIVE_DATA,
  ATLAS_DATABASES.SCENARIOS,
  ATLAS_DATABASES.SCENARIO_VARIATIONS,
  ATLAS_DATABASES.NEEDED_RESEARCH,
  ATLAS_DATABASES.ARTICLES, // Moved to last (slowest to sync)
] as const;

/**
 * Central GitHub repository URL for the canonical Atlas markdown file.
 *
 * This is the source of truth for the Markdown → Notion sync workflow.
 * External contributors edit this file in GitHub, and changes are synced back to Notion.
 *
 * Repository: https://github.com/pppdns/next-gen-atlas
 * Branch: main
 * File path: Sky Atlas/Sky Atlas.md
 */
export const ATLAS_MARKDOWN_GITHUB_RAW_URL =
  'https://raw.githubusercontent.com/pppdns/next-gen-atlas/refs/heads/main/Sky%20Atlas/Sky%20Atlas.md';

/**
 * GitHub API URL for fetching file metadata (including last modified date).
 * Uses the GitHub API to get commit information for the file.
 */
export const ATLAS_MARKDOWN_GITHUB_API_URL =
  'https://api.github.com/repos/pppdns/next-gen-atlas/commits?path=Sky%20Atlas/Sky%20Atlas.md&per_page=1';

/**
 * Standardized Notion property names used across all Atlas databases.
 *
 * These properties were introduced during the Notion Property Standardization initiative
 * to replace inconsistent database-specific property names with unified fields.
 *
 * OLD (database-specific):
 * - Document Number: "Doc No", "Doc No (or Temp Name)", "Formal Doc ID", etc.
 * - Document Title: "Name", "Doc No (or Temp Name)", "Title", etc.
 *
 * NEW (standardized):
 * - Document Number: "Document Number" (rich_text) across all databases
 * - Document Title: "Document Title" (rich_text) across all databases
 *
 * MIGRATION STRATEGY:
 * - Phase 1-3: Dual-write (write to both old and new fields) and dual-read (prefer new, fallback to old)
 * - Phase 4-6: Eventually deprecate old fields after full migration
 *
 * See: docs/action-plans/NOTION_PROPERTY_STANDARDIZATION_ACTION_PLAN.md
 */
export const STANDARDIZED_DOCUMENT_NUMBER = 'Document Number';
export const STANDARDIZED_DOCUMENT_TITLE = 'Document Title';
