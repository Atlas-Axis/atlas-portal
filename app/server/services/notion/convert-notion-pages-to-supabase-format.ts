import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { databaseSupportsInternalNesting } from '@/app/atlas/sync/_lib/atlas-database-mapper';
import { AtlasDatabaseName } from '@/app/server/atlas/constants';
import {
  ChildLists,
  NEEDED_RESEARCH_PROPERTY_MAPPING,
  NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS,
  NeededResearchExtraFields,
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  SUPABASE_CHILD_DATABASE_NAME_MAP,
  ScenarioExtraFields,
  ScenarioVariationExtraFields,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
  TypeSpecificationExtraFields,
} from '@/app/server/atlas/notion-database-properties-and-relationships';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { DEBUG_LOGGING } from '@/app/shared/utils/is-debug-logging-enabled';
import { uuidToNoHyphens } from '@/app/shared/utils/utils';
import { Json } from '../supabase/database.types';
import { NotionNestingBugMapping } from '../supabase/notion-nesting-bug-mappings';
import { applyNestingOverrides } from './apply-nesting-overrides';
import { extractRichTextPlainText } from './extract-page-title';
import { EnhancedPageObjectResponse } from './fetch-database-pages';
import { readPlainTextValueFromNotionPageProperty } from './read-simple-value-from-property';

// Local type for future relationship extraction usage
type Relationships = Record<string, string[]>;

/**
 * Convert Notion pages to database format for insertion/upsert
 */
export async function convertNotionPagesToDatabaseFormat({
  notionPages,
  atlasDatabaseName,
  nestingMappings,
}: {
  notionPages: EnhancedPageObjectResponse[];
  atlasDatabaseName: AtlasDatabaseName;
  nestingMappings: NotionNestingBugMapping[];
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
    }
  }

  if (DEBUG_LOGGING()) console.log(`Converted ${databasePages.length} pages to database format`);

  // Apply nesting overrides if this database supports internal nesting and mappings exist
  if (databaseSupportsInternalNesting(atlasDatabaseName) && nestingMappings.length > 0) {
    const pagesWithOverrides = applyNestingOverrides(databasePages, nestingMappings, atlasDatabaseName);
    return pagesWithOverrides;
  }

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
  const pageTitle = extractRichTextPlainText(notionPage, databaseConfig.properties.atlasDocumentName);

  // Extract content - handle null mapping by defaulting to empty string
  const contentPropertyName = databaseConfig.properties.content;
  const content = contentPropertyName
    ? extractRichTextPlainText(notionPage, contentPropertyName)
    : { plainText: '', richText: [] };

  // Extract canonical document title
  const canonicalDocumentTitle = readPlainTextValueFromNotionPageProperty(
    notionPage.properties[databaseConfig.properties.atlasFullDocumentTitle],
  );

  // Extract document number
  const documentNumber = extractDocumentNumber(notionPage, databaseConfig.properties.atlasDocumentNo);

  // Extract document type
  const documentType = extractDocumentType(notionPage, databaseConfig.properties.atlasDocumentType);
  if (!documentType) {
    console.error(`⚠️ Document type is missing for page ${notionPage.id}.`);
    console.error(`🔗 Notion page URL: https://www.notion.so/${uuidToNoHyphens(notionPage.id)}`);
    throw new Error(`Document type is missing for page ${notionPage.id} (${pageTitle.plainText})`);
  }

  // Extract extra fields for "Type Specification" documents
  let extraFields: Json | null = null;
  if (documentType && documentType === 'Type Specification') {
    extraFields = extractTypeSpecificationExtraFields(notionPage) as unknown as Json;
  }
  // Extract extra fields for "Scenario" documents
  else if (documentType === 'Scenario') {
    extraFields = extractScenarioExtraFields(notionPage) as unknown as Json;
  }
  // Extract extra fields for "Scenario Variation" documents
  else if (documentType === 'Scenario Variation') {
    extraFields = extractScenarioVariationExtraFields(notionPage) as unknown as Json;
  }
  // Extract extra fields for "Needed Research" documents
  else if (documentType === 'Needed Research') {
    extraFields = extractNeededResearchExtraFields(notionPage) as unknown as Json;
  }

  // Extract sort order
  const sortOrderPropertyName = databaseConfig.properties.sortOrder;
  const sortOrder = sortOrderPropertyName ? extractSortOrder(notionPage, sortOrderPropertyName) : null;

  // Extract parent page ID if configured
  let parentNotionId: string | null = null;
  if (databaseConfig.parentPropertyName) {
    const parentIds = notionPage.enhancedRelations.get(databaseConfig.parentPropertyName);
    if (parentIds && parentIds.length > 0) {
      if (parentIds.length > 1) {
        console.warn(
          `⚠️ Multiple parent IDs found for page ${notionPage.id} using property "${databaseConfig.parentPropertyName}". Using the first one.`,
        );
      }
      parentNotionId = parentIds[0];
    }
  }

  // Extract relationships keyed by Atlas database name (based on config)
  // Filter out undefined relationship property names
  const definedChildRelationships = Object.fromEntries(
    Object.entries(databaseConfig.childRelationships).filter(([, value]) => value !== undefined),
  ) as Record<string, string>;
  const childIdsByNotionPropertyName = extractRelationships(notionPage, definedChildRelationships);
  const hasChildRelationships = Object.values(childIdsByNotionPropertyName).some((rel) => rel.length > 0);

  // Debug logging
  if (parentNotionId && DEBUG_LOGGING()) {
    console.log(`⬆️ Parent ID for page ${notionPage.id}:`, parentNotionId);
  }
  if (hasChildRelationships && DEBUG_LOGGING()) {
    console.log(`🔥 Child relationships for page ${notionPage.id}:`, childIdsByNotionPropertyName);
  }

  // Determine if page has children (this would need to be implemented based on your hierarchy logic)
  // const hasChildren = determineHasChildren(notionPage, databaseConfig.subItemsPropertyName);

  // Initialize all child-array relationship fields to [] and map from config into child arrays
  let childArrays = initializeChildRelationshipArrays();
  childArrays = mapRelationshipsToChildArrays(
    childIdsByNotionPropertyName,
    databaseConfig.childRelationships,
    childArrays,
  );

  const databasePage: NotionDatabasePage = {
    notion_page_id: notionPage.id,
    canonical_document_title: canonicalDocumentTitle ? String(canonicalDocumentTitle) : null,
    atlas_document_type: documentType as NotionDatabasePage['atlas_document_type'],
    atlas_document_number: documentNumber,
    atlas_database_name: atlasDatabaseName,
    // has_children: hasChildren,
    has_children: false, // TODO: Remove
    archived: notionPage.archived,
    in_trash: notionPage.in_trash,
    plain_text_content: content.plainText,
    json_content: content.richText,
    plain_text_name: pageTitle.plainText,
    json_name: pageTitle.richText,
    parent_notion_page_id: parentNotionId,
    ...childArrays,
    extra_fields: extraFields ?? {},
    sort_order: sortOrder,
    created_at: notionPage.created_time,
    updated_at: notionPage.last_edited_time,
    last_edited_by_user_id: notionPage.last_edited_by?.id || null,
  };

  return databasePage;
}

function initializeChildRelationshipArrays(): ChildLists {
  return {
    child_scope_ids: [],
    child_article_ids: [],
    child_section_and_primary_doc_ids: [],
    child_annotation_ids: [],
    child_tenet_ids: [],
    child_scenario_ids: [],
    child_scenario_variation_ids: [],
    child_active_data_ids: [],
    child_agent_scope_ids: [],
    child_needed_research_ids: [],
  };
}

/**
 * Maps extracted relationship IDs into the appropriate child_*_ids arrays
 */
function mapRelationshipsToChildArrays(
  childIdsByNotionPropertyName: Record<string, string[]>,
  relationshipConfig: Partial<Record<AtlasDatabaseName, string>>,
  initial: ChildLists,
): ChildLists {
  const result: ChildLists = { ...initial };

  for (const [targetDb, notionRelationPropertyName] of Object.entries(relationshipConfig)) {
    // Skip if no relationship property name is defined
    if (!notionRelationPropertyName) {
      continue;
    }

    const ids = childIdsByNotionPropertyName[notionRelationPropertyName] || [];
    const supabaseField = SUPABASE_CHILD_DATABASE_NAME_MAP[targetDb as AtlasDatabaseName] as
      | keyof ChildLists
      | undefined;

    if (!supabaseField || !(supabaseField in result)) {
      // TODO: No child array exists for this target database in the current schema
      if (ids.length > 0) {
        console.warn(`No child array column for target database "${targetDb}". Skipping ${ids.length} IDs.`);
      }
      continue;
    }

    // Append any found IDs to the appropriate child array
    result[supabaseField] = [...(result[supabaseField] || []), ...ids];
  }

  return result;
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
 * Extract child page IDs grouped by Notion relationship property name
 */
function extractRelationships(
  page: EnhancedPageObjectResponse,
  relationshipConfig: Record<string, string>,
): Relationships {
  const relationships: Relationships = {};

  for (const notionRelationPropertyName of Object.values(relationshipConfig)) {
    const relatedPageIds = page.enhancedRelations.get(notionRelationPropertyName) || [];
    relationships[notionRelationPropertyName] = relatedPageIds;
  }

  return relationships;
}

/**
 * Extract Type Specification extra fields from a Notion page
 */
function extractTypeSpecificationExtraFields(page: PageObjectResponse): TypeSpecificationExtraFields {
  const extraFields: TypeSpecificationExtraFields = {
    type_specification_doc_identifier_rules: null,
    type_specification_additional_logic: null,
    type_specification_type_category: null,
    type_specification_type_name: null,
    type_specification_type_overview: null,
    type_specification_components: null,
  };

  // Extract each field using the property mapping
  for (const [supabaseFieldName, notionPropertyName] of Object.entries(TYPE_SPECIFICATION_PROPERTY_MAPPING)) {
    try {
      const property = page.properties[notionPropertyName];
      if (property) {
        const value = readPlainTextValueFromNotionPageProperty(property);
        if (value) {
          const fieldKey = supabaseFieldName as keyof TypeSpecificationExtraFields;
          extraFields[fieldKey] = String(value);
        }
      }
    } catch (error) {
      console.error(`Error extracting Type Specification field "${supabaseFieldName}" from page ${page.id}:`, error);
    }
  }

  return extraFields;
}

/**
 * Extract Scenario extra fields from a Notion page
 */
function extractScenarioExtraFields(page: PageObjectResponse): ScenarioExtraFields {
  const extraFields: ScenarioExtraFields = {
    scenario_additional_guidance: null,
    scenario_finding: null,
    scenario_description: null,
  };

  // Extract each field using the property mapping
  for (const [supabaseFieldName, notionPropertyName] of Object.entries(SCENARIO_PROPERTY_MAPPING)) {
    try {
      const property = page.properties[notionPropertyName];
      if (property) {
        const value = readPlainTextValueFromNotionPageProperty(property);
        if (value) {
          const fieldKey = supabaseFieldName as keyof ScenarioExtraFields;
          extraFields[fieldKey] = String(value);
        }
      }
    } catch (error) {
      console.error(`Error extracting Scenario field "${supabaseFieldName}" from page ${page.id}:`, error);
    }
  }

  return extraFields;
}

/**
 * Extract Scenario Variation extra fields from a Notion page
 */
function extractScenarioVariationExtraFields(page: PageObjectResponse): ScenarioVariationExtraFields {
  const extraFields: ScenarioVariationExtraFields = {
    scenario_variation_additional_guidance: null,
    scenario_variation_finding: null,
    scenario_variation_description: null,
  };

  // Extract each field using the property mapping
  for (const [supabaseFieldName, notionPropertyName] of Object.entries(SCENARIO_VARIATION_PROPERTY_MAPPING)) {
    try {
      const property = page.properties[notionPropertyName];
      if (property) {
        const value = readPlainTextValueFromNotionPageProperty(property);
        if (value) {
          const fieldKey = supabaseFieldName as keyof ScenarioVariationExtraFields;
          extraFields[fieldKey] = String(value);
        }
      }
    } catch (error) {
      console.error(`Error extracting Scenario Variation field "${supabaseFieldName}" from page ${page.id}:`, error);
    }
  }

  return extraFields;
}

/**
 * Extract Needed Research extra fields from a Notion page
 */
function extractNeededResearchExtraFields(page: PageObjectResponse): NeededResearchExtraFields {
  const extraFields: NeededResearchExtraFields = {
    needed_research_content: null,
  };

  // Extract each field using the property mapping
  for (const [supabaseFieldName, notionPropertyName] of Object.entries(NEEDED_RESEARCH_PROPERTY_MAPPING)) {
    try {
      const property = page.properties[notionPropertyName];
      if (property) {
        const value = readPlainTextValueFromNotionPageProperty(property);
        if (value) {
          const fieldKey = supabaseFieldName as keyof NeededResearchExtraFields;
          extraFields[fieldKey] = String(value);
        }
      }
    } catch (error) {
      console.error(`Error extracting Needed Research field "${supabaseFieldName}" from page ${page.id}:`, error);
    }
  }

  return extraFields;
}

/**
 * Determine if a page has children
 * TODO: Delete this function
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function determineHasChildren(page: EnhancedPageObjectResponse, subItemsPropertyName?: string): boolean {
  if (subItemsPropertyName) {
    const subItemsProperty = page.properties[subItemsPropertyName];
    if (subItemsProperty && subItemsProperty.type === 'relation' && subItemsProperty.relation.length > 0) {
      if (DEBUG_LOGGING()) {
        console.log(`Sub-item IDs for page ${page.id}:`, subItemsProperty.relation);
      }
      return true; // Has children
    }
    if (DEBUG_LOGGING()) {
      console.log(`No sub-item IDs found for page ${page.id} using property "${subItemsPropertyName}"`);
    }
  } else console.log(`No sub-items property name defined for page ${page.id}`);

  return false;
}
