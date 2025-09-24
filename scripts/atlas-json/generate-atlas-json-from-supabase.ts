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
 * - Maps each page to { type, name, content, uuid }
 * - Writes output to scripts/atlas-json/.output/supabase-github.json
 *
 * OUTPUT:
 * - scripts/atlas-json/.output/supabase-github.json (Array<AtlasDocumentJson>)
 *   { type, name, content, uuid }
 */
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import type { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { AtlasDatabaseName, AtlasDocumentType } from '@/app/server/services/atlas/constants';
import {
  loadAtlasFromSupabase,
  loadAtlasFromSupabasePastVersion,
} from '@/app/server/services/atlas/load-atlas-from-supabase';
import { loadEnv } from '../utils/load-env';
import { AtlasDocumentJson } from './types';

const DEBUG_LOGGING = Boolean(Number(process.env.DEBUG_LOGGING));

// Assume script is run from repository root (parent of "scripts")
const REPO_ROOT = process.cwd();
const OUTPUT_DIR = path.join(REPO_ROOT, 'scripts', 'atlas-json', '.output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'supabase-github.json');

function mapPageToJson(row: NotionDatabasePage): AtlasDocumentJson {
  const type = row.atlas_document_type;
  const name = row.plain_text_name ?? '';
  const content = row.plain_text_content ?? '';
  return { type, name, content, uuid: row.notion_page_id };
}

export async function generateAtlasSupabaseJson(): Promise<AtlasDocumentJson[]> {
  // Ensure env vars are loaded for Supabase client
  loadEnv();
  const validAt = parseValidAtArg(process.argv);
  const atlasPagesPerDatabase = validAt
    ? await loadAtlasFromSupabasePastVersion(validAt)
    : await loadAtlasFromSupabase();

  let results: AtlasDocumentJson[] = [];

  for (const [dbName, pages] of Object.entries(atlasPagesPerDatabase) as [AtlasDatabaseName, NotionDatabasePage[]][]) {
    const mapped = pages.map(mapPageToJson);
    if (DEBUG_LOGGING) console.log(`${dbName}: ${mapped.length} rows`);
    results = results.concat(mapped);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf8');
  if (DEBUG_LOGGING) console.log(`Wrote ${results.length} documents to ${OUTPUT_FILE}`);
  return results;
}

// Main execution
if (require.main === module) {
  (async () => {
    try {
      console.log('Generating supabase-github.json from Supabase...');
      const rows = await generateAtlasSupabaseJson();
      console.log(`Done. Wrote ${rows.length} documents to ${OUTPUT_FILE}`);
    } catch (error) {
      console.error('Failed to generate supabase-github.json:', error);
      process.exit(1);
    }
  })();
}

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
