#!/usr/bin/env npx tsx
/**
 * Sky Atlas → JSON Generator
 *
 * This script converts the Sky Atlas HTML (GitHub export) into a structured JSON
 * list of AtlasDocumentJson rows. It mirrors the HTML table parsing approach in
 * atlas-github-html-analytics.ts but outputs a machine-friendly JSON file.
 *
 * @see {@link ../../docs/ATLAS_DOCUMENT_NUMBERING_RULES.md} for comprehensive rules and logic for generating document numbers for Atlas documents based on their hierarchy and position within the Atlas structure.
 *
 * USAGE:
 *   npx tsx scripts/atlas-json/old/generate-atlas-json-from-github.ts
 *
 * WHAT IT DOES:
 * - Loads the Atlas HTML from the first available source:
 *   1) .debug-data/github.html (local debug copy)
 *   2) app/server/atlas/Sky Atlas.html (repo copy)
 *   3) Remote GitHub raw URL (fallback)
 * - Parses each section's table rows into categorized AtlasCategoryJson objects, each containing an array of AtlasDocumentJson objects
 * - Writes output to .debug-data/atlas-json-generated/atlas-github.json
 *
 * OUTPUT:
 * - scripts/atlas-json/.output/atlas-github.json (Array<AtlasDocumentJson>)
 *   { type, name, content, uuid }
 */
import { mkdir, readFile, writeFile } from 'fs/promises';
import { JSDOM } from 'jsdom';
import path from 'path';
import { compareDocNumbers } from '@/app/server/atlas/atlas-utils';
import { ATLAS_GITHUB_HTML_URL } from '@/app/server/atlas/constants';
import { AtlasDocumentType, GitHubAtlasDocumentType } from '@/app/server/atlas/constants';
import { fixDocumentNumberPrefix } from '../utils';
import { ATLAS_JSON_OUTPUT_DIR, ATLAS_JSON_OUTPUT_FILE_GITHUB } from './constants';
import { AtlasCategoryJson, AtlasDocumentJson } from './types';

// Toggle verbose logs with DEBUG_LOGGING=1
const DEBUG_LOGGING = Boolean(Number(process.env.DEBUG_LOGGING));

// Resolve paths (assumes running from repository root)
const REPO_ROOT = process.cwd();
const LOCAL_HTML_PATH = path.join(REPO_ROOT, '.debug-data', 'github.html');
const REPO_HTML_PATH = path.join(REPO_ROOT, 'app', 'server', 'services', 'atlas', 'Sky Atlas.html');
const OUTPUT_DIR = path.join(REPO_ROOT, ATLAS_JSON_OUTPUT_DIR);
const OUTPUT_FILE = path.join(OUTPUT_DIR, ATLAS_JSON_OUTPUT_FILE_GITHUB);

// Configuration for mapping HTML section DOM ids to human-readable category labels
type SectionConfig = {
  id: string;
  label: GitHubAtlasDocumentType; // Category label matching GitHubAtlasDocumentType
};

// Section IDs match the HTML file structure
const SECTION_CONFIGS: SectionConfig[] = [
  { id: 'scopes', label: 'Scopes' },
  { id: 'articles', label: 'Articles' },
  { id: 'sections', label: 'Sections & Primary Docs' },
  { id: 'type-specifications', label: 'Type Specifications' },
  { id: 'annotations', label: 'Annotations' },
  { id: 'tenets', label: 'Tenets' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'scenario-variations', label: 'Scenario Variations' },
  { id: 'needed-research', label: 'Needed Research' },
  { id: 'active-data', label: 'Active Data' },
  { id: 'agent-scope', label: 'Agent Scope Database' },
];

// Extract trimmed text content from a DOM element (safe for null/undefined)
function toText(el: Element | null | undefined): string {
  if (!el) return '';
  return (el.textContent ?? '').trim();
}

// Normalize a table header for simpler matching (lowercase, single spaces)
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/\s+/g, ' ').trim();
}

// Detect column indexes for Doc No, Name, Type, and Content with sensible fallbacks
function detectColumnIndexes(headers: string[]): { docNo: number; name: number; type: number; content: number } {
  const normalized = headers.map(normalizeHeader);

  const isDocNoHeader = (h: string) =>
    h === 'doc no' ||
    h === 'doc no.' ||
    h === 'doc no (or temp name)' ||
    h === 'document no' ||
    h === 'document number' ||
    h === 'number' ||
    h === 'doc#' ||
    h === 'id';
  const docNoIdx = normalized.findIndex(isDocNoHeader);
  const nameIdx = normalized.findIndex((h) => h === 'name' || h === 'title');
  const typeIdx = normalized.findIndex((h) => h === 'type');
  const contentIdx = normalized.findIndex((h) => h === 'content' || h === 'description');

  // Fallbacks based on common table structure: Doc No | Name | Type | Content
  const fallbackDocNo = docNoIdx >= 0 ? docNoIdx : 0;
  const fallbackName = nameIdx >= 0 ? nameIdx : 1;
  const fallbackType = typeIdx >= 0 ? typeIdx : Math.max(2, headers.length - 2);
  const fallbackContent = contentIdx >= 0 ? contentIdx : Math.min(headers.length - 1, 3);

  return { docNo: fallbackDocNo, name: fallbackName, type: fallbackType, content: fallbackContent };
}

// Parse a single HTML section table into AtlasDocumentJson[] for a given category
function parseSection(document: Document, sectionId: string, category: GitHubAtlasDocumentType): AtlasDocumentJson[] {
  const sectionDiv = document.getElementById(sectionId);
  if (!sectionDiv) return [];

  const table = sectionDiv.querySelector('table');
  if (!table) return [];

  const headerRow = table.querySelector('tr');
  const headers = Array.from(headerRow?.querySelectorAll('th') || []).map((th) => toText(th));

  const indexes = detectColumnIndexes(headers);

  const allRows = Array.from(table.querySelectorAll('tr'));
  const dataRows = allRows.filter(
    (row) => row.querySelectorAll('th').length === 0 && row.querySelectorAll('td').length > 0,
  );

  const rows: AtlasDocumentJson[] = [];

  for (const row of dataRows) {
    const cells = Array.from(row.querySelectorAll('td'));
    if (cells.length === 0) continue;

    let docNumber = toText(cells[indexes.docNo] as Element).replace(/\s+/g, ' ');
    if (!docNumber) {
      // Fallback: try to read <dfn> inside first cell
      const dfn = cells[0]?.querySelector('dfn');
      docNumber = toText(dfn as Element);
    }
    docNumber = fixDocumentNumberPrefix(docNumber, category);
    const name = toText(cells[indexes.name] as Element);
    const typeText = toText(cells[indexes.type] as Element);
    const content = toText(cells[indexes.content] as Element);

    // Skip empty rows
    if (!name && !typeText && !content) continue;

    const type = (typeText || 'Placeholder') as AtlasDocumentType;

    rows.push({
      type,
      generatedDocNumber: '',
      originalDocNumber: docNumber,
      name,
      content,
      uuid: null,
      inactive: false,
    });
  }

  return rows;
}

// Parse all configured sections and return AtlasCategoryJson[] (categorized documents)
function parseAll(html: string): AtlasCategoryJson[] {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const categories: AtlasCategoryJson[] = [];
  for (const { id, label } of SECTION_CONFIGS) {
    const rows = parseSection(document, id, label);
    if (DEBUG_LOGGING) console.log(`#${id}: ${rows.length} rows`);
    // Sort within category using natural doc number ordering
    const sortStart = Date.now();
    rows.sort((a, b) => compareDocNumbers(a.originalDocNumber, b.originalDocNumber));
    const sortMs = Date.now() - sortStart;
    if (DEBUG_LOGGING) console.log(`Sorted ${rows.length} documents for "${label}" in ${sortMs}ms`);
    categories.push({ type: label, documents: rows });
  }
  return categories;
}

// Entry point function: generate categorized JSON from GitHub HTML
export async function generateAtlasGithubJson(): Promise<AtlasCategoryJson[]> {
  // Try sources in order: local debug, repo HTML, GitHub
  const sources: { name: string; loader: () => Promise<string> }[] = [
    { name: 'local', loader: async () => await readFile(LOCAL_HTML_PATH, 'utf8') },
    { name: 'repo', loader: async () => await readFile(REPO_HTML_PATH, 'utf8') },
    {
      name: 'github',
      loader: async () => {
        const resp = await fetch(ATLAS_GITHUB_HTML_URL);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        return await resp.text();
      },
    },
  ];

  let allRows: AtlasCategoryJson[] = [];
  let usedSource = '';
  for (const src of sources) {
    try {
      const html = await src.loader();
      const rows = parseAll(html);
      if (rows.length > 0) {
        usedSource = src.name;
        allRows = rows;
        break;
      }
    } catch (e) {
      if (DEBUG_LOGGING) console.warn(`Failed to load ${src.name} source:`, e);
    }
  }

  if (DEBUG_LOGGING) console.log(`Using source: ${usedSource || 'none (0 rows)'}`);

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(allRows, null, 2), 'utf8');
  if (DEBUG_LOGGING) console.log(`Wrote ${allRows.length} documents (${allRows.length} categories) to ${OUTPUT_FILE}`);
  return allRows;
}

// CLI execution wrapper
if (require.main === module) {
  (async () => {
    try {
      console.log('Generating atlas-github.json from Sky Atlas HTML...');
      const categories = await generateAtlasGithubJson();
      const totalRowCount = categories.reduce((acc, category) => acc + category.documents.length, 0);
      console.log(`Done. Wrote ${totalRowCount} documents (${categories.length} categories) to ${OUTPUT_FILE}`);
    } catch (error) {
      console.error('Failed to generate atlas-github.json:', error);
      process.exit(1);
    }
  })();
}

export type { AtlasDocumentJson };
