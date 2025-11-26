import * as Sentry from '@sentry/nextjs';
import { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import { ExportAtlasTreeBaseDocument } from '@/app/server/atlas/export/types';
import { UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import {
  NEEDED_RESEARCH_PROPERTY_MAPPING,
  NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS,
  NOTION_PROPERTY_TYPE_OVERRIDES,
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '@/app/server/atlas/notion-mapping/notion-database-properties-and-relationships';
import { convertMarkdownToNotionRichText } from '@/app/server/markdown/markdown-to-rich-text';

/**
 * Helper functions for formatting Notion property values
 */

/**
 * Formats a rich_text property.
 * @param value - The text value to format
 * @param uuidMappings - UUID mappings for converting document links
 * @param allowEmpty - If true, empty strings create a single empty text item; if false, empty strings clear the field (empty array)
 */
function formatRichTextProperty(
  value: string,
  uuidMappings: UuidMappings,
  allowEmpty = false,
): { rich_text: unknown[] } {
  if (value === '' && !allowEmpty) {
    return { rich_text: [] };
  }
  if (value === '' && allowEmpty) {
    return { rich_text: [{ text: { content: '' } }] };
  }
  return { rich_text: convertMarkdownToNotionRichText(value, uuidMappings) };
}

function formatTitleProperty(value: string): { title: { text: { content: string } }[] } {
  return { title: [{ text: { content: value } }] };
}

function formatSelectProperty(value: string): { select: { name: string } | null } {
  if (value === '') {
    return { select: null };
  }
  return { select: { name: value } };
}

function formatNumberProperty(value: string): { number: number | null } {
  if (value === '') {
    return { number: null };
  }
  const numValue = Number(value);
  return { number: isNaN(numValue) ? null : numValue };
}

/**
 * Formats a Notion property value based on its property type.
 * Routes to the appropriate formatter function.
 *
 * @param value - The value to format
 * @param propertyType - The Notion property type (rich_text, title, select, number)
 * @param uuidMappings - UUID mappings for converting document links (required for rich_text)
 * @param allowEmpty - For rich_text only: if true, empty strings create a single empty text item // TODO: Remove?
 * @returns Formatted Notion property object, or null if property type is unsupported
 */
function formatNotionProperty(
  value: string,
  propertyType: string,
  uuidMappings: UuidMappings,
  allowEmpty = false,
): Record<string, unknown> | null {
  switch (propertyType) {
    case 'rich_text':
      return formatRichTextProperty(value, uuidMappings, allowEmpty);
    case 'title':
      return formatTitleProperty(value);
    case 'select':
      return formatSelectProperty(value);
    case 'number':
      return formatNumberProperty(value);
    default:
      console.warn(`[notion-property-builder] Unsupported property type "${propertyType}"`);
      return null;
  }
}

/**
 * Builds Notion property objects from Atlas document data.
 * Maps ExportAtlasTreeBaseDocument fields to Notion API property format.
 *
 * Uses the Markdown to Notion Rich Text converter to properly format content
 * with inline formatting (bold, italic, code, links, etc.).
 *
 * Supported property types:
 * - rich_text: Standard text with inline formatting (default)
 * - title: Page title field
 * - select: Single selection from predefined options - knowing the text value is enough, no need to know the ID, as long as the text value exists in the predefined options
 * - number: Numeric values
 *
 * All standard fields are now synced:
 * - Document name
 * - Document number (doc_no)
 * - Document type
 * - Content
 * - Sort order (for databases that have it)
 * - Extra fields (for specific document types)
 */
export function buildNotionProperties(
  doc: ExportAtlasTreeBaseDocument,
  atlasDatabaseName: AtlasDatabaseName,
  uuidMappings: UuidMappings,
): Record<string, unknown> {
  const config = NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[atlasDatabaseName];
  // For those properties that are not rich_text, we read the type
  const typeOverrides = NOTION_PROPERTY_TYPE_OVERRIDES[atlasDatabaseName] || {};
  const properties: Record<string, unknown> = {};

  // Build basic properties
  // Document name property - can be title or rich_text depending on database
  const documentNameNotionPropertyName = config.properties.atlasDocumentName;
  const documentNamePropertyType = typeOverrides[documentNameNotionPropertyName] || 'rich_text';
  const documentName = doc.name || '';

  // Document name is a required field, so allowEmpty = true for rich_text // TODO: Remove?
  const allowEmptyForDocumentName = documentNamePropertyType === 'rich_text';
  properties[documentNameNotionPropertyName] = formatNotionProperty(
    documentName,
    documentNamePropertyType,
    uuidMappings,
    allowEmptyForDocumentName,
  )!;

  // Document number (rich_text) - only sync if it's a different property than document name
  // Some databases (e.g., Sections & Primary Docs) use the same property for both name and doc_no
  const documentNoNotionPropertyName = config.properties.atlasDocumentNo;
  if (documentNoNotionPropertyName !== documentNameNotionPropertyName) {
    const documentNoPropertyType = typeOverrides[documentNoNotionPropertyName] || 'rich_text';
    properties[documentNoNotionPropertyName] = formatNotionProperty(
      doc.doc_no || '',
      documentNoPropertyType,
      uuidMappings,
    )!;
  }

  // Document type (select) - always a select field in Notion
  properties[config.properties.atlasDocumentType] = {
    select: { name: doc.type },
  };

  // Content (always rich_text when defined) - only if content property is defined
  if (config.properties.content) {
    properties[config.properties.content] = formatNotionProperty(doc.content || '', 'rich_text', uuidMappings)!;
  }

  // Sort order property (number) - only for databases that have it (e.g., "Sections & Primary Docs")
  // The sortOrder field comes from the Export Tree and represents the "No." property in Notion
  if (config.properties.sortOrder) {
    const docWithSort = doc as unknown as { sortOrder?: number | string };
    if (docWithSort.sortOrder !== undefined && docWithSort.sortOrder !== null) {
      properties[config.properties.sortOrder] = formatNumberProperty(String(docWithSort.sortOrder));
    }
  }

  // Handle extra fields based on document type
  const docRecord = doc as unknown as Record<string, unknown>;

  if (doc.type === 'Type Specification') {
    addExtraFieldsToProperties(
      properties,
      docRecord,
      atlasDatabaseName,
      TYPE_SPECIFICATION_PROPERTY_MAPPING,
      uuidMappings,
    );
  } else if (doc.type === 'Scenario') {
    addExtraFieldsToProperties(properties, docRecord, atlasDatabaseName, SCENARIO_PROPERTY_MAPPING, uuidMappings);
  } else if (doc.type === 'Scenario Variation') {
    addExtraFieldsToProperties(
      properties,
      docRecord,
      atlasDatabaseName,
      SCENARIO_VARIATION_PROPERTY_MAPPING,
      uuidMappings,
    );
  } else if (doc.type === 'Needed Research') {
    addExtraFieldsToProperties(
      properties,
      docRecord,
      atlasDatabaseName,
      NEEDED_RESEARCH_PROPERTY_MAPPING,
      uuidMappings,
    );
  }

  return properties;
}

/**
 * Adds extra fields to Notion properties object.
 * Distinguishes between:
 * - Field not present (null/undefined): skipped to avoid unnecessary updates
 * - Field present but empty (''): cleared by setting to appropriate empty value based on type
 * - Field present with value: converted to appropriate Notion property format
 *
 * Uses the Markdown to Notion Rich Text converter to properly format extra field content
 * with inline formatting (bold, italic, code, links, etc.).
 *
 * Supports the following Notion property types:
 * - rich_text (default): Standard text with inline formatting
 * - title: Page title field
 * - select: Single selection from predefined options
 * - number: Numeric values
 */
function addExtraFieldsToProperties(
  properties: Record<string, unknown>,
  docRecord: Record<string, unknown>,
  atlasDatabaseName: AtlasDatabaseName,
  fieldMapping: Record<string, string>,
  uuidMappings: UuidMappings,
): void {
  // Get property type overrides for this database (if any)
  const typeOverrides = NOTION_PROPERTY_TYPE_OVERRIDES[atlasDatabaseName] || {};

  for (const [fieldKey, notionPropertyName] of Object.entries(fieldMapping)) {
    const value = docRecord[fieldKey];

    // Skip null/undefined values (field not present in source)
    // This avoids unnecessary updates to Notion
    if (value === null || value === undefined) {
      continue;
    }

    // Get property type (defaults to rich_text if no override)
    const propertyType = typeOverrides[notionPropertyName] || 'rich_text';
    const stringValue = String(value);

    // Format property based on type using dispatcher function
    const formattedProperty = formatNotionProperty(stringValue, propertyType, uuidMappings);

    if (formattedProperty) {
      properties[notionPropertyName] = formattedProperty;
    } else {
      console.warn(
        `[notion-property-builder] Unsupported property type "${propertyType}" for property "${notionPropertyName}" in database "${atlasDatabaseName}"`,
      );
    }
  }
}

/**
 * Builds relationship properties for internally nested databases.
 * Sets the parent page relationship if applicable.
 */
export function addParentPageRelationshipProperty(
  parentPageId: string | null,
  atlasDatabaseName: AtlasDatabaseName,
): Record<string, unknown> {
  const config = NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[atlasDatabaseName];
  const properties: Record<string, unknown> = {};

  // Add parent relationship if this database supports internal nesting
  if (config.parentPropertyName && parentPageId) {
    properties[config.parentPropertyName] = {
      relation: [{ id: parentPageId }],
    };
  }

  return properties;
}

/**
 * Builds relationship properties for inter-database relationships.
 * Sets the parent page relationship when the parent is in a different database.
 *
 * Example: When creating a Section under an Article, this sets the "Parent Article"
 * relationship property on the Section page.
 *
 * Limitation: When a non-Scope document doesn't have a parent, its parent relationship change will not be synced to Notion.
 *
 * @param ancestry The ancestry array (parent UUIDs from immediate parent to root)
 * @param childDatabaseName The database name of the child document being created
 * @param uuidToDocumentMap Map of UUIDs to document objects for deriving parent database
 * @returns Object with relationship properties to merge into page properties, or empty object if no inter-database parent
 */
export function addInterDatabaseRelationshipProperties(
  ancestry: string[] | undefined,
  childDatabaseName: AtlasDatabaseName,
  uuidToDocumentMap: Map<string, ExportAtlasTreeBaseDocument>,
  uuidToDatabase: Map<string, AtlasDatabaseName>,
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};

  if (!ancestry || ancestry.length === 0) {
    // Only log error for non-root databases (not Scopes)
    if (childDatabaseName !== 'Scopes') {
      // const message = 'No ancestry provided for inter-database relationship properties for child database';
      // console.error(message, { childDatabaseName, ancestry });
      // Sentry.captureMessage(message, { level: 'error', extra: { childDatabaseName, ancestry } });

      throw new Error('No ancestry provided for inter-database relationship properties for child database');
    }
    return properties;
  }

  // Workaround: Agent documents' parent relationships are not synced to Notion, so we skip them for now
  if (childDatabaseName === 'Agent Scope Database') {
    return properties;
  }

  // Get the immediate parent UUID (last element in ancestry array)
  const parentId = ancestry[ancestry.length - 1];

  // Get parent document to determine its database
  const parentDoc = uuidToDocumentMap.get(parentId);
  if (!parentDoc) {
    // Parent document not found - invalid reference
    const message = 'Parent document not found for inter-database relationship properties for child database';
    console.error(message, { childDatabaseName, parentId, ancestry });
    Sentry.captureMessage(message, { level: 'error', extra: { childDatabaseName, parentId, ancestry } });
    return properties;
  }

  // Derive parent's database name from database tracking map
  const parentDatabaseName = uuidToDatabase.get(parentId);
  if (!parentDatabaseName) {
    // Parent database not found - invalid reference
    const message = 'Parent database not found for inter-database relationship properties';
    console.error(message, { childDatabaseName, parentId, ancestry });
    Sentry.captureMessage(message, { level: 'error', extra: { childDatabaseName, parentId, ancestry } });
    return properties;
  }

  // Only set relationship if parent is in a different database (cross-database relationship)
  if (parentDatabaseName === childDatabaseName) {
    // Same database - internal hierarchy handled by addParentPageRelationshipProperty
    return properties;
  }

  // Look up the relationship property name on the child's database
  const childConfig = NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[childDatabaseName];
  const relationshipPropertyName = childConfig.parentRelationships[parentDatabaseName];

  if (!relationshipPropertyName) {
    // No relationship defined between these databases
    throw new Error('No relationship defined between databases');
  }

  // Set the relationship property
  // When we set the child→parent relationship, Notion automatically updates the reverse relationship
  properties[relationshipPropertyName] = {
    relation: [{ id: parentId }],
  };

  return properties;
}
