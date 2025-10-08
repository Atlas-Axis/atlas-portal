#!/usr/bin/env npx tsx
/**
 * Sky Atlas → JSON Generator (Blue JSON)
 *
 * This script reads a hierarchical Blue JSON export of the Atlas from
 * .debug-data/blue.json, flattens it into documents, categorizes them, and
 * writes a machine-friendly categorized JSON file.
 *
 * USAGE:
 * @example
 *   npx tsx scripts/atlas-json/old/generate-atlas-json-from-blue-json.ts
 *   npx tsx scripts/atlas-json/old/generate-atlas-json-from-blue-json.ts --keep-inactives
 *
 * FLAGS:
 *   --keep-inactives    Include inactive nodes in the output (default: skip them)
 *
 * WHAT IT DOES:
 * - Loads .debug-data/blue.json (hierarchical)
 * - Flattens to documents with fields: { type, generatedDocNumber, originalDocNumber, name, content, uuid }
 * - Groups documents into AtlasCategoryJson[] by category
 * - Writes output to .debug-data/atlas-json-generated/atlas-blue.json
 *
 * OUTPUT:
 * - scripts constant ATLAS_JSON_OUTPUT_FILE_BLUE controls filename
 */
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { compareDocNumbers } from '@/app/server/atlas/atlas-utils';
import {
  ATLAS_DATABASES,
  AtlasDatabaseName,
  AtlasDocumentType,
  GitHubAtlasDocumentType,
} from '@/app/server/atlas/constants';
import { DEBUG_LOGGING } from '@/app/shared/utils/is-debug-logging-enabled';
import { fixDocumentNumberPrefix } from '../utils';
import { ATLAS_JSON_OUTPUT_DIR, ATLAS_JSON_OUTPUT_FILE_BLUE } from './constants';
import { AtlasCategoryJson, AtlasDocumentJson } from './types';

// Parse command line arguments
const args = process.argv.slice(2);
const KEEP_INACTIVES = args.includes('--keep-inactives');

// Resolve input/output paths (assumes running from repository root)
const REPO_ROOT = process.cwd();
const INPUT_FILE = path.join(REPO_ROOT, '.debug-data', 'blue.json');
const OUTPUT_DIR = path.join(REPO_ROOT, ATLAS_JSON_OUTPUT_DIR);
const OUTPUT_FILE = path.join(OUTPUT_DIR, ATLAS_JSON_OUTPUT_FILE_BLUE);

type BlueNode = Record<string, unknown>;

const TYPE_PREFIX_TO_ATLAS_TYPE: Record<string, AtlasDocumentType> = {
  scope: 'Scope',
  article: 'Article',
  section: 'Section',
  core: 'Core',
  type_specification: 'Type Specification',
  annotation: 'Annotation',
  tenet: 'Action Tenet',
  scenario: 'Scenario',
  scenario_variation: 'Scenario Variation',
  active_data: 'Active Data',
  active_data_controller: 'Active Data Controller',
  agent_scope: 'Scope',
};

const ATLAS_TYPE_TO_CATEGORY: Record<AtlasDocumentType, GitHubAtlasDocumentType | AtlasDatabaseName> = {
  Scope: ATLAS_DATABASES.SCOPES,
  Article: ATLAS_DATABASES.ARTICLES,
  Section: ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS,
  Core: ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS,
  'Type Specification': 'Type Specifications',
  'Active Data Controller': ATLAS_DATABASES.ACTIVE_DATA,
  'Action Tenet': ATLAS_DATABASES.TENETS,
  'Active Data': ATLAS_DATABASES.ACTIVE_DATA,
  Annotation: ATLAS_DATABASES.ANNOTATIONS,
  Scenario: ATLAS_DATABASES.SCENARIOS,
  'Scenario Variation': ATLAS_DATABASES.SCENARIO_VARIATIONS,
  // Map to Needed Research when present; if not found in blue.json we still satisfy type
  'Needed Research': ATLAS_DATABASES.NEEDED_RESEARCH,
};

function inferAtlasTypeFromKeys(node: BlueNode): AtlasDocumentType | null {
  // Look for any key that ends with _name and use its prefix
  for (const key of Object.keys(node)) {
    if (key.endsWith('_name')) {
      const prefix = key.slice(0, -'_name'.length);
      const mapped = TYPE_PREFIX_TO_ATLAS_TYPE[prefix];
      if (mapped) return mapped;
    }
  }
  return null;
}

function extractField(
  node: BlueNode,
  prefix: string,
  field: 'name' | 'content' | 'doc_no' | 'uuid' | 'inactive',
): string {
  const key = `${prefix}_${field}`;
  const value = node[key] as string | undefined;
  return (value ?? '').toString();
}

function makeDocumentFromNode(node: BlueNode): { doc: AtlasDocumentJson; prefix: string } | null {
  const atlasType = inferAtlasTypeFromKeys(node);
  if (!atlasType) return null;

  // Determine prefix actually present
  const presentPrefix = Object.keys(node)
    .filter((k) => k.endsWith('_name'))
    .map((k) => k.slice(0, -'_name'.length))[0] as string | undefined;
  if (!presentPrefix) return null;

  const name = extractField(node, presentPrefix, 'name');
  const content = extractField(node, presentPrefix, 'content');
  let originalDocNumber = extractField(node, presentPrefix, 'doc_no');
  // Fallback: try to locate any *_doc_no key if presentPrefix field is empty
  if (!originalDocNumber) {
    for (const [k, v] of Object.entries(node)) {
      if (k.endsWith('_doc_no') && typeof v === 'string' && v.length > 0) {
        originalDocNumber = v;
        break;
      }
    }
  }
  const uuid = extractField(node, presentPrefix, 'uuid') || null;
  const inactive = extractField(node, presentPrefix, 'inactive') === '1' || false;

  return {
    doc: {
      type: atlasType,
      generatedDocNumber: '',
      originalDocNumber,
      name,
      content,
      uuid,
      inactive,
    },
    prefix: presentPrefix,
  };
}

function collectChildArrays(node: BlueNode): unknown[] {
  const children: unknown[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (!Array.isArray(value)) continue;
    // Heuristic: keys that are plural collections, e.g. scope_articles, article_sections, section_primary_docs, core_children...
    if (
      /_articles$|_sections$|_primary_docs$|_children$|_annotations$|_tenets$|_needed_research$|_scenarios$|_scenario_variations$|_active_data$|_agents?$/.test(
        key,
      )
    ) {
      children.push(...value);
    }
  }
  return children;
}

type FlattenedDoc = { doc: AtlasDocumentJson; prefix: string };
type InactiveDoc = { docNumber: string; name: string };

function extractAnyNameDocNo(node: BlueNode): InactiveDoc {
  // Prefer presentPrefix if we can infer it
  const nameKey = Object.keys(node).find((k) => k.endsWith('_name')) as string | undefined;
  const prefix = nameKey ? nameKey.slice(0, -'_name'.length) : undefined;
  const name = prefix ? extractField(node, prefix, 'name') : '';
  let docNumber = prefix ? extractField(node, prefix, 'doc_no') : '';
  if (!docNumber) {
    for (const [k, v] of Object.entries(node)) {
      if (k.endsWith('_doc_no') && typeof v === 'string' && v.length > 0) {
        docNumber = v;
        break;
      }
    }
  }
  return { docNumber, name };
}

function flattenBlueTree(nodes: unknown[], keepInactives = false): { items: FlattenedDoc[]; inactive: InactiveDoc[] } {
  const results: FlattenedDoc[] = [];
  const inactive: InactiveDoc[] = [];
  const stack: unknown[] = [...nodes];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    const obj = current as BlueNode;

    // Track inactive nodes
    if (typeof (obj as { inactive?: number }).inactive === 'number' && (obj as { inactive: number }).inactive === 1) {
      inactive.push(extractAnyNameDocNo(obj));

      // If keeping inactives, process as normal document, otherwise skip
      if (!keepInactives) {
        // Still traverse children to ensure we account for structure, but do not include as a document
        const childArrays = collectChildArrays(obj);
        for (const child of childArrays) {
          if (child && typeof child === 'object') {
            stack.push(child);
          }
        }
        continue;
      }
    }

    const result = makeDocumentFromNode(obj);
    if (result) {
      results.push(result);
    }

    const childArrays = collectChildArrays(obj);
    for (const child of childArrays) {
      if (child && typeof child === 'object') {
        stack.push(child);
      }
    }
  }

  return { items: results, inactive };
}

function categorizeDocuments(items: FlattenedDoc[]): AtlasCategoryJson[] {
  const map = new Map<string, AtlasDocumentJson[]>();
  for (const { doc, prefix } of items) {
    let category: GitHubAtlasDocumentType | AtlasDatabaseName =
      ATLAS_TYPE_TO_CATEGORY[doc.type] ?? ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS;
    if (prefix === 'agent_scope') {
      category = ATLAS_DATABASES.AGENTS;
    }
    const arr = map.get(category) ?? [];
    arr.push(doc);
    map.set(category, arr);
  }

  const categories = Array.from(map.entries()).map(([type, documents]) => ({
    type: type as GitHubAtlasDocumentType | AtlasDatabaseName,
    documents: documents
      .map((doc) => ({
        ...doc,
        generatedDocNumber: fixDocumentNumberPrefix(
          doc.originalDocNumber,
          type as GitHubAtlasDocumentType | AtlasDatabaseName,
        ),
      }))
      .sort((a, b) => compareDocNumbers(a.generatedDocNumber, b.generatedDocNumber)),
  }));

  if (DEBUG_LOGGING()) {
    for (const c of categories) {
      const start = Date.now();
      [...c.documents].sort((a, b) => compareDocNumbers(a.generatedDocNumber, b.generatedDocNumber));
      const ms = Date.now() - start;
      console.log(`Sorted ${c.documents.length} documents for "${c.type}" in ~${ms}ms`);
    }
  }

  return categories;
}

export async function generateAtlasBlueJson(keepInactives = false): Promise<AtlasCategoryJson[]> {
  const raw = await readFile(INPUT_FILE, 'utf8');
  const json = JSON.parse(raw) as unknown;
  if (!Array.isArray(json)) {
    throw new Error('Expected top-level array in .debug-data/blue.json');
  }

  const { items: flattened, inactive } = flattenBlueTree(json, keepInactives);
  if (DEBUG_LOGGING()) console.log(`Flattened ${flattened.length} documents from blue.json`);

  const categories = categorizeDocuments(flattened);

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(categories, null, 2), 'utf8');
  const total = categories.reduce((acc, c) => acc + c.documents.length, 0);
  if (DEBUG_LOGGING()) console.log(`Wrote ${total} documents (${categories.length} categories) to ${OUTPUT_FILE}`);
  // Report inactive nodes
  if (keepInactives) {
    console.log(`Inactive nodes included: ${inactive.length}`);
  } else {
    console.log(`Inactive nodes skipped: ${inactive.length}`);
  }
  if (DEBUG_LOGGING() && inactive.length > 0) {
    for (const { docNumber, name } of inactive) {
      console.log(`  - ${docNumber || '?'} ${name || ''}`.trim());
    }
  }
  return categories;
}

// Main execution
if (require.main === module) {
  (async () => {
    try {
      if (KEEP_INACTIVES) {
        console.log('Generating atlas-blue.json from Blue JSON (including inactive nodes)...');
      } else {
        console.log('Generating atlas-blue.json from Blue JSON...');
      }
      const categories = await generateAtlasBlueJson(KEEP_INACTIVES);
      const totalRowCount = categories.reduce((acc, c) => acc + c.documents.length, 0);
      console.log(`Done. Wrote ${totalRowCount} documents (${categories.length} categories) to ${OUTPUT_FILE}`);
    } catch (error) {
      console.error('Failed to generate atlas-blue.json:', error);
      process.exit(1);
    }
  })();
}
