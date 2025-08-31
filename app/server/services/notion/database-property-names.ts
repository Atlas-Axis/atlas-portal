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
    subItem: 'Sub-item',
  },
  'Agent Scope': {
    name: 'Document Name',
    content: 'Content',
    docNo: 'Formal Doc ID',
    createEditPage: 'Create Edit Page',
  },
} as const;
