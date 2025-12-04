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
import { calculateSemanticDepth } from '@/app/server/atlas/export/atlas-markdown-depth-utils';
import { formatDocumentRecursive, getAllChildren } from '@/app/server/atlas/export/atlas-markdown-exporter';
import { parseAtlasMarkdown } from '@/app/server/atlas/export/atlas-markdown-importer';
import {
  type ExportAtlasTreeDocument,
  type ExportAtlasTreeScopeTrees,
  childCollectionNames,
} from '@/app/server/atlas/export/types';
import { fetchAtlasMarkdownContent } from '@/app/server/atlas/load-atlas-markdown-from-github';
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
