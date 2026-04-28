import { AtlasDocumentType } from '../atlas-types';

/**
 * Property mapping constants for Atlas document types with extra fields.
 * These constants map internal field keys to their display labels.
 * Used by the markdown exporter and the Atlas portal UI.
 */

/**
 * Type Specification Extra Fields
 */
export const TYPE_SPECIFICATION_PROPERTY_MAPPING = {
  type_specification_components: 'Components',
  type_specification_doc_identifier_rules: 'Doc Identifier Rules',
  type_specification_additional_logic: 'Additional Logic',
  type_specification_type_category: 'Type Category',
  type_specification_type_name: 'Type Name',
  type_specification_type_overview: 'Type Overview',
} as const;

/**
 * Scenario Extra Fields
 */
export const SCENARIO_PROPERTY_MAPPING = {
  scenario_description: 'Description',
  scenario_finding: 'Finding',
  scenario_additional_guidance: 'Additional Guidance',
} as const;

/**
 * Scenario Variation Extra Fields
 */
export const SCENARIO_VARIATION_PROPERTY_MAPPING = {
  scenario_variation_description: 'Description',
  scenario_variation_finding: 'Finding',
  scenario_variation_additional_guidance: 'Additional Guidance',
} as const;

/**
 * Needed Research Extra Fields
 */
export const NEEDED_RESEARCH_PROPERTY_MAPPING = {
  needed_research_content: 'Content',
} as const;

/**
 * Mapping of document types to their extra field property mappings.
 *
 * Centralized registry that maps each Atlas document type that has extra fields
 * to its corresponding property mapping constant.
 */
export const DOCUMENT_TYPE_EXTRA_FIELDS: Partial<Record<AtlasDocumentType, Record<string, string>>> = {
  'Type Specification': TYPE_SPECIFICATION_PROPERTY_MAPPING,
  Scenario: SCENARIO_PROPERTY_MAPPING,
  'Scenario Variation': SCENARIO_VARIATION_PROPERTY_MAPPING,
  'Needed Research': NEEDED_RESEARCH_PROPERTY_MAPPING,
};
