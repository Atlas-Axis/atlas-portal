import { compareDocNumbers } from '../atlas-utils';
import {
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '../notion-database-properties-and-relationships';
import { buildAtlasJSON } from './atlas-json-exporter';
import {
  type ActiveDataControllerDocument,
  type ArticleDocument,
  type ChildCollectionName,
  type CoreDocument,
  type ScenarioDocument,
  type ScopeDocument,
  type SectionDocument,
  type StandardizedAtlasDocument,
  StandardizedAtlasScopeTrees,
  type TenetDocument,
  type TypeSpecificationDocument,
  allowedChildCollectionNamesPerDocumentType,
} from './types';

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
  const title = `${hashes} ${doc.doc_no} - ${doc.name}`.trim();
  lines.push(title, '');

  if (doc.content && doc.content.trim().length > 0) {
    lines.push(doc.content.trim(), '');
  }

  // Extra fields (if any) — above structured fields
  const extraFieldLines = getExtraFieldsForDocument(doc);
  if (extraFieldLines.length > 0) {
    lines.push(...extraFieldLines, '');
  }

  const formattedDate = formatISODateYYYYMMDD(doc.last_modified);
  lines.push(
    `**Document Type:** ${doc.type}`,
    `**UUID:** ${doc.uuid ?? ''}`,
    `**Last Modified:** ${formattedDate}`,
    '',
  );

  // Children: follow allowed child collection order per type; preserve item order in each array
  const childCollectionOrder = allowedChildCollectionNamesPerDocumentType[doc.type] ?? [];
  for (const collectionName of childCollectionOrder) {
    const children = getChildren(doc, collectionName);
    if (!children || children.length === 0) continue;
    // TODO: There should be nesting between different child collection types, e.g. sections above core documents
    const sortedChildren = [...children].sort((a, b) => compareDocNumbers(a.doc_no, b.doc_no));
    for (const child of sortedChildren) {
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
    default:
      mapping = null;
  }

  if (!mapping) return [];

  const out: string[] = [];
  const source = doc as unknown as Record<string, unknown>;
  for (const [fieldKey, label] of Object.entries(mapping)) {
    const raw = source[fieldKey];
    if (raw == null) continue;
    const value = typeof raw === 'string' ? raw : String(raw);
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      out.push(`**${label}**: ${trimmed}`);
    }
  }
  return out;
}

function getChildren(
  doc: StandardizedAtlasDocument,
  collection: ChildCollectionName,
): StandardizedAtlasDocument[] | undefined {
  // Use precise narrowing by document type
  switch (doc.type) {
    case 'Scope': {
      const scope = doc as ScopeDocument;
      if (collection === 'articles') return scope.articles;
      return undefined;
    }
    case 'Article': {
      const article = doc as ArticleDocument;
      if (collection === 'sections') return article.sections;
      if (collection === 'annotations') return article.annotations;
      if (collection === 'needed_research') return article.needed_research;
      if (collection === 'tenets') return article.tenets;
      if (collection === 'core_documents') return article.core_documents;
      return undefined;
    }
    case 'Section': {
      const section = doc as SectionDocument;
      if (collection === 'core_documents') return section.core_documents;
      if (collection === 'active_data_controllers') return section.active_data_controllers;
      if (collection === 'type_specifications') return section.type_specifications;
      if (collection === 'annotations') return section.annotations;
      if (collection === 'needed_research') return section.needed_research;
      if (collection === 'tenets') return section.tenets;
      return undefined;
    }
    case 'Core': {
      const core = doc as CoreDocument;
      if (collection === 'core_documents') return core.core_documents;
      if (collection === 'active_data_controllers') return core.active_data_controllers;
      if (collection === 'type_specifications') return core.type_specifications;
      if (collection === 'annotations') return core.annotations;
      if (collection === 'needed_research') return core.needed_research;
      if (collection === 'tenets') return core.tenets;
      return undefined;
    }
    case 'Active Data Controller': {
      const adc = doc as ActiveDataControllerDocument;
      if (collection === 'active_data') return adc.active_data;
      if (collection === 'annotations') return adc.annotations;
      if (collection === 'needed_research') return adc.needed_research;
      if (collection === 'tenets') return adc.tenets;
      return undefined;
    }
    case 'Type Specification': {
      const typeSpec = doc as TypeSpecificationDocument;
      if (collection === 'annotations') return typeSpec.annotations;
      if (collection === 'needed_research') return typeSpec.needed_research;
      if (collection === 'tenets') return typeSpec.tenets;
      return undefined;
    }
    case 'Action Tenet': {
      const tenet = doc as TenetDocument;
      if (collection === 'scenarios') return tenet.scenarios;
      return undefined;
    }
    case 'Scenario': {
      const scenario = doc as ScenarioDocument;
      if (collection === 'scenario_variations') return scenario.scenario_variations;
      return undefined;
    }
    case 'Active Data':
    case 'Annotation':
    case 'Scenario Variation':
    case 'Needed Research':
    default:
      return undefined;
  }
}

function formatISODateYYYYMMDD(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    // Fall back to raw string if not parseable
    return value;
  }
  return date.toISOString().slice(0, 10);
}
