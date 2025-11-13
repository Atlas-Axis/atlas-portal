#!/usr/bin/env node
/**
 * CLI: Convert GitHub Atlas HTML → flat standardized Atlas JSON (grouped by Atlas database)
 *
 * Description
 * - Reads GitHub Atlas HTML (flat, grouped by GitHub Atlas category) from `.debug-data/atlas-raw-sources/github.html`.
 * - Parses rows for each section, producing FlatDoc items.
 * - Groups results by Atlas database name and writes standardized flat JSON (grouped by Atlas database).
 *
 * Output
 * - `.debug-data/standardized-atlas/flat/atlas-github-standardized-flat.json`
 *
 * Usage
 * ```bash
 * npx tsx scripts/atlas-json/old/flat/convert-github-atlas-to-flat-standardized-atlas-json.ts
 * ```
 */
import fs from 'fs';
import { JSDOM } from 'jsdom';
import path from 'path';
import { ATLAS_DATABASES } from '@/app/server/atlas/constants';

// Minimal flat doc shape compatible with other flat outputs
export type FlatDoc = {
  type: string;
  docNo: string;
  name: string;
  uuid: string | null;
};

// HTML section id → GitHub category label (as used in generate-atlas-json-from-github.ts)
// Each section corresponds to a table in the HTML that lists documents for that category
type SectionConfig = {
  id: string;
  label:
    | 'Scopes'
    | 'Articles'
    | 'Sections & Primary Docs'
    | 'Type Specifications'
    | 'Annotations'
    | 'Tenets'
    | 'Scenarios'
    | 'Scenario Variations'
    | 'Needed Research'
    | 'Active Data'
    | 'Agent Scope Database';
};

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

// Map GitHub category label → Atlas database name for standardized grouping
// Note: "Type Specifications" are folded into "Sections & Primary Docs" in our standardized view
const CATEGORY_TO_DATABASE: Record<SectionConfig['label'], string> = {
  Scopes: ATLAS_DATABASES.SCOPES,
  Articles: ATLAS_DATABASES.ARTICLES,
  'Sections & Primary Docs': ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS,
  'Type Specifications': ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS, // fold into Sections & Primary Docs
  Annotations: ATLAS_DATABASES.ANNOTATIONS,
  Tenets: ATLAS_DATABASES.TENETS,
  Scenarios: ATLAS_DATABASES.SCENARIOS,
  'Scenario Variations': ATLAS_DATABASES.SCENARIO_VARIATIONS,
  'Needed Research': ATLAS_DATABASES.NEEDED_RESEARCH,
  'Active Data': ATLAS_DATABASES.ACTIVE_DATA,
  'Agent Scope Database': ATLAS_DATABASES.AGENTS,
};

// Utilities copied/adapted from generate-atlas-json-from-github.ts
// Extract trimmed text from an element safely (works with null/undefined)
function toText(el: Element | null | undefined): string {
  if (!el) return '';
  return (el.textContent ?? '').trim();
}

// Normalize header text for robust matching (lowercase, single spaces)
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/\s+/g, ' ').trim();
}

// Identify the column indexes for doc no, name, type, and content (with fallbacks)
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

  // Fallbacks align with common table structure: Doc No | Name | Type | Content
  const fallbackDocNo = docNoIdx >= 0 ? docNoIdx : 0;
  const fallbackName = nameIdx >= 0 ? nameIdx : 1;
  const fallbackType = typeIdx >= 0 ? typeIdx : Math.max(2, headers.length - 2);
  const fallbackContent = contentIdx >= 0 ? contentIdx : Math.min(headers.length - 1, 3);

  return { docNo: fallbackDocNo, name: fallbackName, type: fallbackType, content: fallbackContent };
}

// Parse one category table into FlatDoc rows
function parseSection(document: Document, sectionId: string): FlatDoc[] {
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

  const rows: FlatDoc[] = [];
  for (const row of dataRows) {
    const cells = Array.from(row.querySelectorAll('td'));
    if (cells.length === 0) continue;

    // Doc number is typically in the first column; fall back to <dfn> if needed
    let docNo = toText(cells[indexes.docNo] as Element).replace(/\s+/g, ' ');
    if (!docNo) {
      const dfn = cells[0]?.querySelector('dfn');
      docNo = toText(dfn as Element);
    }

    // Name and Type columns
    const name = toText(cells[indexes.name] as Element);
    const typeText = toText(cells[indexes.type] as Element);

    // Skip obviously empty rows
    if (!name && !typeText) continue;

    rows.push({ type: typeText || '', docNo, name, uuid: null });
  }
  return rows;
}

async function main() {
  // Input/Output paths are fixed for this converter
  const repoRoot = process.cwd();
  const inputPath = path.join(repoRoot, '.debug-data', 'atlas-raw-sources', 'github.html');
  const outputDir = path.join(repoRoot, '.debug-data', 'standardized-atlas', 'flat');
  const outputPath = path.join(outputDir, 'atlas-github-standardized-flat.json');

  // Ensure source exists
  if (!fs.existsSync(inputPath)) {
    console.error(`Input HTML not found: ${inputPath}`);
    process.exit(1);
  }

  // Load and parse HTML
  const html = fs.readFileSync(inputPath, 'utf8');
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // Group parsed rows by standardized Atlas database name
  const grouped = new Map<string, FlatDoc[]>();

  for (const { id, label } of SECTION_CONFIGS) {
    const dbName = CATEGORY_TO_DATABASE[label];
    const list = parseSection(document, id);
    if (!grouped.has(dbName)) grouped.set(dbName, []);
    grouped.get(dbName)!.push(...list);
  }

  // Serialize and write output
  const groupedObject = Object.fromEntries(grouped);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(groupedObject, null, 2), 'utf8');
  console.log(`Wrote flat grouped JSON to: ${outputPath}`);

  // Summary logging
  const totalDocs = Object.values(groupedObject).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
  const dbNames = Object.keys(groupedObject).sort();
  console.log(`Total documents flattened: ${totalDocs}`);
  console.log(`Databases (${dbNames.length}): ${dbNames.join(', ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
