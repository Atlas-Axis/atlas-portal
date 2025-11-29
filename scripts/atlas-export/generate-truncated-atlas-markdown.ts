/**
 * Generate Truncated Atlas Markdown
 *
 * Description:
 * - Loads the canonical Atlas markdown file from GitHub
 * - Parses it to Export Tree format
 * - Filters out all documents deeper than depth 4
 * - Exports the truncated tree to markdown format
 * - Output path: exported-atlas/truncated-atlas.md
 *
 * This truncated file is used for local testing of:
 * - Markdown → Notion sync
 * - Notion → Supabase import
 *
 * Without needing to process the full production Atlas (which takes hours).
 *
 * Usage:
 *   npx tsx scripts/atlas-export/generate-truncated-atlas-markdown.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { calculateHeadingLevel, calculateSemanticDepth } from '@/app/server/atlas/export/atlas-markdown-depth-utils';
import { parseAtlasMarkdown } from '@/app/server/atlas/export/atlas-markdown-importer';
import {
  type ExportAtlasTreeDocument,
  type ExportAtlasTreeScopeTrees,
  childCollectionNames,
} from '@/app/server/atlas/export/types';
import { fetchAtlasMarkdownContent } from '@/app/server/atlas/load-atlas-markdown-from-github';
import {
  NEEDED_RESEARCH_PROPERTY_MAPPING,
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '@/app/server/atlas/notion-mapping/notion-database-properties-and-relationships';
import { loadEnv } from '@/scripts/utils/load-env';

const MAX_DEPTH = 4;

/**
 * Filter an Export Tree document to remove all documents deeper than maxDepth.
 *
 * @param doc - The document to filter
 * @param maxDepth - Maximum depth to include (e.g., 4)
 * @param parentDepth - The depth of the parent document (for Needed Research)
 * @returns The filtered document, or null if it should be excluded
 */
function filterTreeByDepth(
  doc: ExportAtlasTreeDocument,
  maxDepth: number,
  parentDepth?: number,
): ExportAtlasTreeDocument | null {
  // Calculate this document's depth
  let depth = calculateSemanticDepth(doc.doc_no, doc.type);

  // For Needed Research, use parent depth + 1
  if (depth === null && parentDepth !== undefined) {
    depth = parentDepth + 1;
  }

  // Skip if too deep (or if depth couldn't be determined)
  if (depth === null || depth > maxDepth) {
    return null;
  }

  // Create a shallow copy of the document
  const filtered = { ...doc };

  // Recursively filter all child collections
  // Use the same pattern as getAllChildren for dynamic property access
  const filteredAsRecord = filtered as unknown as Record<string, unknown>;
  for (const collectionName of childCollectionNames) {
    const collection = filteredAsRecord[collectionName];
    if (Array.isArray(collection)) {
      const filteredChildren = collection
        .map((child) => filterTreeByDepth(child as ExportAtlasTreeDocument, maxDepth, depth))
        .filter((child): child is ExportAtlasTreeDocument => child !== null);
      filteredAsRecord[collectionName] = filteredChildren;
    }
  }

  return filtered;
}

/**
 * Filter an entire Export Tree to remove documents deeper than maxDepth.
 */
function filterExportTreeByDepth(trees: ExportAtlasTreeScopeTrees, maxDepth: number): ExportAtlasTreeScopeTrees {
  return trees
    .map((scopeDoc) => filterTreeByDepth(scopeDoc, maxDepth))
    .filter((doc): doc is ExportAtlasTreeDocument => doc !== null);
}

/**
 * Normalize content by replacing certain characters with their standard equivalents.
 * This ensures consistent formatting across exported markdown.
 *
 * Replacements:
 * - Replace " (LEFT DOUBLE QUOTATION MARK - U+201C) with " (straight quote)
 * - Replace " (RIGHT DOUBLE QUOTATION MARK - U+201D) with " (straight quote)
 * - Replace • (bullet character) with - (hyphen for markdown list compatibility)
 */
function normalizeContent(text: string): string {
  return text
    .replace(/[""]/g, '"') // Replace left/right double quotation marks with straight quotes
    .replace(/•/g, '-'); // Replace bullets with hyphens
}

/**
 * Format a document and its children recursively as markdown lines.
 * This is adapted from formatDocumentRecursive in atlas-markdown-exporter.ts
 */
function formatDocumentRecursive(
  doc: ExportAtlasTreeDocument,
  depth: number,
  parentDoc?: ExportAtlasTreeDocument,
): string[] {
  const lines: string[] = [];

  // Skip stub nodes (duplicate documents that were filtered out during tree building)
  if (!doc.name || doc.name.trim() === '') {
    console.warn(`[formatDocumentRecursive] Skipping stub node without name: ${doc.uuid ?? 'unknown'} (${doc.type})`);
    return lines;
  }

  // Calculate heading level based on document number and type (capped at 6)
  // For Needed Research, use parent's depth + 1 since NR-X doesn't encode hierarchy
  let headingLevel: number;
  if (doc.type === 'Needed Research' && parentDoc) {
    const parentLevel = calculateHeadingLevel(parentDoc.doc_no, parentDoc.type);
    headingLevel = Math.min(6, parentLevel + 1);
  } else if (doc.type === 'Needed Research') {
    // Fallback for root-level NR (shouldn't happen in practice)
    console.warn(`Needed Research document ${doc.doc_no} (${doc.type}) is at root level.`);
    headingLevel = 6;
  } else {
    headingLevel = calculateHeadingLevel(doc.doc_no, doc.type);
  }

  const hashes = '#'.repeat(headingLevel);
  const uuid = ` <!-- UUID: ${doc.uuid ?? ''} -->`;
  const title = `${hashes} ${doc.doc_no} - ${doc.name} [${doc.type}] ${uuid}`;
  lines.push(title, '');

  if (doc.content && doc.content.trim().length > 0) {
    const normalizedContent = normalizeContent(doc.content.trim());
    lines.push(normalizedContent, '');
  }

  // Extra fields (if any)
  const extraFieldLines = getExtraFieldsForDocument(doc);
  if (extraFieldLines.length > 0) {
    lines.push(...extraFieldLines, '');
  }

  // Children: follow the original tree structure
  const allChildren = getAllChildren(doc);
  if (allChildren.length > 0) {
    for (const child of allChildren) {
      // Pass current doc as parent for Needed Research depth calculation
      lines.push(...formatDocumentRecursive(child, depth + 1, doc));
    }
  }

  return lines;
}

/**
 * Get extra fields for a document (Type Spec, Scenario, Scenario Variation, Needed Research).
 * Adapted from atlas-markdown-exporter.ts
 */
function getExtraFieldsForDocument(doc: ExportAtlasTreeDocument): string[] {
  let mapping: Record<string, string> | null = null;
  switch (doc.type) {
    case 'Type Specification':
      mapping = TYPE_SPECIFICATION_PROPERTY_MAPPING;
      break;
    case 'Scenario':
      mapping = SCENARIO_PROPERTY_MAPPING;
      break;
    case 'Scenario Variation':
      mapping = SCENARIO_VARIATION_PROPERTY_MAPPING;
      break;
    case 'Needed Research':
      mapping = NEEDED_RESEARCH_PROPERTY_MAPPING;
      break;
    default:
      mapping = null;
  }

  if (!mapping) return [];

  const out: string[] = [];
  const source = doc as unknown as Record<string, unknown>;
  for (const [fieldKey, label] of Object.entries(mapping)) {
    const raw = source[fieldKey];
    if (raw === undefined) {
      console.warn(
        `getExtraFieldsForDocument: Missing expected field '${fieldKey}' on document type '${doc.type}' for doc ${doc.uuid}`,
      );
      continue;
    }
    const value = raw === null ? '' : typeof raw === 'string' ? raw : String(raw);
    const trimmed = value.trim();
    const normalizedValue = normalizeContent(trimmed);
    // Format: **Label**: followed by newline, then value, then blank line after value
    out.push(`**${label}**:`);
    out.push('');
    out.push(normalizedValue);
    out.push(''); // Blank line after value
  }
  // Remove the trailing blank line
  if (out.length > 0 && out[out.length - 1] === '') {
    out.pop();
  }
  return out;
}

/**
 * Get all children from all child collections.
 * Adapted from atlas-markdown-exporter.ts
 */
function getAllChildren(doc: ExportAtlasTreeDocument): ExportAtlasTreeDocument[] {
  const children: ExportAtlasTreeDocument[] = [];
  const docAsRecord = doc as unknown as Record<string, unknown>;

  // Check all possible child collection names
  for (const collectionName of childCollectionNames) {
    const collection = docAsRecord[collectionName];
    if (Array.isArray(collection)) {
      children.push(...(collection as ExportAtlasTreeDocument[]));
    }
  }

  return children;
}

/**
 * Convert filtered Export Tree to markdown string.
 */
function buildMarkdownFromFilteredTree(trees: ExportAtlasTreeScopeTrees): string {
  const lines: string[] = [];

  for (const root of trees) {
    lines.push(...formatDocumentRecursive(root, 0));
  }

  return lines.join('\n');
}

/**
 * Count total documents in a tree (for logging).
 */
function countDocuments(trees: ExportAtlasTreeScopeTrees): number {
  let count = 0;

  function countRecursive(doc: ExportAtlasTreeDocument): void {
    count++;
    const allChildren = getAllChildren(doc);
    for (const child of allChildren) {
      countRecursive(child);
    }
  }

  for (const root of trees) {
    countRecursive(root);
  }

  return count;
}

async function main() {
  loadEnv();

  console.log('Loading Atlas markdown from GitHub...');
  const markdown = await fetchAtlasMarkdownContent();
  console.log(`Loaded ${markdown.length} characters`);

  console.log('Parsing Atlas markdown to Export Tree...');
  const exportTree = parseAtlasMarkdown(markdown);
  const originalCount = countDocuments(exportTree);
  console.log(`Parsed ${originalCount} documents`);

  console.log(`Filtering documents to max depth ${MAX_DEPTH}...`);
  const filteredTree = filterExportTreeByDepth(exportTree, MAX_DEPTH);
  const filteredCount = countDocuments(filteredTree);
  console.log(`Filtered to ${filteredCount} documents (removed ${originalCount - filteredCount})`);

  console.log('Converting filtered tree to markdown...');
  const truncatedMarkdown = buildMarkdownFromFilteredTree(filteredTree);
  console.log(
    `Generated ${truncatedMarkdown.length} characters (${Math.round((truncatedMarkdown.length / markdown.length) * 100)}% of original)`,
  );

  const outDir = path.join(process.cwd(), 'exported-atlas');
  const outFile = path.join(outDir, 'truncated-atlas.md');

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outFile, truncatedMarkdown, 'utf8');

  console.log(`✓ Wrote truncated Atlas markdown to: ${outFile}`);
  console.log(`  Original: ${originalCount} documents`);
  console.log(`  Truncated: ${filteredCount} documents (max depth ${MAX_DEPTH})`);
}

main().catch((err) => {
  console.error('Error generating truncated Atlas markdown:', err);
  process.exitCode = 1;
});
