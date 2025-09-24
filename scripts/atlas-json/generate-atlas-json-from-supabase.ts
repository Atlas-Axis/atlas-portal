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
 *   npx tsx scripts/atlas-json/generate-atlas-json-from-supabase.ts [--validAt <ISO_DATE>]
 *
 * EXAMPLE:
 *   npx tsx scripts/atlas-json/generate-atlas-json-from-supabase.ts --validAt 2025-01-15T12:00:00Z
 *
 * WHAT IT DOES:
 * - Loads Atlas pages for all databases defined in AtlasDatabaseName
 *   (note: 'Type Specifications' are excluded upstream and will be empty)
 * - Maps each page to AtlasCategoryJson objects, categorizing them into an array of AtlasDocumentJson objects
 * - Writes output to .debug-data/atlas-json-generated/supabase-github.json
 *
 * OUTPUT:
 * - scripts/atlas-json/.output/supabase-github.json (Array<AtlasDocumentJson>)
 *   { type, name, content, uuid }
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
import { ATLAS_JSON_OUTPUT_DIR, ATLAS_JSON_OUTPUT_FILE_SUPABASE } from './constants';
import { AtlasCategoryJson, AtlasDocumentJson } from './types';
import { compareDocNumbers, fixDocumentNumberPrefix } from './utils';

// Toggle verbose logs with DEBUG_LOGGING=1
const DEBUG_LOGGING = Boolean(Number(process.env.DEBUG_LOGGING));

// Resolve output path (assumes running from repository root)
const REPO_ROOT = process.cwd();
const OUTPUT_DIR = path.join(REPO_ROOT, ATLAS_JSON_OUTPUT_DIR);
const OUTPUT_FILE = path.join(OUTPUT_DIR, ATLAS_JSON_OUTPUT_FILE_SUPABASE);

// Convert a Supabase page row to our AtlasDocumentJson shape
function mapPageToJson(row: NotionDatabasePage): AtlasDocumentJson {
  const type = row.atlas_document_type;
  const name = row.plain_text_name ?? '';
  const content = row.plain_text_content ?? '';
  let docNumber = row.atlas_document_number ?? '';
  if (!docNumber && row.canonical_document_title) {
    // Attempt to derive from canonical title prefix before first space or dash
    const match = row.canonical_document_title.match(/^[^\s-]+/);
    if (match) docNumber = match[0];
  }
  return { type, docNumber, name, content, uuid: row.notion_page_id };
}

// Entry point function: generate categorized JSON from Supabase Atlas pages
export async function generateAtlasSupabaseJson(): Promise<AtlasCategoryJson[]> {
  // Ensure env vars are loaded for Supabase client
  loadEnv();
  const validAt = parseValidAtArg(process.argv);
  const atlasPagesPerDatabase = validAt
    ? await loadAtlasFromSupabasePastVersion(validAt)
    : await loadAtlasFromSupabase();

  const categories: AtlasCategoryJson[] = [];

  for (const [dbName, pages] of Object.entries(atlasPagesPerDatabase) as [AtlasDatabaseName, NotionDatabasePage[]][]) {
    if ((ATLAS_DATABASES as Record<string, string>)[dbName] === 'Type Specifications') {
      // Skip special case for now
      // TODO: Implement this
      continue;
    }
    const mapped = pages.map(mapPageToJson);
    if (DEBUG_LOGGING) console.log(`${dbName}: ${mapped.length} rows`);
    const fixed = mapped.map((doc) => ({
      ...doc,
      docNumber: fixDocumentNumberPrefix(doc.docNumber, dbName),
    }));
    // Keep consistent ordering by natural doc number comparison
    const sortStart = Date.now();
    fixed.sort((a, b) => compareDocNumbers(a.docNumber, b.docNumber));
    const sortMs = Date.now() - sortStart;
    if (DEBUG_LOGGING) console.log(`Sorted ${fixed.length} documents for "${dbName}" in ${sortMs}ms`);
    categories.push({ type: dbName, documents: fixed });
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(categories, null, 2), 'utf8');
  if (DEBUG_LOGGING) console.log(`Wrote ${categories.length} categories to ${OUTPUT_FILE}`);
  return categories;
}

// CLI execution wrapper
if (require.main === module) {
  (async () => {
    try {
      console.log('Generating supabase-github.json from Supabase...');
      const categories = await generateAtlasSupabaseJson();
      const totalRowCount = categories.reduce((acc, category) => acc + category.documents.length, 0);
      console.log(`Done. Wrote ${totalRowCount} documents (${categories.length} categories) to ${OUTPUT_FILE}`);
    } catch (error) {
      console.error('Failed to generate supabase-github.json:', error);
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
