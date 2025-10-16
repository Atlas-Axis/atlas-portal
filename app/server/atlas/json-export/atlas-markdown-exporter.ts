import {
  NEEDED_RESEARCH_PROPERTY_MAPPING,
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '../notion-database-properties-and-relationships';
import { buildAtlasJSON } from './atlas-json-exporter';
import { type StandardizedAtlasDocument, StandardizedAtlasScopeTrees } from './types';

export async function buildAtlasMarkdown() {
  // Load Atlas JSON
  const standardizedTrees: StandardizedAtlasScopeTrees = await buildAtlasJSON();

  // Convert to Markdown, preserving hierarchy and sibling order as represented
  const lines: string[] = [];

  for (const root of standardizedTrees) {
    lines.push(...formatDocumentRecursive(root, 0));
  }

  return lines.join('\n');
}

function formatDocumentRecursive(doc: StandardizedAtlasDocument, depth: number): string[] {
  const lines: string[] = [];

  const hashes = '#'.repeat(Math.max(1, depth + 1));
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
      lines.push(...formatDocumentRecursive(child, depth + 1));
    }
  }

  return lines;
}

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
    out.push(`**${label}**: ${trimmed}`);
  }
  return out;
}

function getAllChildren(doc: StandardizedAtlasDocument): StandardizedAtlasDocument[] {
  const children: StandardizedAtlasDocument[] = [];

  // Collect all children from all possible collections, following the original tree structure
  const docAsRecord = doc as unknown as Record<string, unknown>;

  // Check all possible child collection names
  const possibleCollections = [
    'articles',
    'sections_and_primary_docs',
    'agent_scope_database',
    'annotations',
    'tenets',
    'scenarios',
    'scenario_variations',
    'active_data',
    'needed_research',
  ];

  for (const collectionName of possibleCollections) {
    const collection = docAsRecord[collectionName];
    if (Array.isArray(collection)) {
      children.push(...(collection as StandardizedAtlasDocument[]));
    }
  }

  return children;
}
