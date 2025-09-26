#!/usr/bin/env npx tsx
/**
 * Sky Atlas → JSON Generator (Supabase)
 *
 * This script loads Atlas documents from Supabase and converts them into a
 * structured JSON list of AtlasDocumentJson rows. It mirrors the behavior of
 * generate-atlas-json-from-github.ts, but sources data from Supabase instead
 * of the GitHub HTML export.
 *
 * USAGE:
 *   npx tsx scripts/atlas-json/generate-atlas-json-from-supabase.ts [--validAt <ISO_DATE>] [--skip-agent-scope]
 *
 * FLAGS:
 *   --validAt <ISO_DATE>    Load Atlas data as it existed at a specific point in time
 *   --skip-agent-scope      Omit Atlas documents that are descendants of "Agent Scope Database" but not "Scopes"
 *
 * EXAMPLES:
 *   npx tsx scripts/atlas-json/generate-atlas-json-from-supabase.ts
 *   npx tsx scripts/atlas-json/generate-atlas-json-from-supabase.ts --validAt 2025-01-15T12:00:00Z
 *   npx tsx scripts/atlas-json/generate-atlas-json-from-supabase.ts --skip-agent-scope
 *
 * WHAT IT DOES:
 * - Loads Atlas pages for all databases defined in AtlasDatabaseName
 *   (note: 'Type Specifications' are excluded upstream and will be empty)
 * - Maps each page to AtlasCategoryJson objects, categorizing them into an array of AtlasDocumentJson objects
 * - Writes output to .debug-data/atlas-json-generated/atlas-supabase.json, or atlas-supabase-without-agents.json if --skip-agent-scope is used
 *
 * OUTPUT:
 * - .debug-data/atlas-json-generated/atlas-supabase.json (default, includes all documents)
 * - .debug-data/atlas-json-generated/atlas-supabase-without-agents.json (when --skip-agent-scope is used)
 *   Each category contains documents with { type, generatedDocNumber, originalDocNumber, name, content, uuid }
 */
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import type { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { ATLAS_DATABASES, AtlasDatabaseName } from '@/app/server/services/atlas/constants';
import {
  loadAtlasFromSupabase,
  loadAtlasFromSupabasePastVersion,
} from '@/app/server/services/atlas/load-atlas-from-supabase';
import { loadEnv } from '../utils/load-env';
import {
  ATLAS_JSON_OUTPUT_DIR,
  ATLAS_JSON_OUTPUT_FILE_SUPABASE,
  ATLAS_JSON_OUTPUT_FILE_SUPABASE_WITHOUT_AGENTS,
} from './constants';
import { generateDocumentNumbers } from './document-numbering';
import { AtlasCategoryJson, AtlasDocumentJson } from './types';
import { compareDocNumbers, fixDocumentNumberPrefix } from './utils';

// Toggle verbose logs with DEBUG_LOGGING=1
const DEBUG_LOGGING = Boolean(Number(process.env.DEBUG_LOGGING));

// Parse command line arguments
const args = process.argv.slice(2);
const SKIP_AGENT_SCOPE = args.includes('--skip-agent-scope');

// Resolve output path (assumes running from repository root)
const REPO_ROOT = process.cwd();
const OUTPUT_DIR = path.join(REPO_ROOT, ATLAS_JSON_OUTPUT_DIR);

// Choose output file based on whether agent scope filtering is enabled
function getOutputFile(skipAgentScope: boolean): string {
  const filename = skipAgentScope ? ATLAS_JSON_OUTPUT_FILE_SUPABASE_WITHOUT_AGENTS : ATLAS_JSON_OUTPUT_FILE_SUPABASE;
  return path.join(OUTPUT_DIR, filename);
}

// Helper function to get all child IDs from a page's child relationship arrays
function getAllChildIds(page: NotionDatabasePage): string[] {
  const childIds: string[] = [];

  const childArrays = [
    page.child_scope_ids,
    page.child_article_ids,
    page.child_section_and_primary_doc_ids,
    page.child_annotation_ids,
    page.child_tenet_ids,
    page.child_scenario_ids,
    page.child_scenario_variation_ids,
    page.child_active_data_ids,
    page.child_agent_scope_ids,
    page.child_needed_research_ids,
  ];

  for (const childArray of childArrays) {
    if (Array.isArray(childArray)) {
      // Type guard to ensure we only add strings
      for (const childId of childArray) {
        if (typeof childId === 'string') {
          childIds.push(childId);
        }
      }
    }
  }

  return childIds;
}

// Helper function to collect all descendant UUIDs from a set of root pages
function collectDescendantUuids(
  rootPages: NotionDatabasePage[],
  allPagesMap: Map<string, NotionDatabasePage>,
): Set<string> {
  const descendants = new Set<string>();
  const visited = new Set<string>(); // Prevent infinite loops
  const stack = [...rootPages];

  while (stack.length > 0) {
    const currentPage = stack.pop();
    if (!currentPage) continue;

    const pageId = currentPage.notion_page_id;

    // Skip if already visited to prevent infinite loops
    if (visited.has(pageId)) continue;
    visited.add(pageId);

    // Add current page to descendants
    descendants.add(pageId);

    // Get all child IDs and add them to the stack for processing
    const childIds = getAllChildIds(currentPage);
    for (const childId of childIds) {
      const childPage = allPagesMap.get(childId);
      if (childPage && !visited.has(childId)) {
        stack.push(childPage);
      }
    }
  }

  return descendants;
}

// Helper function to create a map of all pages by their UUID
function createPagesMap(
  atlasPagesPerDatabase: Record<AtlasDatabaseName, NotionDatabasePage[]>,
): Map<string, NotionDatabasePage> {
  const pagesMap = new Map<string, NotionDatabasePage>();

  for (const pages of Object.values(atlasPagesPerDatabase)) {
    for (const page of pages) {
      pagesMap.set(page.notion_page_id, page);
    }
  }

  return pagesMap;
}

// Helper function to filter out Agent Scope descendants that are not also Scopes descendants
function filterAgentScopeOnlyDescendants(
  atlasPagesPerDatabase: Record<AtlasDatabaseName, NotionDatabasePage[]>,
  skipAgentScope: boolean,
): Record<AtlasDatabaseName, NotionDatabasePage[]> {
  if (!skipAgentScope) {
    return atlasPagesPerDatabase;
  }

  // Create a map of all pages for efficient lookup
  const allPagesMap = createPagesMap(atlasPagesPerDatabase);

  // Collect descendants of Scopes (root database 1)
  const scopesPages = atlasPagesPerDatabase[ATLAS_DATABASES.SCOPES] || [];
  const scopesDescendants = collectDescendantUuids(scopesPages, allPagesMap);

  // Collect descendants of Agent Scope Database (root database 2)
  const agentScopePages = atlasPagesPerDatabase[ATLAS_DATABASES.AGENTS] || [];
  const agentScopeDescendants = collectDescendantUuids(agentScopePages, allPagesMap);

  // Find UUIDs that are descendants of Agent Scope but NOT descendants of Scopes
  const agentScopeOnlyUuids = new Set<string>();
  for (const uuid of agentScopeDescendants) {
    if (!scopesDescendants.has(uuid)) {
      agentScopeOnlyUuids.add(uuid);
    }
  }

  if (DEBUG_LOGGING) {
    console.log(`Scopes descendants: ${scopesDescendants.size}`);
    console.log(`Agent Scope descendants: ${agentScopeDescendants.size}`);
    console.log(`Agent Scope only descendants (to be filtered): ${agentScopeOnlyUuids.size}`);
  }

  // Filter out Agent Scope only descendants from all databases
  const filteredAtlasPagesPerDatabase: Record<AtlasDatabaseName, NotionDatabasePage[]> = {} as Record<
    AtlasDatabaseName,
    NotionDatabasePage[]
  >;

  let totalOriginalDocuments = 0;
  let totalFilteredDocuments = 0;

  for (const [dbName, pages] of Object.entries(atlasPagesPerDatabase) as [AtlasDatabaseName, NotionDatabasePage[]][]) {
    totalOriginalDocuments += pages.length;
    const filteredPages = pages.filter((page) => !agentScopeOnlyUuids.has(page.notion_page_id));
    filteredAtlasPagesPerDatabase[dbName] = filteredPages;
    totalFilteredDocuments += filteredPages.length;
  }

  // Log the number of documents omitted (only when filtering is actually applied)
  const omittedCount = totalOriginalDocuments - totalFilteredDocuments;
  if (omittedCount > 0) {
    console.log(
      `Agent Scope filtering: omitted ${omittedCount} documents (${totalFilteredDocuments} remaining from ${totalOriginalDocuments} total)`,
    );
  }

  return filteredAtlasPagesPerDatabase;
}

// Convert a Supabase page row to our AtlasDocumentJson shape
function mapPageToJson(row: NotionDatabasePage, generatedDocNumber: string): AtlasDocumentJson {
  const type = row.atlas_document_type;
  const name = row.plain_text_name ?? '';
  const content = row.plain_text_content ?? '';
  let originalDocNumber = row.atlas_document_number ?? '';
  if (!originalDocNumber && row.canonical_document_title) {
    // Attempt to derive from canonical title prefix before first space or dash
    const match = row.canonical_document_title.match(/^[^\s-]+/);
    if (match) originalDocNumber = match[0];
  }
  return {
    type,
    generatedDocNumber,
    originalDocNumber,
    name,
    content,
    uuid: row.notion_page_id,
    inactive: false,
  };
}

// Entry point function: generate categorized JSON from Supabase Atlas pages
export async function generateAtlasSupabaseJson(
  skipAgentScope = false,
): Promise<{ categories: AtlasCategoryJson[]; outputFile: string }> {
  // Ensure env vars are loaded for Supabase client
  loadEnv();
  const validAt = parseValidAtArg(process.argv);
  let atlasPagesPerDatabase = validAt ? await loadAtlasFromSupabasePastVersion(validAt) : await loadAtlasFromSupabase();

  // Validate that we have some data to work with
  const totalPages = Object.values(atlasPagesPerDatabase).reduce((sum, pages) => sum + pages.length, 0);
  if (totalPages === 0) {
    console.warn('Warning: No Atlas pages found in Supabase. Output will be empty.');
  }

  // Filter out Agent Scope only descendants if requested
  atlasPagesPerDatabase = filterAgentScopeOnlyDescendants(atlasPagesPerDatabase, skipAgentScope);

  // Generate document numbers based on Atlas Document Numbering Rules
  if (DEBUG_LOGGING) console.log('Generating document numbers based on Atlas Document Numbering Rules...');
  const generatedNumbers = generateDocumentNumbers(atlasPagesPerDatabase);
  if (DEBUG_LOGGING) console.log(`Generated ${generatedNumbers.size} document numbers`);

  const categories: AtlasCategoryJson[] = [];

  for (const [dbName, pages] of Object.entries(atlasPagesPerDatabase) as [AtlasDatabaseName, NotionDatabasePage[]][]) {
    // Skip empty databases
    if (!pages || pages.length === 0) {
      if (DEBUG_LOGGING) console.log(`${dbName}: 0 rows (skipped)`);
      categories.push({ type: dbName, documents: [] });
      continue;
    }

    // Map pages to JSON format with generated document numbers
    const mapped = pages.map((page) => {
      const generatedDocNumber = generatedNumbers.get(page.notion_page_id) || '';
      return mapPageToJson(page, generatedDocNumber);
    });

    if (DEBUG_LOGGING) console.log(`${dbName}: ${mapped.length} rows`);

    // Apply document number prefix fixes and sort
    const fixed = mapped.map((doc) => ({
      ...doc,
      originalDocNumber: fixDocumentNumberPrefix(doc.originalDocNumber, dbName),
    }));

    // Keep consistent ordering by natural doc number comparison
    const sortStart = Date.now();
    fixed.sort((a, b) => compareDocNumbers(a.originalDocNumber, b.originalDocNumber));
    const sortMs = Date.now() - sortStart;
    if (DEBUG_LOGGING) console.log(`Sorted ${fixed.length} documents for "${dbName}" in ${sortMs}ms`);

    categories.push({ type: dbName, documents: fixed });
  }

  const outputFile = getOutputFile(skipAgentScope);
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(outputFile, JSON.stringify(categories, null, 2), 'utf8');
  if (DEBUG_LOGGING) console.log(`Wrote ${categories.length} categories to ${outputFile}`);
  return { categories, outputFile };
}

// CLI execution wrapper
if (require.main === module) {
  (async () => {
    try {
      const outputFileName = SKIP_AGENT_SCOPE ? 'atlas-supabase-without-agents.json' : 'atlas-supabase.json';
      if (SKIP_AGENT_SCOPE) {
        console.log(`Generating ${outputFileName} from Supabase (skipping Agent Scope only descendants)...`);
      } else {
        console.log(`Generating ${outputFileName} from Supabase...`);
      }
      const result = await generateAtlasSupabaseJson(SKIP_AGENT_SCOPE);
      const totalRowCount = result.categories.reduce((acc, category) => acc + category.documents.length, 0);
      console.log(
        `Done. Wrote ${totalRowCount} documents (${result.categories.length} categories) to ${result.outputFile}`,
      );
    } catch (error) {
      const outputFileName = SKIP_AGENT_SCOPE ? 'atlas-supabase-without-agents.json' : 'atlas-supabase.json';
      console.error(`Failed to generate ${outputFileName}:`, error);
      process.exit(1);
    }
  })();
}

// Parse --validAt flag (supports --validAt=... or --validAt ...)
function parseValidAtArg(argv: string[]): string | null {
  // Support both --validAt=... and --validAt ... forms
  const withEquals = argv.find((a) => a.startsWith('--validAt='));
  if (withEquals) {
    const value = withEquals.split('=')[1]?.trim();
    return validateIsoDateOrThrow(value);
  }

  const flagIndex = argv.indexOf('--validAt');
  if (flagIndex !== -1 && argv.length > flagIndex + 1) {
    const value = argv[flagIndex + 1]?.trim();
    if (!value || value.startsWith('--')) return null;
    return validateIsoDateOrThrow(value);
  }

  return null;
}

// Validate ISO 8601 UTC date (YYYY-MM-DDTHH:mm:ssZ), throw on invalid
function validateIsoDateOrThrow(value?: string): string | null {
  if (!value) return null;
  // Basic ISO 8601 instant validation: YYYY-MM-DDTHH:mm:ssZ
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
  if (!isoRegex.test(value)) {
    const message = `Invalid --validAt value: "${value}". Expected ISO 8601 UTC format like 2025-01-15T12:00:00Z`;
    console.error(message);
    throw new Error(message);
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    const message = `Invalid --validAt value: "${value}". Could not parse date. Example: 2025-01-15T12:00:00Z`;
    console.error(message);
    throw new Error(message);
  }
  // Normalize to exact string; allow value that parses exactly to the same instant
  // We don't strictly enforce exact string match to avoid timezone quirks; the regex enforces Z-terminated UTC
  return value;
}
