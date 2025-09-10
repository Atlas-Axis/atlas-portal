import { ATLAS_DATABASES, AtlasDatabaseName } from '../atlas/constants';

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
export const NOTION_DATABASE_PROPERTY_NAMES: Record<AtlasDatabaseName, Record<string, string>> = {
  [ATLAS_DATABASES.SCOPES]: {},
  [ATLAS_DATABASES.ARTICLES]: {},
  [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: {
    name: 'Name',
    content: 'Content',
    docNo: 'Doc No (or Temp Name)',
    createEditPage: 'Create Edit Page',
    subItem: 'Sub-item', // Subdocs ?
    parent: 'Parent item',
    sortOrder: 'No.',
    type: 'Type', // Section, Core, Type Specification, Active Data Controller, Category, Placeholder, Spell SP Controller

    // Atlas Relationships
    // activeData: 'Active Data' // Relation
    // annotations: 'Annotations' // Relation
  },
  [ATLAS_DATABASES.ANNOTATIONS]: {},
  [ATLAS_DATABASES.TENETS]: {},
  [ATLAS_DATABASES.SCENARIOS]: {},
  [ATLAS_DATABASES.SCENARIO_VARIATIONS]: {},
  [ATLAS_DATABASES.ACTIVE_DATA]: {},
  [ATLAS_DATABASES.AGENTS]: {
    name: 'Document Name',
    content: 'Content',
    docNo: 'Formal Doc ID',
    createEditPage: 'Create Edit Page',
  },
  [ATLAS_DATABASES.NEEDED_RESEARCH]: {},
  [ATLAS_DATABASES.ORIGINAL_CONTEXT_DATA]: {},
} as const;
