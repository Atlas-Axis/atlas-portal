import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { NotionDatabasePage } from '../../database/notion-database-page';
import { AtlasDatabaseName } from '../atlas/constants';
import {
  NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS,
  NotionDatabasePropertyKey,
  PROPERTY_MAPPING_NAMES,
  REVERSED_NOTION_DATABASE_PROPERTY_MAPPINGS,
  SUPABASE_CHILD_DATABASE_NAME_MAP,
} from '../atlas/notion-database-properties-and-relationships';
import { EnhancedPageObjectResponse } from './fetch-database-pages';
import { readPlainTextValueFromNotionPageProperty } from './read-simple-value-from-property';

export interface DatabasePageChanges {
  newPages: string[]; // Page IDs that exist in Notion but not in Supabase
  deletedPages: string[]; // Page IDs that exist in Supabase but not in Notion
  changedProperties: string[]; // Page IDs with changed properties
  changedRelationships: string[]; // Page IDs with changed relationships
  unchangedPages: string[]; // Page IDs with no changes
}

/**
 * Compares Supabase (old) and Notion (new) database pages to detect changes.
 * Only compares properties and relationships listed in NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS.
 */
export function compareDatabasePages({
  supabasePages,
  notionPages,
  atlasDatabaseName,
}: {
  supabasePages: NotionDatabasePage[];
  notionPages: EnhancedPageObjectResponse[];
  atlasDatabaseName: AtlasDatabaseName;
}): DatabasePageChanges {
  console.log(`🔍 Comparing ${supabasePages.length} Supabase pages with ${notionPages.length} Notion pages`);

  // Create maps for efficient lookup
  const supabasePagesById = new Map<string, NotionDatabasePage>();
  const notionPagesById = new Map<string, EnhancedPageObjectResponse>();

  for (const page of supabasePages) {
    supabasePagesById.set(page.notion_page_id, page);
  }

  for (const page of notionPages) {
    notionPagesById.set(page.id, page);
  }

  // Get the property and relationship mappings for this database
  const databaseConfig = NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[atlasDatabaseName];
  const trackedProperties = Object.values(databaseConfig.properties).filter((prop) => prop !== '');

  const changes: DatabasePageChanges = {
    newPages: [],
    deletedPages: [],
    changedProperties: [],
    changedRelationships: [],
    unchangedPages: [],
  };

  // Check for new pages (exist in Notion but not in Supabase)
  for (const notionPage of notionPages) {
    if (!supabasePagesById.has(notionPage.id)) {
      changes.newPages.push(notionPage.id);
    }
  }

  // Check for deleted pages (exist in Supabase but not in Notion)
  for (const supabasePage of supabasePages) {
    if (!notionPagesById.has(supabasePage.notion_page_id)) {
      changes.deletedPages.push(supabasePage.notion_page_id);
    }
  }

  // Check for changes in existing pages
  for (const notionPage of notionPages) {
    const supabasePage = supabasePagesById.get(notionPage.id);
    if (!supabasePage) {
      continue; // This is a new page, already handled above
    }

    let hasPropertyChanges = false;
    let hasRelationshipChanges = false;

    // Check property changes
    for (const propertyName of trackedProperties) {
      let notionValue = extractNotionPropertyValue(notionPage, propertyName);
      const supabaseValue = extractPropertyValueFromSupabase(supabasePage, propertyName, atlasDatabaseName);

      // Special handling for sortOrder: convert to number from string
      if (propertyName === databaseConfig.properties.sortOrder) {
        notionValue = notionValue !== null ? Number(notionValue) : 0;
      }

      if (!arePropertyValuesEqual(notionValue, supabaseValue)) {
        hasPropertyChanges = true;
        console.log(
          `📝 Property change detected in page ${notionPage.id}: ${propertyName} (Notion: "${JSON.stringify(notionValue)}", Supabase: "${JSON.stringify(supabaseValue)}")`,
        );
      }
    }

    // Check relationship changes using new child array structure
    for (const [targetDb, relationshipName] of Object.entries(databaseConfig.relationships)) {
      const notionRelations = notionPage.enhancedRelations.get(relationshipName) || [];
      const supabaseRelations = getSupabaseChildArray(supabasePage, targetDb as AtlasDatabaseName);

      if (!areRelationshipValuesEqual(notionRelations, supabaseRelations)) {
        hasRelationshipChanges = true;
        console.log(
          `🔗 Relationship change detected in page ${notionPage.id}: ${relationshipName} (Notion: [${notionRelations.join(', ')}], Supabase: [${supabaseRelations.join(', ')}])`,
        );
      }
    }

    // Categorize the page based on what changed
    if (hasPropertyChanges && hasRelationshipChanges) {
      changes.changedProperties.push(notionPage.id);
      changes.changedRelationships.push(notionPage.id);
    } else if (hasPropertyChanges) {
      changes.changedProperties.push(notionPage.id);
    } else if (hasRelationshipChanges) {
      changes.changedRelationships.push(notionPage.id);
    } else {
      changes.unchangedPages.push(notionPage.id);
    }
  }

  console.log(`📊 Change detection results:`);
  console.log(`  - New pages: ${changes.newPages.length}`);
  console.log(`  - Deleted pages: ${changes.deletedPages.length}`);
  console.log(`  - Pages with property changes: ${changes.changedProperties.length}`);
  console.log(`  - Pages with relationship changes: ${changes.changedRelationships.length}`);
  console.log(`  - Unchanged pages: ${changes.unchangedPages.length}`);

  return changes;
}

/**
 * Extracts a property value from a Notion page object response.
 */
function extractNotionPropertyValue(page: PageObjectResponse, propertyName: string): string | number | boolean | null {
  const property = page.properties[propertyName];
  if (property === undefined || property === null) {
    return null;
  }

  return readPlainTextValueFromNotionPageProperty(property);
}

function extractPropertyValueFromSupabase(
  page: NotionDatabasePage,
  notionPropertyName: string,
  atlasDatabaseName: AtlasDatabaseName,
): string | number | null {
  const reversedNotionDatabasePropertyMapping = REVERSED_NOTION_DATABASE_PROPERTY_MAPPINGS[atlasDatabaseName];
  const mappedPropertyName = reversedNotionDatabasePropertyMapping[notionPropertyName];
  if (!mappedPropertyName) {
    console.warn(
      `Property name "${notionPropertyName}" not mapped in reversed property mapping for ${atlasDatabaseName}`,
    );
    return null;
  }
  // Use a type-safe switch to access the correct field
  switch (mappedPropertyName as NotionDatabasePropertyKey) {
    case PROPERTY_MAPPING_NAMES.ATLAS_FULL_DOCUMENT_TITLE:
      return page.canonical_document_title ?? null;
    case PROPERTY_MAPPING_NAMES.ATLAS_DOCUMENT_NO:
      return page.atlas_document_number ?? null;
    case PROPERTY_MAPPING_NAMES.ATLAS_DOCUMENT_NAME:
      return page.plain_text_name ?? null;
    case PROPERTY_MAPPING_NAMES.ATLAS_DOCUMENT_TYPE:
      return page.atlas_document_type ?? null;
    case PROPERTY_MAPPING_NAMES.CONTENT:
      return page.plain_text_content ?? null;
    case PROPERTY_MAPPING_NAMES.SORT_ORDER:
      // If sort order is not a valid number, log a warning. Both integers and fractions are allowed
      if (page.sort_order !== null && isNaN(page.sort_order)) {
        console.warn(`Non numeric sort order for page ${page.notion_page_id}: ${page.sort_order}`);
      }

      return page.sort_order ?? null;
    default:
      console.warn(`Unknown property key: ${mappedPropertyName}. Notion property: ${notionPropertyName}`);
      return null;
  }
}

/**
 * Compares two property values for equality.
 */
function arePropertyValuesEqual(
  value1: string | number | boolean | null,
  value2: string | number | boolean | null,
): boolean {
  if (value1 === null && value2 === null) return true;
  if (value1 === null || value2 === null) return false;
  return value1 === value2;
}

/**
 * Compares two relationship arrays for equality.
 */
function areRelationshipValuesEqual(relations1: string[], relations2: string[]): boolean {
  if (relations1.length !== relations2.length) return false;

  // Sort both arrays to ensure order doesn't matter
  const sorted1 = [...relations1].sort();
  const sorted2 = [...relations2].sort();

  return sorted1.every((id, index) => id === sorted2[index]);
}

/**
 * Gets the appropriate child array from Supabase page based on target database
 */
function getSupabaseChildArray(page: NotionDatabasePage, targetDb: AtlasDatabaseName): string[] {
  const supabaseFieldName = SUPABASE_CHILD_DATABASE_NAME_MAP[targetDb];
  if (!supabaseFieldName) {
    console.warn(`No child array field found for target Atlas database: ${targetDb}`);
    return [];
  }

  const childArray = page[supabaseFieldName as keyof NotionDatabasePage];
  return Array.isArray(childArray) ? childArray as string[] : [];
}
