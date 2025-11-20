import {
  NEEDED_RESEARCH_PROPERTY_MAPPING,
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '../notion-mapping/notion-database-properties-and-relationships';
import { buildExportAtlasTreeJSON } from './atlas-json-exporter';
import { calculateHeadingLevel } from './atlas-markdown-depth-utils';
import { type ExportAtlasTreeDocument, ExportAtlasTreeScopeTrees, childCollectionNames } from './types';

export async function buildAtlasMarkdown(): Promise<string> {
  // Load Atlas JSON
  const exportTrees: ExportAtlasTreeScopeTrees = await buildExportAtlasTreeJSON();

  // Convert to Markdown, preserving hierarchy and sibling order as represented
  const lines: string[] = [];

  for (const root of exportTrees) {
    lines.push(...formatDocumentRecursive(root, 0));
  }

  return lines.join('\n');
}

export async function buildAtlasMarkdownsPerScope(): Promise<Record<string, string>> {
  // Load Atlas JSON
  const exportTrees: ExportAtlasTreeScopeTrees = await buildExportAtlasTreeJSON();

  // Create a map of sanitized scope names to their markdown content
  const markdownsByScope: Record<string, string> = {};

  for (const scopeDoc of exportTrees) {
    // Generate markdown for this scope tree
    const lines = formatDocumentRecursive(scopeDoc, 0);
    const markdownContent = lines.join('\n');

    // Create a sanitized filename from the scope's doc_no and name
    // Example: "A.2 - The Support Scope" -> "A.2 - The Support Scope"
    const scopeTitle = `${scopeDoc.doc_no} - ${scopeDoc.name}`;
    const sanitizedName = sanitizeScopeName(scopeTitle);

    markdownsByScope[sanitizedName] = markdownContent;
  }

  return markdownsByScope;
}

function sanitizeScopeName(name: string): string {
  // Replace invalid filesystem characters while preserving readability
  // Invalid characters: / \ : * ? " < > |
  return name.replace(/[/\\:*?"<>|]/g, '_');
}

/**
 * Normalize content by replacing certain characters with their standard equivalents.
 * This ensures consistent formatting across exported markdown.
 *
 * Replacements:
 * - Replace “ (LEFT DOUBLE QUOTATION MARK - U+201C) with " (straight quote)
 * - Replace ” (RIGHT DOUBLE QUOTATION MARK - U+201D) with " (straight quote)
 * - Replace • (bullet character) with - (hyphen for markdown list compatibility)
 */
function normalizeContent(text: string): string {
  return text
    .replace(/[“”]/g, '"') // Replace left/right double quotation marks with straight quotes
    .replace(/•/g, '-'); // Replace bullets with hyphens
}

function formatDocumentRecursive(
  doc: ExportAtlasTreeDocument,
  depth: number,
  parentDoc?: ExportAtlasTreeDocument,
): string[] {
  const lines: string[] = [];

  // Skip stub nodes (duplicate documents that were filtered out during tree building)
  if (!doc.name || doc.name.trim() === '') {
    console.warn(`[formatDocumentRecursive] Skipping stub node without name: ${doc.uuid ?? 'unknown'} (${doc.type})`);
    return lines; // Return empty array to skip this document
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

  // Extra fields (if any) — above structured fields
  const extraFieldLines = getExtraFieldsForDocument(doc);
  if (extraFieldLines.length > 0) {
    lines.push(...extraFieldLines, '');
  }

  // Children: follow the original tree structure without document type grouping
  // Just iterate through all child collections in the order they appear in the data structure
  const allChildren = getAllChildren(doc);
  if (allChildren.length > 0) {
    // TODO: Don't sort here, the original tree is already sorted
    // const sortedChildren = [...allChildren].sort((a, b) => compareDocNumbers(a.doc_no, b.doc_no));
    for (const child of allChildren) {
      // Pass current doc as parent for Needed Research depth calculation
      lines.push(...formatDocumentRecursive(child, depth + 1, doc));
    }
  }

  return lines;
}

// For more info on extra fields, see `docs/ATLAS_EXTRA_FIELDS.md`
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
  // Remove the trailing blank line (line 39 in formatDocumentRecursive adds the final separator)
  if (out.length > 0 && out[out.length - 1] === '') {
    out.pop();
  }
  return out;
}

function getAllChildren(doc: ExportAtlasTreeDocument): ExportAtlasTreeDocument[] {
  const children: ExportAtlasTreeDocument[] = [];

  // Collect all children from all possible collections, following the original tree structure
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
