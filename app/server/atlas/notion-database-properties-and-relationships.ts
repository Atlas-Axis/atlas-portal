import { Tables } from '@/app/server/services/supabase/database.types';
import { ATLAS_DATABASES, AtlasDatabaseName } from './constants';

export interface NotionDatabasePropertyMapping {
  // TODO: Delete atlasFullDocumentTitle - in Atlas Explorer, there are only two fields: Document No and Document Name
  atlasFullDocumentTitle: string; // A property name representing the full title, including the document number and name, e.g. "A.3.1.1 - Scope Improvement"
  atlasDocumentNo: string; // A property name representing the formal document ID, e.g. "A.3.1.1"
  atlasDocumentName: string; // A property name representing the document name, e.g. "Scope Improvement"
  atlasDocumentType: string; // A property name representing the type of document, e.g. "Core", "Section"...
  content: string | null; // A property name representing the main content or body of the document, or null if content is stored in extra_fields instead
  sortOrder?: string; // A property name representing the manually set order of the document within its parent or section
}

export type NotionDatabasePropertyKey = keyof NotionDatabasePropertyMapping;

export const PROPERTY_MAPPING_NAMES = {
  ATLAS_FULL_DOCUMENT_TITLE: 'atlasFullDocumentTitle',
  ATLAS_DOCUMENT_NO: 'atlasDocumentNo',
  ATLAS_DOCUMENT_NAME: 'atlasDocumentName',
  ATLAS_DOCUMENT_TYPE: 'atlasDocumentType',
  CONTENT: 'content',
  SORT_ORDER: 'sortOrder',
} as const satisfies Record<string, NotionDatabasePropertyKey>;

/**
 * Docs for Notion database properties
 * - https://developers.notion.com/reference/property-object
 *
 * Examples:
 * - Current Doc No (or Temp Name): "A.3.1 - A1 - Scope Improvement"
 * - Name: "Scope Improvement"
 * - Formal Doc ID: "A.3.1.1"
 *
 * TODO: Simplify the property mappings
 *  - atlasFullDocumentTitle and atlasDocumentName are always the same
 *  - atlasDocumentNo doesn't seem to be used at all - Use AI to process all code usages and update docs
 */
export const NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS: Record<
  AtlasDatabaseName,
  {
    properties: NotionDatabasePropertyMapping;
    childRelationships: Partial<Record<AtlasDatabaseName, string>>;
    parentRelationships: Partial<Record<AtlasDatabaseName, string>>; // The name of the relationship property in this database that links to the parent database. There may be more than one parent relationships.
    parentPropertyName?: string;
    // subItemsPropertyName?: string;
  }
> = {
  [ATLAS_DATABASES.SCOPES]: {
    properties: {
      atlasFullDocumentTitle: 'Name', // rich_text
      atlasDocumentNo: 'Doc No', // title
      atlasDocumentName: 'Name', // rich_text
      atlasDocumentType: 'Type', // select
      content: 'Content', // rich_text
    },
    childRelationships: {
      [ATLAS_DATABASES.ARTICLES]: 'Articles',
      [ATLAS_DATABASES.NEEDED_RESEARCH]: 'Needed Research',
    },
    parentRelationships: {},
  },
  [ATLAS_DATABASES.ARTICLES]: {
    properties: {
      atlasFullDocumentTitle: 'Name', // rich_text
      atlasDocumentNo: 'Doc No', // title
      atlasDocumentName: 'Name', // rich_text
      atlasDocumentType: 'Type', // select
      content: 'Content', // rich_text
    },
    childRelationships: {
      [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: 'Sections & Primary Docs', // TODO: MAJOR ISSUE! This references not only the direct children but ALL nested children!
      // [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: 'Sections & Primary Docs',
      [ATLAS_DATABASES.ANNOTATIONS]: 'Annotations',
      // [ATLAS_DATABASES.TENETS]: 'Tenets',
      // [ATLAS_DATABASES.SCENARIOS]: 'Scenarios',
      [ATLAS_DATABASES.NEEDED_RESEARCH]: 'Needed Research',
      // TODO: Tenets + Scenarios + Annotations? - Atlas PH importer does relationship mapping to these too
    },
    parentRelationships: {
      [ATLAS_DATABASES.SCOPES]: 'Parent Scope',
    },
  },
  [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: {
    properties: {
      atlasFullDocumentTitle: 'Doc No (or Temp Name)', // Note: This is the same as `Name` with a prefix like `A.1.2 - ` // title
      atlasDocumentNo: 'Doc No (or Temp Name)', // Previously 'Formal Doc ID' - but that doesn't match the PH importer mapping // title
      atlasDocumentName: 'Doc No (or Temp Name)', // "Name" was previously formula, but now title
      atlasDocumentType: 'Type', // select
      content: 'Content', // rich_text
      sortOrder: 'No.', // number
    },
    childRelationships: {
      [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: 'Subdocs',
      [ATLAS_DATABASES.ANNOTATIONS]: 'Annotations',
      [ATLAS_DATABASES.TENETS]: 'Tenets',
      [ATLAS_DATABASES.ACTIVE_DATA]: 'Active Data',
      [ATLAS_DATABASES.NEEDED_RESEARCH]: 'Needed Research',
      // Extra in PH importer: "Files & media"
    },
    parentRelationships: {
      [ATLAS_DATABASES.ARTICLES]: 'Parent Article',
    },
    parentPropertyName: 'Parent Doc',
    // subItemsPropertyName: 'Subdocs',
  },
  [ATLAS_DATABASES.AGENTS]: {
    properties: {
      atlasFullDocumentTitle: 'Document Name', // title
      atlasDocumentNo: 'Formal Doc ID', // rich_text // TODO: Is this field used at all?
      atlasDocumentName: 'Document Name', // title
      atlasDocumentType: 'Doc Type', // select
      content: 'Content', // rich_text
    },
    childRelationships: {
      [ATLAS_DATABASES.ANNOTATIONS]: 'Annotations',
      [ATLAS_DATABASES.TENETS]: 'Tenets',
      [ATLAS_DATABASES.ACTIVE_DATA]: 'Active Data',
      [ATLAS_DATABASES.AGENTS]: 'Sub-item',
      [ATLAS_DATABASES.NEEDED_RESEARCH]: 'Needed Research',
    },
    parentRelationships: {
      // TODO: We are not syncing parent relationships for Agent Scope Database documents at the moment because the relationships in Notion are not defined - we should add this later!
    },
    parentPropertyName: 'Parent item',
    // subItemsPropertyName: 'Sub-item',
  },
  [ATLAS_DATABASES.ANNOTATIONS]: {
    properties: {
      atlasFullDocumentTitle: 'Doc No', // "Name" was previously formula, but now title
      atlasDocumentNo: 'Doc No', // title
      atlasDocumentName: 'Doc No', // "Name" was previously formula, but now title
      atlasDocumentType: 'Type', // select
      content: 'Content', // rich_text
    },
    childRelationships: {
      [ATLAS_DATABASES.NEEDED_RESEARCH]: 'Needed Research',
    },
    parentRelationships: {
      [ATLAS_DATABASES.ARTICLES]: 'Target Article',
      [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: 'Parent Section / Primary Doc',
      [ATLAS_DATABASES.AGENTS]: 'Agent Scope',
    },
  },
  [ATLAS_DATABASES.TENETS]: {
    properties: {
      atlasFullDocumentTitle: 'Doc No (or Temp Name)', // title
      atlasDocumentNo: 'Doc No (or Temp Name)', // title
      atlasDocumentName: 'Doc No (or Temp Name)', // "Name" was previously formula, but now title
      atlasDocumentType: 'Type', // select
      content: 'Content', // rich_text
    },
    childRelationships: {
      [ATLAS_DATABASES.SCENARIOS]: 'Scenarios',
      [ATLAS_DATABASES.NEEDED_RESEARCH]: 'Needed Research',
    },
    parentRelationships: {
      // [ATLAS_DATABASES.ARTICLES]: '', // TODO: Remove this relationship and the corresponding relationship in the Articles mapping?
      [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: 'Parent Section/Primary Doc',
      [ATLAS_DATABASES.AGENTS]: 'Agent Scope',
    },
  },
  [ATLAS_DATABASES.ACTIVE_DATA]: {
    properties: {
      atlasFullDocumentTitle: 'Doc No', // "Name" was previously formula, but now title
      atlasDocumentNo: 'Doc No', // title
      atlasDocumentName: 'Doc No', // "Name" was previously formula, but now title
      atlasDocumentType: 'Type', // select
      content: 'Content', // rich_text
    },
    childRelationships: {
      [ATLAS_DATABASES.NEEDED_RESEARCH]: 'Needed Research',
    },
    parentRelationships: {
      [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: 'Parent Section / Primary Doc',
      [ATLAS_DATABASES.AGENTS]: 'Agent Scope',
    },
  },
  [ATLAS_DATABASES.SCENARIOS]: {
    properties: {
      atlasFullDocumentTitle: 'Doc No (or Temp Name)', // title
      atlasDocumentNo: 'Doc No (or Temp Name)', // title
      atlasDocumentName: 'Doc No (or Temp Name)', // "Name" was previously formula, but now title
      atlasDocumentType: 'Type', // select
      content: null,
    },
    childRelationships: {
      [ATLAS_DATABASES.SCENARIO_VARIATIONS]: 'Scenario Variations',
      [ATLAS_DATABASES.NEEDED_RESEARCH]: 'Needed Research',
    },
    parentRelationships: {
      [ATLAS_DATABASES.TENETS]: 'Targeted Action Tenet',
    },
  },
  [ATLAS_DATABASES.SCENARIO_VARIATIONS]: {
    properties: {
      atlasFullDocumentTitle: 'Doc No', // "Name" was previously formula, but now title
      atlasDocumentNo: 'Doc No', // title
      atlasDocumentName: 'Doc No', // "Name" was previously formula, but now title
      atlasDocumentType: 'Type', // select
      content: null,
    },
    childRelationships: {
      [ATLAS_DATABASES.NEEDED_RESEARCH]: 'Needed Research',
    },
    parentRelationships: {
      [ATLAS_DATABASES.SCENARIOS]: 'Original Scenario',
    },
  },
  [ATLAS_DATABASES.NEEDED_RESEARCH]: {
    properties: {
      atlasFullDocumentTitle: 'Doc No', // "Name" was previously formula, but now title
      atlasDocumentNo: 'Doc No', // title
      atlasDocumentName: 'Doc No', // "Name" was previously formula, but now title
      atlasDocumentType: 'Type', // select
      content: null,
    },
    childRelationships: {},
    parentRelationships: {
      [ATLAS_DATABASES.SCOPES]: 'Scopes',
      [ATLAS_DATABASES.ARTICLES]: 'Articles',
      [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: 'Sections & Primary Docs',
      [ATLAS_DATABASES.AGENTS]: 'Agent Scope',
      [ATLAS_DATABASES.ANNOTATIONS]: 'Annotations',
      [ATLAS_DATABASES.TENETS]: 'Tenets',
      [ATLAS_DATABASES.ACTIVE_DATA]: 'Active Data',
      [ATLAS_DATABASES.SCENARIOS]: 'Scenarios',
      [ATLAS_DATABASES.SCENARIO_VARIATIONS]: 'Scenario Variations',
    },
  },
} as const;

/**
 * Utility to reverse a NotionDatabasePropertyMapping: returns an object mapping property values to their keys.
 */
function reverseNotionDatabasePropertyMapping(
  mapping: NotionDatabasePropertyMapping,
): Record<string, keyof NotionDatabasePropertyMapping> {
  const reversed: Record<string, keyof NotionDatabasePropertyMapping> = {};
  for (const key in mapping) {
    const value = mapping[key as keyof NotionDatabasePropertyMapping];
    if (value) {
      reversed[value] = key as keyof NotionDatabasePropertyMapping;
    }
  }
  return reversed;
}

// Precompute reversed mappings for all databases
// Usage example: REVERSED_NOTION_DATABASE_PROPERTY_MAPPINGS[ATLAS_DATABASES.SCOPES]
// TODO: This doesn't work when a property is null (because object keys can't be null) - fix this!
export const REVERSED_NOTION_DATABASE_PROPERTY_MAPPINGS: Record<
  AtlasDatabaseName,
  Record<string, keyof NotionDatabasePropertyMapping>
> = Object.fromEntries(
  Object.entries(NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS).map(([dbName, config]) => [
    dbName,
    reverseNotionDatabasePropertyMapping(config.properties),
  ]),
) as Record<AtlasDatabaseName, Record<string, keyof NotionDatabasePropertyMapping>>;

export const SUPABASE_CHILD_DATABASE_NAME_MAP: Record<AtlasDatabaseName, string> = {
  [ATLAS_DATABASES.SCOPES]: 'child_scope_ids',
  [ATLAS_DATABASES.ARTICLES]: 'child_article_ids',
  [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: 'child_section_and_primary_doc_ids',
  [ATLAS_DATABASES.ANNOTATIONS]: 'child_annotation_ids',
  [ATLAS_DATABASES.TENETS]: 'child_tenet_ids',
  [ATLAS_DATABASES.SCENARIOS]: 'child_scenario_ids',
  [ATLAS_DATABASES.SCENARIO_VARIATIONS]: 'child_scenario_variation_ids',
  [ATLAS_DATABASES.ACTIVE_DATA]: 'child_active_data_ids',
  [ATLAS_DATABASES.AGENTS]: 'child_agent_scope_ids',
  [ATLAS_DATABASES.NEEDED_RESEARCH]: 'child_needed_research_ids',
} as const;

type NotionDatabasePagesRow = Tables<'notion_database_pages'>;

export type ChildListFieldName = {
  [K in keyof NotionDatabasePagesRow]: K extends `child_${string}_ids` ? K : never;
}[keyof NotionDatabasePagesRow];

export type ChildLists = { [K in ChildListFieldName]: string[] };

/**
 * TODO: Move the following interfaces and mappings to a shared file, since they are used in the client and server too
 */

/**
 * Generic utility type to convert property mapping to extra fields interface.
 * All extra fields have string | null values.
 * The -readonly modifier ensures fields are mutable.
 */
type ExtraFieldsFromMapping<T extends Record<string, string>> = {
  -readonly [K in keyof T]: string | null;
};

/**
 * Type Specification Extra Fields
 * Mapping of Supabase fields to their Notion property names. These fields exist only on "Type Specification" documents. These will be stored in the `extra_fields` JSONB column in Supabase.
 */
export const TYPE_SPECIFICATION_PROPERTY_MAPPING = {
  type_specification_components: 'Components', // Rich Text
  type_specification_doc_identifier_rules: 'Doc Identifier Rules', // Rich Text
  type_specification_additional_logic: 'Additional Logic', // Rich Text
  type_specification_type_category: 'Type Category', // Select
  type_specification_type_name: 'Type Name', // Rich Text
  type_specification_type_overview: 'Type Overview', // Rich Text
} as const;
export type TypeSpecificationExtraFields = ExtraFieldsFromMapping<typeof TYPE_SPECIFICATION_PROPERTY_MAPPING>;

/**
 * Scenario Extra Fields
 * Mapping of Supabase fields to their Notion property names. These fields exist only on "Scenario" documents. These will be stored in the `extra_fields` JSONB column in Supabase.
 */
export const SCENARIO_PROPERTY_MAPPING = {
  scenario_description: 'Description', // Rich Text
  scenario_finding: 'Finding', // Rich Text
  scenario_additional_guidance: 'Additional Guidance', // Rich Text
} as const;
export type ScenarioExtraFields = ExtraFieldsFromMapping<typeof SCENARIO_PROPERTY_MAPPING>;

/**
 * Scenario Variation Extra Fields
 * Mapping of Supabase fields to their Notion property names. These fields exist only on "Scenario Variation" documents. These will be stored in the `extra_fields` JSONB column in Supabase.
 */
export const SCENARIO_VARIATION_PROPERTY_MAPPING = {
  scenario_variation_description: 'Description', // Rich Text
  scenario_variation_finding: 'Finding', // Rich Text
  scenario_variation_additional_guidance: 'Additional Guidance', // Rich Text
} as const;
export type ScenarioVariationExtraFields = ExtraFieldsFromMapping<typeof SCENARIO_VARIATION_PROPERTY_MAPPING>;

/**
 * Needed Research Extra Fields
 * Mapping of Supabase fields to their Notion property names. These fields exist only on "Needed Research" documents. These will be stored in the `extra_fields` JSONB column in Supabase.
 */
export const NEEDED_RESEARCH_PROPERTY_MAPPING = {
  needed_research_content: 'Content', // Rich Text
} as const;
export type NeededResearchExtraFields = ExtraFieldsFromMapping<typeof NEEDED_RESEARCH_PROPERTY_MAPPING>;

/**
 * Notion Property Type Overrides per Document Type
 *
 * Maps Notion property names to their actual property types for each Atlas document type.
 * Only includes properties that are NOT 'rich_text' (which is the default assumption).
 *
 * This is used when syncing from Markdown to Notion to ensure we use the correct property type
 * for extra fields. The document type field (atlasDocumentType) is always a 'select' field
 * and is handled separately in buildNotionProperties.
 *
 * Note: All extra fields default to 'rich_text' unless specified here.
 *
 * Note: Type is always a 'select' field and is handled separately in buildNotionProperties.
 */
export const NOTION_PROPERTY_TYPE_OVERRIDES: Partial<Record<AtlasDatabaseName, Record<string, string>>> = {
  [ATLAS_DATABASES.SCOPES]: {
    'Doc No': 'title', // atlasDocumentNo
  },
  [ATLAS_DATABASES.ARTICLES]: {
    'Doc No': 'title', // atlasDocumentNo
  },
  [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: {
    'Doc No (or Temp Name)': 'title', // atlasFullDocumentTitle, atlasDocumentNo, atlasDocumentName
    'No.': 'number', // sortOrder
    'Type Category': 'select', // Extra field for Type Specification
  },
  [ATLAS_DATABASES.AGENTS]: {
    'Document Name': 'title', // atlasFullDocumentTitle, atlasDocumentName
  },
  [ATLAS_DATABASES.ANNOTATIONS]: {
    'Doc No': 'title', // atlasFullDocumentTitle, atlasDocumentNo, atlasDocumentName
  },
  [ATLAS_DATABASES.TENETS]: {
    'Doc No (or Temp Name)': 'title', // atlasFullDocumentTitle, atlasDocumentNo, atlasDocumentName
  },
  [ATLAS_DATABASES.ACTIVE_DATA]: {
    'Doc No': 'title', // atlasFullDocumentTitle, atlasDocumentNo, atlasDocumentName
  },
  [ATLAS_DATABASES.SCENARIOS]: {
    'Doc No (or Temp Name)': 'title', // atlasFullDocumentTitle, atlasDocumentNo, atlasDocumentName
  },
  [ATLAS_DATABASES.SCENARIO_VARIATIONS]: {
    'Doc No': 'title', // atlasFullDocumentTitle, atlasDocumentNo, atlasDocumentName
  },
  [ATLAS_DATABASES.NEEDED_RESEARCH]: {
    'Doc No': 'title', // atlasFullDocumentTitle, atlasDocumentNo, atlasDocumentName
  },
} as const;
