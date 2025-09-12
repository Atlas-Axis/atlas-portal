import { ATLAS_DATABASES, AtlasDatabaseName } from './constants';

export interface NotionDatabasePropertyMapping {
  atlasFullDocumentTitle: string; // A property name representing the full title, including the document number and name, e.g. "A.3.1.1 - Scope Improvement"
  atlasDocumentNo: string; // A property name representing the formal document ID, e.g. "A.3.1.1"
  atlasDocumentName: string; // A property name representing the document name, e.g. "Scope Improvement"
  atlasDocumentType: string; // A property name representing the type of document, e.g. "Core", "Section"...
  content: string; // A property name representing the main content or body of the document
  // TODO: optional?
  sortOrder: string; // A property name representing the manually set order of the document within its parent or section
}

export type NotionDatabasePropertyKey = keyof NotionDatabasePropertyMapping;

export const PROPERTY_MAPPING_NAMES: Record<string, NotionDatabasePropertyKey> = {
  ATLAS_FULL_DOCUMENT_TITLE: 'atlasFullDocumentTitle',
  ATLAS_DOCUMENT_NO: 'atlasDocumentNo',
  ATLAS_DOCUMENT_NAME: 'atlasDocumentName',
  ATLAS_DOCUMENT_TYPE: 'atlasDocumentType',
  CONTENT: 'content',
  SORT_ORDER: 'sortOrder',
};

/**
 * Docs for Notion database properties
 * - https://developers.notion.com/reference/property-object
 *
 * Examples:
 * - Current Doc No (or Temp Name): "A.3.1 - A1 - Scope Improvement"
 * - Name: "Scope Improvement"
 * - Formal Doc ID: "A.3.1.1"
 */
export const NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS: Record<
  AtlasDatabaseName,
  {
    properties: NotionDatabasePropertyMapping;
    relationships: Record<string, AtlasDatabaseName>;
    parentPropertyName?: string;
    subItemsPropertyName?: string;
  }
> = {
  [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: {
    properties: {
      atlasFullDocumentTitle: 'Doc No (or Temp Name)',
      atlasDocumentNo: 'Formal Doc ID',
      atlasDocumentName: 'Name',
      atlasDocumentType: 'Type',
      content: 'Content',
      sortOrder: 'No.',
    },
    relationships: {
      // activeData: 'Active Data' // Relation
      // annotations: 'Annotations' // Relation
    },
    parentPropertyName: 'Parent Doc',
    subItemsPropertyName: 'Subdocs',
  },
  [ATLAS_DATABASES.AGENTS]: {
    properties: {
      atlasFullDocumentTitle: 'Document Name',
      atlasDocumentNo: 'Formal Doc ID',
      atlasDocumentName: 'Document Name',
      atlasDocumentType: 'Doc Type',
      content: 'Content',
      sortOrder: 'No.',
    },
    relationships: {},
    parentPropertyName: 'Parent item',
    subItemsPropertyName: 'Sub-item',
  },
  [ATLAS_DATABASES.ACTIVE_DATA]: {
    properties: {
      atlasFullDocumentTitle: '', // TODO
      atlasDocumentNo: '', // TODO
      atlasDocumentName: '', // TODO
      atlasDocumentType: '', // TODO
      content: '', // TODO
      sortOrder: '', // TODO
    },
    relationships: {},
  },
  [ATLAS_DATABASES.SCOPES]: {
    properties: {
      atlasFullDocumentTitle: '', // TODO
      atlasDocumentNo: '', // TODO
      atlasDocumentName: '', // TODO
      atlasDocumentType: '', // TODO
      content: '', // TODO
      sortOrder: '', // TODO
    },
    relationships: {},
  },
  [ATLAS_DATABASES.ARTICLES]: {
    properties: {
      atlasFullDocumentTitle: '', // TODO
      atlasDocumentNo: '', // TODO
      atlasDocumentName: '', // TODO
      atlasDocumentType: '', // TODO
      content: '', // TODO
      sortOrder: '', // TODO
    },
    relationships: {},
  },
  [ATLAS_DATABASES.ANNOTATIONS]: {
    properties: {
      atlasFullDocumentTitle: '', // TODO
      atlasDocumentNo: '', // TODO
      atlasDocumentName: '', // TODO
      atlasDocumentType: '', // TODO
      content: '', // TODO
      sortOrder: '', // TODO
    },
    relationships: {},
  },
  [ATLAS_DATABASES.TENETS]: {
    properties: {
      atlasFullDocumentTitle: '', // TODO
      atlasDocumentNo: '', // TODO
      atlasDocumentName: '', // TODO
      atlasDocumentType: '', // TODO
      content: '', // TODO
      sortOrder: '', // TODO
    },
    relationships: {},
  },
  [ATLAS_DATABASES.SCENARIOS]: {
    properties: {
      atlasFullDocumentTitle: '', // TODO
      atlasDocumentNo: '', // TODO
      atlasDocumentName: '', // TODO
      atlasDocumentType: '', // TODO
      content: '', // TODO
      sortOrder: '', // TODO
    },
    relationships: {},
  },
  [ATLAS_DATABASES.SCENARIO_VARIATIONS]: {
    properties: {
      atlasFullDocumentTitle: '', // TODO
      atlasDocumentNo: '', // TODO
      atlasDocumentName: '', // TODO
      atlasDocumentType: '', // TODO
      content: '', // TODO
      sortOrder: '', // TODO
    },
    relationships: {},
  },
  [ATLAS_DATABASES.NEEDED_RESEARCH]: {
    properties: {
      atlasFullDocumentTitle: '', // TODO
      atlasDocumentNo: '', // TODO
      atlasDocumentName: '', // TODO
      atlasDocumentType: '', // TODO
      content: '', // TODO
      sortOrder: '', // TODO
    },
    relationships: {},
  },
  [ATLAS_DATABASES.ORIGINAL_CONTEXT_DATA]: {
    properties: {
      atlasFullDocumentTitle: '', // TODO
      atlasDocumentNo: '', // TODO
      atlasDocumentName: '', // TODO
      atlasDocumentType: '', // TODO
      content: '', // TODO
      sortOrder: '', // TODO
    },
    relationships: {},
  },
} as const;

/**
 * Utility to reverse a NotionDatabasePropertyMapping: returns an object mapping property values to their keys.
 */
function reverseNotionDatabasePropertyMapping(
  mapping: NotionDatabasePropertyMapping,
): Record<string, keyof NotionDatabasePropertyMapping> {
  const reversed: Record<string, keyof NotionDatabasePropertyMapping> = {};
  for (const key in mapping) {
    const value = mapping[key as keyof NotionDatabasePropertyMapping];
    if (value) {
      reversed[value] = key as keyof NotionDatabasePropertyMapping;
    }
  }
  return reversed;
}

// Precompute reversed mappings for all databases
// Usage example: REVERSED_NOTION_DATABASE_PROPERTY_MAPPINGS[ATLAS_DATABASES.SCOPES]
export const REVERSED_NOTION_DATABASE_PROPERTY_MAPPINGS: Record<
  AtlasDatabaseName,
  Record<string, keyof NotionDatabasePropertyMapping>
> = Object.fromEntries(
  Object.entries(NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS).map(([dbName, config]) => [
    dbName,
    reverseNotionDatabasePropertyMapping(config.properties),
  ]),
) as Record<AtlasDatabaseName, Record<string, keyof NotionDatabasePropertyMapping>>;
