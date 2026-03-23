/**
 * Atlas constants used by the portal and export pipeline.
 */
import type { AtlasDocumentType } from './atlas-types';

// Re-export types for backward compatibility
export type { AtlasDatabaseName, AtlasDatabaseID, AtlasDocumentType, MasterStatus } from './atlas-types';

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
 */
export const AGENT_ROOT_DOCUMENT_NAME = 'List Of Prime Agent Artifacts';

/**
 * Central GitHub repository URL for the canonical Atlas markdown file.
 *
 * Repository: https://github.com/sky-ecosystem/next-gen-atlas
 * Branch: main
 * File path: Sky Atlas/Sky Atlas.md
 */
export const ATLAS_MARKDOWN_GITHUB_RAW_URL =
  'https://raw.githubusercontent.com/sky-ecosystem/next-gen-atlas/refs/heads/main/Sky%20Atlas/Sky%20Atlas.md';

/**
 * GitHub API URL for fetching file metadata (including last modified date).
 * Uses the GitHub API to get commit information for the file.
 */
export const ATLAS_MARKDOWN_GITHUB_API_URL =
  'https://api.github.com/repos/sky-ecosystem/next-gen-atlas/commits?path=Sky%20Atlas/Sky%20Atlas.md&per_page=1';
