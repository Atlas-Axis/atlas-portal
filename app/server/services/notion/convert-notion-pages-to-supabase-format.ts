import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { NotionDatabasePage, Relationships } from '../../database/notion-database-page';
import { AtlasDatabaseName } from '../atlas/constants';
import { NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS } from '../atlas/notion-database-properties-and-relationships';
import { extractPageTitle } from './extract-page-title';
import { EnhancedPageObjectResponse } from './fetch-database-pages';
import { readPlainTextValueFromNotionPageProperty } from './read-simple-value-from-property';

const DEBUG_LOGGING = Boolean(Number(process.env.DEBUG_LOGGING));

/**
 * Convert Notion pages to database format for insertion/upsert
 */
export async function convertNotionPagesToDatabaseFormat({
  notionPages,
  atlasDatabaseName,
}: {
  notionPages: EnhancedPageObjectResponse[];
  atlasDatabaseName: AtlasDatabaseName;
}): Promise<NotionDatabasePage[]> {
  console.log(`🔄 Converting ${notionPages.length} Notion pages to database format...`);

  const databaseConfig = NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[atlasDatabaseName];
  const databasePages: NotionDatabasePage[] = [];

  for (const notionPage of notionPages) {
    try {
      const page = await convertSingleNotionPageToDatabaseFormat(notionPage, atlasDatabaseName, databaseConfig);
      databasePages.push(page);
    } catch (error) {
      console.error(`❌ Failed to convert page ${notionPage.id}:`, error);
      throw error;
    }
  }

  if (DEBUG_LOGGING) console.log(`Converted ${databasePages.length} pages to database format`);

  return databasePages;
}

/**
 * Convert a single Notion page to database format
 */
async function convertSingleNotionPageToDatabaseFormat(
  notionPage: EnhancedPageObjectResponse,
  atlasDatabaseName: AtlasDatabaseName,
  databaseConfig: (typeof NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS)[AtlasDatabaseName],
): Promise<NotionDatabasePage> {
  // Extract page title
  const pageTitle = extractPageTitle(notionPage, databaseConfig.properties.atlasDocumentName);

  // Extract content
  const content = extractPageTitle(notionPage, databaseConfig.properties.content);

  // Extract canonical document title
  const canonicalDocumentTitleResult = extractPageTitle(notionPage, databaseConfig.properties.atlasFullDocumentTitle);
  const canonicalDocumentTitle = canonicalDocumentTitleResult.plainText;

  // Extract document number
  const documentNumber = extractDocumentNumber(notionPage, databaseConfig.properties.atlasDocumentNo);

  // Extract document type
  const documentType = extractDocumentType(notionPage, databaseConfig.properties.atlasDocumentType);
  if (!documentType) {
    console.warn(`⚠️ Document type is missing for page ${notionPage.id}. Setting to "Placeholder".`);
  }

  // Extract sort order
  const sortOrder = extractSortOrder(notionPage, databaseConfig.properties.sortOrder);

  // Extract relationships
  const relationships = extractRelationships(notionPage, databaseConfig.relationships);
  const hasRelationships = Object.values(relationships).some((rel) => rel.length > 0);

  // TODO: Only log in verbose logging mode
  // if (hasRelationships && DEBUG_LOGGING) {
  if (hasRelationships) {
    console.log(`🔥 Relationships for page ${notionPage.id}:`, relationships);
  }

  // Determine parent page ID (this would need to be implemented based on your hierarchy logic)
  const parentNotionPageId = extractParentPageId(notionPage, databaseConfig.parentPropertyName);

  // Determine if page has children (this would need to be implemented based on your hierarchy logic)
  const hasChildren = determineHasChildren(notionPage, databaseConfig.subItemsPropertyName);

  const databasePage: NotionDatabasePage = {
    notion_page_id: notionPage.id,
    parent_notion_page_id: parentNotionPageId,
    canonical_document_title: canonicalDocumentTitle,
    atlas_document_type: (documentType as NotionDatabasePage['atlas_document_type']) || 'Placeholder',
    atlas_document_number: documentNumber,
    atlas_database_name: atlasDatabaseName,
    has_children: hasChildren,
    archived: notionPage.archived,
    in_trash: notionPage.in_trash,
    plain_text_content: content.plainText,
    json_content: content.richText,
    plain_text_name: pageTitle.plainText,
    json_name: pageTitle.richText,
    relationships: relationships,
    sort_order: sortOrder,
    created_at: notionPage.created_time,
    updated_at: notionPage.last_edited_time,
    last_edited_by_user_id: notionPage.last_edited_by?.id || null,
  };

  return databasePage;
}

/**
 * Extract document number from a Notion page
 */
function extractDocumentNumber(page: PageObjectResponse, numberPropertyName: string): string {
  try {
    const property = page.properties[numberPropertyName];
    if (!property) {
      console.warn(`Property "${numberPropertyName}" not found in page ${page.id}`);
      return '';
    }

    const value = readPlainTextValueFromNotionPageProperty(property);
    return value ? String(value) : '';
  } catch (error) {
    console.error(`Error extracting document number from page ${page.id}:`, error);
    return '';
  }
}

/**
 * Extract document type from a Notion page
 */
function extractDocumentType(page: PageObjectResponse, typePropertyName: string): string | null {
  try {
    const property = page.properties[typePropertyName];
    if (!property) {
      console.warn(`Property "${typePropertyName}" not found in page ${page.id}`);
      return null;
    }

    const value = readPlainTextValueFromNotionPageProperty(property);
    return value ? String(value) : null;
  } catch (error) {
    console.error(`Error extracting document type from page ${page.id}:`, error);
    return null;
  }
}

/**
 * Extract sort order from a Notion page
 */
function extractSortOrder(page: PageObjectResponse, sortOrderPropertyName: string): number {
  try {
    const property = page.properties[sortOrderPropertyName];
    if (!property) {
      console.warn(`Property "${sortOrderPropertyName}" not found in page ${page.id}`);
      return 0;
    }

    const value = readPlainTextValueFromNotionPageProperty(property);
    if (!value) {
      return 0;
    }

    const numValue = Number(value);

    // Validate that it's a valid positive number (integers and fractions allowed, no negative numbers)
    if (isNaN(numValue) || !isFinite(numValue) || numValue < 0) {
      console.warn(
        `Invalid sort order value "${value}" in page ${page.id}. Must be a positive number. Using 0 instead.`,
      );
      return 0;
    }

    return numValue;
  } catch (error) {
    console.error(`Error extracting sort order from page ${page.id}:`, error);
    return 0;
  }
}

/**
 * Extract relationships from a Notion page
 */
function extractRelationships(
  page: EnhancedPageObjectResponse,
  relationshipConfig: Record<string, string>,
): Relationships {
  const relationships: Relationships = {};

  for (const [relationshipName] of Object.entries(relationshipConfig)) {
    const relatedPageIds = page.enhancedRelations.get(relationshipName) || [];
    relationships[relationshipName] = relatedPageIds;
  }

  return relationships;
}

/**
 * Extract parent page ID from a Notion page
 */
function extractParentPageId(page: EnhancedPageObjectResponse, parentPropertyName?: string): string | null {
  if (parentPropertyName) {
    const parentProperty = page.properties[parentPropertyName];
    if (parentProperty && parentProperty.type === 'relation' && parentProperty.relation.length > 0) {
      if (DEBUG_LOGGING) {
        console.log(`Parent IDs for page ${page.id}:`, parentProperty.relation);
      }
      return parentProperty.relation[0].id; // Assuming single parent
    }
    if (DEBUG_LOGGING) {
      console.log(`No parent IDs found for page ${page.id} using property "${parentPropertyName}"`);
    }
  } else console.log(`No parent property name defined for page ${page.id}`);

  return null;
}

/**
 * Determine if a page has children
 */
function determineHasChildren(page: EnhancedPageObjectResponse, subItemsPropertyName?: string): boolean {
  if (subItemsPropertyName) {
    const subItemsProperty = page.properties[subItemsPropertyName];
    if (subItemsProperty && subItemsProperty.type === 'relation' && subItemsProperty.relation.length > 0) {
      if (DEBUG_LOGGING) {
        console.log(`Sub-item IDs for page ${page.id}:`, subItemsProperty.relation);
      }
      return true; // Has children
    }
    if (DEBUG_LOGGING) {
      console.log(`No sub-item IDs found for page ${page.id} using property "${subItemsPropertyName}"`);
    }
  } else console.log(`No sub-items property name defined for page ${page.id}`);

  return false;
}
