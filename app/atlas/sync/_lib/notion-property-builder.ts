import { AtlasDatabaseName } from '@/app/server/atlas/constants';
import { BaseAtlasDocument } from '@/app/server/atlas/json-export/types';
import { UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import {
  NEEDED_RESEARCH_PROPERTY_MAPPING,
  NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS,
  NOTION_PROPERTY_TYPE_OVERRIDES,
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '@/app/server/atlas/notion-database-properties-and-relationships';
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
 * Maps BaseAtlasDocument fields to Notion API property format.
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
 * Current limitations:
 * - Document number (doc_no) not synced
 * - Sort order not synced (only affects "Sections & Primary Docs" database)
 */
export function buildNotionProperties(
  doc: BaseAtlasDocument,
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

  // Document number (rich_text) - NOT SYNCED (commented out for now)
  // const documentNoPropertyType = typeOverrides[config.properties.atlasDocumentNo] || 'rich_text';
  // properties[config.properties.atlasDocumentNo] = formatNotionProperty(
  //   doc.doc_no || '',
  //   documentNoPropertyType,
  //   uuidMappings,
  // )!;

  // Document type (select) - always a select field in Notion
  properties[config.properties.atlasDocumentType] = {
    select: { name: doc.type },
  };

  // Content (always rich_text when defined) - only if content property is defined
  if (config.properties.content) {
    properties[config.properties.content] = formatNotionProperty(doc.content || '', 'rich_text', uuidMappings)!;
  }

  // TODO: Handle sortOrder property
  // if (config.properties.sortOrder) {
  //   properties[config.properties.sortOrder] = formatNotionProperty(doc.sortOrder || '', 'number', uuidMappings)!;
  // }

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
