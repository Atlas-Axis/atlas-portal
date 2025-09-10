import { ATLAS_DATABASES, AtlasDatabaseName } from './constants';

/**
 * Docs for Sub-items in Notion databases
 * - https://www.notion.com/help/tasks-and-dependencies
 */
export const SUB_ITEM_PROPERTY_NAME = 'Sub-item';

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
    properties: Record<string, string>;
    relationships: Record<string, AtlasDatabaseName>;
  }
> = {
  [ATLAS_DATABASES.SCOPES]: {
    properties: {},
    relationships: {},
  },
  [ATLAS_DATABASES.ARTICLES]: { properties: {}, relationships: {} },
  [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: {
    properties: {
      name: 'Name',
      content: 'Content',
      docNo: 'Doc No (or Temp Name)',
      createEditPage: 'Create Edit Page',
      subItem: 'Sub-item', // Subdocs ?
      parent: 'Parent item',
      sortOrder: 'No.',
      type: 'Type', // Section, Core, Type Specification, Active Data Controller, Category, Placeholder, Spell SP Controller
    },
    relationships: {
      // activeData: 'Active Data' // Relation
      // annotations: 'Annotations' // Relation
    },
  },
  [ATLAS_DATABASES.ANNOTATIONS]: { properties: {}, relationships: {} },
  [ATLAS_DATABASES.TENETS]: { properties: {}, relationships: {} },
  [ATLAS_DATABASES.SCENARIOS]: { properties: {}, relationships: {} },
  [ATLAS_DATABASES.SCENARIO_VARIATIONS]: { properties: {}, relationships: {} },
  [ATLAS_DATABASES.ACTIVE_DATA]: { properties: {}, relationships: {} },
  [ATLAS_DATABASES.AGENTS]: {
    properties: {
      name: 'Document Name',
      content: 'Content',
      docNo: 'Formal Doc ID',
      createEditPage: 'Create Edit Page',
    },
    relationships: {},
  },
  [ATLAS_DATABASES.NEEDED_RESEARCH]: { properties: {}, relationships: {} },
  [ATLAS_DATABASES.ORIGINAL_CONTEXT_DATA]: { properties: {}, relationships: {} },
} as const;
