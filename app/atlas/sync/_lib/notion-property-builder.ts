import { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import { STANDARDIZED_DOCUMENT_NUMBER, STANDARDIZED_DOCUMENT_TITLE } from '@/app/server/atlas/constants';
import { ExportAtlasTreeBaseDocument } from '@/app/server/atlas/export/types';
import { UuidMappings, normalizeUuidForLookup } from '@/app/server/atlas/load-uuid-mapping';
import {
  NEEDED_RESEARCH_PROPERTY_MAPPING,
  NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS,
  NOTION_PROPERTY_TYPE_OVERRIDES,
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '@/app/server/atlas/notion-mapping/notion-database-properties-and-relationships';
import { ContentConversionWarning, convertMarkdownToNotionRichText } from '@/app/server/markdown/markdown-to-rich-text';
import type { FieldFilters } from '@/app/server/services/markdown-notion-sync/types';

// Re-export ContentConversionWarning for callers
export type { ContentConversionWarning } from '@/app/server/markdown/markdown-to-rich-text';

/**
 * Helper functions for formatting Notion property values
 */

/**
 * Formats a rich_text property.
 * @param value - The text value to format
 * @param uuidMappings - UUID mappings for converting document links
 * @param allowEmpty - If true, empty strings create a single empty text item; if false, empty strings clear the field (empty array)
 * @param warnings - Optional array to collect conversion warnings
 */
function formatRichTextProperty(
  value: string,
  uuidMappings: UuidMappings,
  allowEmpty = false,
  warnings?: ContentConversionWarning[],
): { rich_text: unknown[] } {
  if (value === '' && !allowEmpty) {
    return { rich_text: [] };
  }
  if (value === '' && allowEmpty) {
    return { rich_text: [{ text: { content: '' } }] };
  }
  return { rich_text: convertMarkdownToNotionRichText(value, uuidMappings, warnings) };
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
 * @param allowEmpty - For rich_text only: if true, empty strings create [{ text: { content: '' } }] instead of [].
 *                     This is needed for required fields to ensure they're never completely empty.
 * @param warnings - Optional array to collect conversion warnings (for rich_text only)
 * @returns Formatted Notion property object, or null if property type is unsupported
 */
function formatNotionProperty(
  value: string,
  propertyType: string,
  uuidMappings: UuidMappings,
  allowEmpty = false,
  warnings?: ContentConversionWarning[],
): Record<string, unknown> | null {
  switch (propertyType) {
    case 'rich_text':
      return formatRichTextProperty(value, uuidMappings, allowEmpty, warnings);
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
 * - select: Single selection from predefined options
 * - number: Numeric values
 *
 * All standard fields are now synced:
 * - Document name
 * - Document number (doc_no)
 * - Document type
 * - Content
 * - Extra fields (for specific document types)
 *
 * @param doc - The Atlas document to convert
 * @param atlasDatabaseName - The Atlas database name for property mapping
 * @param uuidMappings - UUID mappings for converting document links
 * @param warnings - Optional array to collect conversion warnings (e.g., truncation)
 */
export function buildNotionProperties(
  doc: ExportAtlasTreeBaseDocument,
  atlasDatabaseName: AtlasDatabaseName,
  uuidMappings: UuidMappings,
  warnings?: ContentConversionWarning[],
): Record<string, unknown> {
  const config = NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[atlasDatabaseName];
  const properties: Record<string, unknown> = {};

  // ============================================================================
  // MIGRATION SAFETY: Old fields (Name, No., etc.) are NOT written during sync
  // to preserve them as a backup. Only new standardized fields are written.
  // See: docs/action-plans/NOTION_PROPERTY_STANDARDIZATION_ACTION_PLAN.md
  // ============================================================================

  // Document type (select) - always a select field in Notion
  properties[config.properties.atlasDocumentType] = {
    select: { name: doc.type },
  };

  // Content (always rich_text when defined) - only if content property is defined
  if (config.properties.content) {
    properties[config.properties.content] = formatNotionProperty(
      doc.content || '',
      'rich_text',
      uuidMappings,
      false,
      warnings,
    )!;
  }

  // ============================================================================
  // NEW STANDARDIZED FIELDS (Phase 2 of Property Standardization)
  // During migration, we ONLY write to new standardized fields to preserve old
  // fields as a backup. These fields are the same across all databases.
  // See: docs/action-plans/NOTION_PROPERTY_STANDARDIZATION_ACTION_PLAN.md
  // ============================================================================

  // Document Number - standardized field for doc_no (always rich_text)
  properties[STANDARDIZED_DOCUMENT_NUMBER] = formatNotionProperty(
    doc.doc_no || '',
    'rich_text',
    uuidMappings,
    false,
    warnings,
  )!;

  // Document Title - standardized field for document name (always rich_text)
  // Note: We don't use allowEmpty here because Document Title is a new field
  // and empty values are acceptable during the transition period
  properties[STANDARDIZED_DOCUMENT_TITLE] = formatNotionProperty(
    doc.name || '',
    'rich_text',
    uuidMappings,
    false,
    warnings,
  )!;

  // ============================================================================

  // Handle extra fields based on document type
  const docRecord = doc as unknown as Record<string, unknown>;

  if (doc.type === 'Type Specification') {
    addExtraFieldsToProperties(
      properties,
      docRecord,
      atlasDatabaseName,
      TYPE_SPECIFICATION_PROPERTY_MAPPING,
      uuidMappings,
      warnings,
    );
  } else if (doc.type === 'Scenario') {
    addExtraFieldsToProperties(
      properties,
      docRecord,
      atlasDatabaseName,
      SCENARIO_PROPERTY_MAPPING,
      uuidMappings,
      warnings,
    );
  } else if (doc.type === 'Scenario Variation') {
    addExtraFieldsToProperties(
      properties,
      docRecord,
      atlasDatabaseName,
      SCENARIO_VARIATION_PROPERTY_MAPPING,
      uuidMappings,
      warnings,
    );
  } else if (doc.type === 'Needed Research') {
    addExtraFieldsToProperties(
      properties,
      docRecord,
      atlasDatabaseName,
      NEEDED_RESEARCH_PROPERTY_MAPPING,
      uuidMappings,
      warnings,
    );
  }

  return properties;
}

/**
 * Builds Notion property objects from Atlas document data, filtered by field filters.
 * Only includes properties for fields that are enabled in the filters.
 * Used for partial page updates where only specific fields should be synced.
 *
 * This function is specifically for content change updates (not additions/deletions).
 *
 * @param doc - The Atlas document to convert
 * @param atlasDatabaseName - The Atlas database name for property mapping
 * @param uuidMappings - UUID mappings for converting document links
 * @param fieldFilters - Which fields to include in the properties
 * @param warnings - Optional array to collect conversion warnings (e.g., truncation)
 */
export function buildNotionPropertiesFiltered(
  doc: ExportAtlasTreeBaseDocument,
  atlasDatabaseName: AtlasDatabaseName,
  uuidMappings: UuidMappings,
  fieldFilters: FieldFilters,
  warnings?: ContentConversionWarning[],
): Record<string, unknown> {
  const config = NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[atlasDatabaseName];
  const typeOverrides = NOTION_PROPERTY_TYPE_OVERRIDES[atlasDatabaseName] || {};
  const properties: Record<string, unknown> = {};

  // Document name property - only if name filter is enabled
  if (fieldFilters.name) {
    const documentNameNotionPropertyName = config.properties.atlasDocumentName;
    const documentNamePropertyType = typeOverrides[documentNameNotionPropertyName] || 'rich_text';
    const documentName = doc.name || '';
    const allowEmptyForDocumentName = documentNamePropertyType === 'rich_text';
    properties[documentNameNotionPropertyName] = formatNotionProperty(
      documentName,
      documentNamePropertyType,
      uuidMappings,
      allowEmptyForDocumentName,
      warnings,
    )!;

    // Also update standardized Document Title field
    properties[STANDARDIZED_DOCUMENT_TITLE] = formatNotionProperty(
      doc.name || '',
      'rich_text',
      uuidMappings,
      false,
      warnings,
    )!;
  }

  // Document number - only if docNo filter is enabled
  if (fieldFilters.docNo) {
    const documentNoNotionPropertyName = config.properties.atlasDocumentNo;
    const documentNameNotionPropertyName = config.properties.atlasDocumentName;

    // Only sync if it's a different property than document name
    if (documentNoNotionPropertyName !== documentNameNotionPropertyName) {
      const documentNoPropertyType = typeOverrides[documentNoNotionPropertyName] || 'rich_text';
      properties[documentNoNotionPropertyName] = formatNotionProperty(
        doc.doc_no || '',
        documentNoPropertyType,
        uuidMappings,
        false,
        warnings,
      )!;
    }

    // Also update standardized Document Number field
    properties[STANDARDIZED_DOCUMENT_NUMBER] = formatNotionProperty(
      doc.doc_no || '',
      'rich_text',
      uuidMappings,
      false,
      warnings,
    )!;
  }

  // Document type - only if type filter is enabled
  if (fieldFilters.type) {
    properties[config.properties.atlasDocumentType] = {
      select: { name: doc.type },
    };
  }

  // Content - only if content filter is enabled
  if (fieldFilters.content && config.properties.content) {
    properties[config.properties.content] = formatNotionProperty(
      doc.content || '',
      'rich_text',
      uuidMappings,
      false,
      warnings,
    )!;
  }

  // Extra fields - only if extraFields filter is enabled
  if (fieldFilters.extraFields) {
    const docRecord = doc as unknown as Record<string, unknown>;

    if (doc.type === 'Type Specification') {
      addExtraFieldsToProperties(
        properties,
        docRecord,
        atlasDatabaseName,
        TYPE_SPECIFICATION_PROPERTY_MAPPING,
        uuidMappings,
        warnings,
      );
    } else if (doc.type === 'Scenario') {
      addExtraFieldsToProperties(
        properties,
        docRecord,
        atlasDatabaseName,
        SCENARIO_PROPERTY_MAPPING,
        uuidMappings,
        warnings,
      );
    } else if (doc.type === 'Scenario Variation') {
      addExtraFieldsToProperties(
        properties,
        docRecord,
        atlasDatabaseName,
        SCENARIO_VARIATION_PROPERTY_MAPPING,
        uuidMappings,
        warnings,
      );
    } else if (doc.type === 'Needed Research') {
      addExtraFieldsToProperties(
        properties,
        docRecord,
        atlasDatabaseName,
        NEEDED_RESEARCH_PROPERTY_MAPPING,
        uuidMappings,
        warnings,
      );
    }
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
  warnings?: ContentConversionWarning[],
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
    const formattedProperty = formatNotionProperty(stringValue, propertyType, uuidMappings, false, warnings);

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
 * IMPORTANT: The ancestry array contains Atlas document UUIDs, but Notion API requires
 * Notion page IDs for relationship properties. This function converts the parent's Atlas UUID
 * to its Notion page ID using the provided uuidMappings.
 *
 * Limitation: When a non-Scope document doesn't have a parent, its parent relationship change will not be synced to Notion.
 *
 * @param ancestry The ancestry array (Atlas document UUIDs from immediate parent to root)
 * @param childDatabaseName The database name of the child document being created
 * @param uuidToDocumentMap Map of Atlas UUIDs to document objects for deriving parent database
 * @param uuidToDatabase Map of Atlas UUIDs to database names (from buildLookupMaps)
 * @param uuidMappings UUID mappings for converting Atlas UUIDs to Notion page IDs
 * @returns Object with relationship properties to merge into page properties, or empty object if no inter-database parent
 */
export function addInterDatabaseRelationshipProperties(
  ancestry: string[] | undefined,
  childDatabaseName: AtlasDatabaseName,
  uuidToDocumentMap: Map<string, ExportAtlasTreeBaseDocument>,
  uuidToDatabase: Map<string, AtlasDatabaseName>,
  uuidMappings: UuidMappings,
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};

  if (!ancestry || ancestry.length === 0) {
    // Only log error for non-root databases (not Scopes)
    if (childDatabaseName !== 'Scopes') {
      // const message = 'No ancestry provided for inter-database relationship properties for child database';
      // console.error(message, { childDatabaseName, ancestry });
      // console.error(message, { level: 'error', extra: { childDatabaseName, ancestry } });

      throw new Error('No ancestry provided for inter-database relationship properties for child database');
    }
    return properties;
  }

  // Get the immediate parent Atlas UUID (last element in ancestry array)
  const parentAtlasUuid = ancestry[ancestry.length - 1];

  // Get parent document to determine its database
  const parentDoc = uuidToDocumentMap.get(parentAtlasUuid);
  if (!parentDoc) {
    // Parent document not found - invalid reference
    const message = 'Parent document not found for inter-database relationship properties for child database';
    console.error(message, { childDatabaseName, parentAtlasUuid, ancestry });
    console.error(message, { level: 'error', extra: { childDatabaseName, parentAtlasUuid, ancestry } });
    return properties;
  }

  // Derive parent's database name from database tracking map
  const parentDatabaseName = uuidToDatabase.get(parentAtlasUuid);
  if (!parentDatabaseName) {
    // Parent database not found - invalid reference
    const message = 'Parent database not found for inter-database relationship properties';
    console.error(message, { childDatabaseName, parentAtlasUuid, ancestry });
    console.error(message, { level: 'error', extra: { childDatabaseName, parentAtlasUuid, ancestry } });
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

  // Convert Atlas UUID to Notion page ID for the relationship property (normalize for case-insensitive lookup)
  const parentNotionPageId = uuidMappings.atlasUUIDsToNotionPageIds.get(normalizeUuidForLookup(parentAtlasUuid));
  if (!parentNotionPageId) {
    throw new Error(
      `No Notion page ID mapping found for parent Atlas UUID ${parentAtlasUuid}. ` +
        `This may indicate the parent page hasn't been created yet or the UUID mapping is missing.`,
    );
  }

  // Set the relationship property using the Notion page ID
  // When we set the child→parent relationship, Notion automatically updates the reverse relationship
  properties[relationshipPropertyName] = {
    relation: [{ id: parentNotionPageId }],
  };

  return properties;
}
