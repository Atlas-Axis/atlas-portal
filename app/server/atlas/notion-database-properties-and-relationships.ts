import { Tables } from '@/app/server/services/supabase/database.types';
import { ATLAS_DATABASES, AtlasDatabaseName } from './constants';

export interface NotionDatabasePropertyMapping {
  // TODO: Delete atlasFullDocumentTitle - in Atlas Explorer, there are only two fields: Document No and Document Name
  atlasFullDocumentTitle: string; // A property name representing the full title, including the document number and name, e.g. "A.3.1.1 - Scope Improvement"
  atlasDocumentNo: string; // A property name representing the formal document ID, e.g. "A.3.1.1"
  atlasDocumentName: string; // A property name representing the document name, e.g. "Scope Improvement"
  atlasDocumentType: string; // A property name representing the type of document, e.g. "Core", "Section"...
  content: string; // A property name representing the main content or body of the document
  sortOrder?: string; // A property name representing the manually set order of the document within its parent or section
}

export type NotionDatabasePropertyKey = keyof NotionDatabasePropertyMapping;

export const PROPERTY_MAPPING_NAMES: Record<string, NotionDatabasePropertyKey> = {
  ATLAS_FULL_DOCUMENT_TITLE: 'atlasFullDocumentTitle',
  ATLAS_DOCUMENT_NO: 'atlasDocumentNo',
  ATLAS_DOCUMENT_NAME: 'atlasDocumentName',
  ATLAS_DOCUMENT_TYPE: 'atlasDocumentType',
  CONTENT: 'content',
  SORT_ORDER: 'sortOrder',
};

/**
 * Docs for Notion database properties
 * - https://developers.notion.com/reference/property-object
 *
 * Examples:
 * - Current Doc No (or Temp Name): "A.3.1 - A1 - Scope Improvement"
 * - Name: "Scope Improvement"
 * - Formal Doc ID: "A.3.1.1"
 */
export const NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS: Record<
  AtlasDatabaseName,
  {
    properties: NotionDatabasePropertyMapping;
    childRelationships: Partial<Record<AtlasDatabaseName, string>>;
    parentPropertyName?: string;
    // subItemsPropertyName?: string;
  }
> = {
  [ATLAS_DATABASES.SCOPES]: {
    properties: {
      atlasFullDocumentTitle: 'Name', // TODO: null?
      atlasDocumentNo: 'Doc No',
      atlasDocumentName: 'Name',
      atlasDocumentType: 'Type',
      content: 'Content',
    },
    childRelationships: {
      [ATLAS_DATABASES.ARTICLES]: 'Articles',
      [ATLAS_DATABASES.NEEDED_RESEARCH]: 'Needed Research',
    },
  },
  [ATLAS_DATABASES.ARTICLES]: {
    properties: {
      atlasFullDocumentTitle: 'Name', // TODO: null?
      atlasDocumentNo: 'Doc No',
      atlasDocumentName: 'Name',
      atlasDocumentType: 'Type',
      content: 'Content',
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
  },
  [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: {
    properties: {
      atlasFullDocumentTitle: 'Doc No (or Temp Name)',
      atlasDocumentNo: 'Doc No (or Temp Name)', // Previously 'Formal Doc ID' - but that doesn't match the PH importer mapping
      atlasDocumentName: 'Name',
      atlasDocumentType: 'Type',
      content: 'Content',
      sortOrder: 'No.',
    },
    childRelationships: {
      [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: 'Subdocs',
      [ATLAS_DATABASES.ANNOTATIONS]: 'Annotations',
      [ATLAS_DATABASES.TENETS]: 'Tenets',
      [ATLAS_DATABASES.ACTIVE_DATA]: 'Active Data',
      [ATLAS_DATABASES.NEEDED_RESEARCH]: 'Needed Research',
      // Extra in PH importer: "Files & media"
    },
    parentPropertyName: 'Parent Doc',
    // subItemsPropertyName: 'Subdocs',
  },
  [ATLAS_DATABASES.AGENTS]: {
    properties: {
      atlasFullDocumentTitle: 'Document Name',
      atlasDocumentNo: 'Formal Doc ID',
      atlasDocumentName: 'Document Name',
      atlasDocumentType: 'Doc Type',
      content: 'Content',
    },
    childRelationships: {
      [ATLAS_DATABASES.ANNOTATIONS]: 'Annotations',
      [ATLAS_DATABASES.TENETS]: 'Tenets',
      [ATLAS_DATABASES.ACTIVE_DATA]: 'Active Data',
      [ATLAS_DATABASES.AGENTS]: 'Sub-item',
      [ATLAS_DATABASES.NEEDED_RESEARCH]: 'Needed Research',
    },
    parentPropertyName: 'Parent item',
    // subItemsPropertyName: 'Sub-item',
  },
  [ATLAS_DATABASES.ANNOTATIONS]: {
    properties: {
      atlasFullDocumentTitle: 'Name',
      atlasDocumentNo: 'Doc No',
      atlasDocumentName: 'Name',
      atlasDocumentType: 'Type',
      content: 'Content',
    },
    childRelationships: {
      [ATLAS_DATABASES.NEEDED_RESEARCH]: 'Needed Research',
    },
  },
  [ATLAS_DATABASES.TENETS]: {
    properties: {
      atlasFullDocumentTitle: 'Doc No (or Temp Name)',
      atlasDocumentNo: 'Doc No (or Temp Name)',
      atlasDocumentName: 'Name',
      atlasDocumentType: 'Type',
      content: 'Content', // TODO
    },
    childRelationships: {
      [ATLAS_DATABASES.SCENARIOS]: 'Scenarios',
      [ATLAS_DATABASES.NEEDED_RESEARCH]: 'Needed Research',
    },
  },
  [ATLAS_DATABASES.ACTIVE_DATA]: {
    properties: {
      atlasFullDocumentTitle: 'Name', // TODO: null?
      atlasDocumentNo: 'Doc No',
      atlasDocumentName: 'Name',
      atlasDocumentType: 'Type',
      content: 'Content',
    },
    childRelationships: {
      [ATLAS_DATABASES.NEEDED_RESEARCH]: 'Needed Research',
    },
  },
  [ATLAS_DATABASES.SCENARIOS]: {
    properties: {
      atlasFullDocumentTitle: 'Doc No (or Temp Name)',
      atlasDocumentNo: 'Doc No (or Temp Name)',
      atlasDocumentName: 'Name',
      atlasDocumentType: 'Type',
      content: 'Description',
    },
    childRelationships: {
      [ATLAS_DATABASES.SCENARIO_VARIATIONS]: 'Scenario Variations',
      [ATLAS_DATABASES.NEEDED_RESEARCH]: 'Needed Research',
    },
  },
  [ATLAS_DATABASES.SCENARIO_VARIATIONS]: {
    properties: {
      atlasFullDocumentTitle: 'Name',
      atlasDocumentNo: 'Doc No',
      atlasDocumentName: 'Name',
      atlasDocumentType: 'Type',
      content: 'Description',
    },
    childRelationships: {
      [ATLAS_DATABASES.NEEDED_RESEARCH]: 'Needed Research',
    },
  },
  [ATLAS_DATABASES.NEEDED_RESEARCH]: {
    properties: {
      atlasFullDocumentTitle: 'Name',
      atlasDocumentNo: 'Doc No',
      atlasDocumentName: 'Name',
      atlasDocumentType: 'Type',
      content: 'Content',
    },
    childRelationships: {},
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

// "Type Specification" documents have some extra fields
export interface TypeSpecificationExtraFields {
  type_specification_doc_identifier_rules: string | null;
  type_specification_additional_logic: string | null;
  type_specification_type_category: string | null;
  type_specification_type_name: string | null;
  type_specification_type_overview: string | null;
}

// Mapping of Supabase fields to their Notion property names. These fields exist only on "Type Specification" documents. These will be stored in the `extra_fields` JSONB column in Supabase.
export const TYPE_SPECIFICATION_PROPERTY_MAPPING: Record<keyof TypeSpecificationExtraFields, string> = {
  type_specification_doc_identifier_rules: 'Doc Identifier Rules',
  type_specification_additional_logic: 'Additional Logic',
  type_specification_type_category: 'Type Category',
  type_specification_type_name: 'Type Name',
  type_specification_type_overview: 'Type Overview',
} as const;

// "Scenario" documents have some extra fields
export interface ScenarioExtraFields {
  scenario_finding: string | null;
  scenario_additional_guidance: string | null;
}

// "Scenario Variation" documents have some extra fields
export interface ScenarioVariationExtraFields {
  scenario_variation_finding: string | null;
  scenario_variation_additional_guidance: string | null;
}

// Mapping of Supabase fields to their Notion property names. These fields exist only on "Scenario" documents. These will be stored in the `extra_fields` JSONB column in Supabase.
export const SCENARIO_PROPERTY_MAPPING: Record<string, string> = {
  scenario_finding: 'Finding',
  scenario_additional_guidance: 'Additional Guidance',
};

// Mapping of Supabase fields to their Notion property names. These fields exist only on "Scenario Variation" documents. These will be stored in the `extra_fields` JSONB column in Supabase.
export const SCENARIO_VARIATION_PROPERTY_MAPPING: Record<string, string> = {
  scenario_variation_finding: 'Finding',
  scenario_variation_additional_guidance: 'Additional Guidance',
};
