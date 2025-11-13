import {
  NEEDED_RESEARCH_PROPERTY_MAPPING,
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '../notion-database-properties-and-relationships';
import { buildAtlasJSON } from './atlas-json-exporter';
import { calculateHeadingLevel } from './atlas-markdown-depth-utils';
import { type StandardizedAtlasDocument, StandardizedAtlasScopeTrees, childCollectionNames } from './types';

export async function buildAtlasMarkdown(): Promise<string> {
  // Load Atlas JSON
  const standardizedTrees: StandardizedAtlasScopeTrees = await buildAtlasJSON();

  // Convert to Markdown, preserving hierarchy and sibling order as represented
  const lines: string[] = [];

  for (const root of standardizedTrees) {
    lines.push(...formatDocumentRecursive(root, 0));
  }

  return lines.join('\n');
}

export async function buildAtlasMarkdownsPerScope(): Promise<Record<string, string>> {
  // Load Atlas JSON
  const standardizedTrees: StandardizedAtlasScopeTrees = await buildAtlasJSON();

  // Create a map of sanitized scope names to their markdown content
  const markdownsByScope: Record<string, string> = {};

  for (const scopeDoc of standardizedTrees) {
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

function formatDocumentRecursive(
  doc: StandardizedAtlasDocument,
  depth: number,
  parentDoc?: StandardizedAtlasDocument,
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
    lines.push(doc.content.trim(), '');
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
function getExtraFieldsForDocument(doc: StandardizedAtlasDocument): string[] {
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
    // Format: **Label**: followed by newline, then value, then blank line after value
    out.push(`**${label}**:`);
    out.push('');
    out.push(trimmed);
    out.push(''); // Blank line after value
  }
  // Remove the trailing blank line (line 39 in formatDocumentRecursive adds the final separator)
  if (out.length > 0 && out[out.length - 1] === '') {
    out.pop();
  }
  return out;
}

function getAllChildren(doc: StandardizedAtlasDocument): StandardizedAtlasDocument[] {
  const children: StandardizedAtlasDocument[] = [];

  // Collect all children from all possible collections, following the original tree structure
  const docAsRecord = doc as unknown as Record<string, unknown>;

  // Check all possible child collection names

  for (const collectionName of childCollectionNames) {
    const collection = docAsRecord[collectionName];
    if (Array.isArray(collection)) {
      children.push(...(collection as StandardizedAtlasDocument[]));
    }
  }

  return children;
}
