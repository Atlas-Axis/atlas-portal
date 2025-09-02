/**
 * Docs for Sub-items in Notion databases
 * - https://www.notion.com/help/tasks-and-dependencies
 */
export const SUB_ITEM_PROPERTY_NAME = 'Sub-item';

/**
 * Docs for Notion database properties
 * - https://developers.notion.com/reference/property-object
 */
export const NOTION_DATABASE_PROPERTY_NAMES = {
  'Sections & Primary Docs': {
    name: 'Name',
    content: 'Content',
    docNo: 'Doc No (or Temp Name)',
    createEditPage: 'Create Edit Page',
  },
  'Agent Scope': {
    name: 'Document Name',
    content: 'Content',
    docNo: 'Formal Doc ID',
    createEditPage: 'Create Edit Page',
  },
} as const;
