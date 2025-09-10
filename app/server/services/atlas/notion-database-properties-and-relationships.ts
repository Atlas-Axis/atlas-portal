import { ATLAS_DATABASES, AtlasDatabaseName } from './constants';

/**
 * Docs for Sub-items in Notion databases
 * - https://www.notion.com/help/tasks-and-dependencies
 */
// export const SUB_ITEM_PROPERTY_NAME = 'Sub-item';

interface NotionDatabasePropertyMapping {
  atlasFullDocumentTitle: string; // A property name representing the full title, including the document number and name, e.g. "A.3.1.1 - Scope Improvement"
  atlasDocumentNo: string; // A property name representing the formal document ID, e.g. "A.3.1.1"
  atlasDocumentName: string; // A property name representing the document name, e.g. "Scope Improvement"
  content: string; // A property name representing the main content or body of the document
  // TODO: optional?
  sortOrder: string; // A property name representing the manually set order of the document within its parent or section
}

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
  }
> = {
  [ATLAS_DATABASES.SCOPES]: {
    properties: {
      atlasFullDocumentTitle: '', // TODO
      atlasDocumentNo: '', // TODO
      atlasDocumentName: '', // TODO
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
      content: '', // TODO
      sortOrder: '', // TODO
    },
    relationships: {},
  },
  [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: {
    properties: {
      atlasFullDocumentTitle: 'Doc No (or Temp Name)',
      atlasDocumentNo: 'Formal Doc ID',
      atlasDocumentName: 'Name',
      content: 'Content',
      // createEditPage: 'Create Edit Page',
      // subItem: 'Sub-item', // Subdocs ?
      // parent: 'Parent item',
      sortOrder: 'No.',
    },
    relationships: {
      // activeData: 'Active Data' // Relation
      // annotations: 'Annotations' // Relation
    },
  },
  [ATLAS_DATABASES.ANNOTATIONS]: {
    properties: {
      atlasFullDocumentTitle: '', // TODO
      atlasDocumentNo: '', // TODO
      atlasDocumentName: '', // TODO
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
      content: '', // TODO
      sortOrder: '', // TODO
    },
    relationships: {},
  },
  [ATLAS_DATABASES.ACTIVE_DATA]: {
    properties: {
      atlasFullDocumentTitle: '', // TODO
      atlasDocumentNo: '', // TODO
      atlasDocumentName: '', // TODO
      content: '', // TODO
      sortOrder: '', // TODO
    },
    relationships: {},
  },
  [ATLAS_DATABASES.AGENTS]: {
    properties: {
      atlasFullDocumentTitle: '', // TODO
      atlasDocumentName: 'Document Name', // TODO
      content: 'Content',
      atlasDocumentNo: 'Formal Doc ID',
      sortOrder: '', // TODO
      // createEditPage: 'Create Edit Page',
    },
    relationships: {},
  },
  [ATLAS_DATABASES.NEEDED_RESEARCH]: {
    properties: {
      atlasFullDocumentTitle: '', // TODO
      atlasDocumentNo: '', // TODO
      atlasDocumentName: '', // TODO
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
      content: '', // TODO
      sortOrder: '', // TODO
    },
    relationships: {},
  },
} as const;
