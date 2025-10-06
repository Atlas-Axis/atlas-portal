/* eslint-disable @typescript-eslint/no-empty-object-type */
import { AtlasDocumentType } from '@/app/server/atlas/constants';

/**
 * A simplified, standardized representation of an Atlas document used for downstream processing.
 */
export interface BaseAtlasDocument {
  type: AtlasDocumentType; // Allow string for unknown/custom types
  doc_no: string;
  name: string;
  uuid: string | null;
  last_modified: string;
  content: string;
}

export type StandardizedAtlasDocument =
  | ScopeDocument
  | ArticleDocument
  | SectionDocument
  | CoreDocument
  | ActiveDataControllerDocument
  | TypeSpecificationDocument
  | ActiveDataDocument
  | AnnotationDocument
  | TenetDocument
  | ScenarioDocument
  | ScenarioVariationDocument
  | NeededResearchDocument;

/** Root array of standardized Scope trees. */
export type StandardizedAtlasScopeTrees = StandardizedAtlasDocument[];

export const childCollectionNameToDocumentType = {
  scopes: 'Scope',
  articles: 'Article',
  sections: 'Section',
  core_documents: 'Core',
  active_data_controllers: 'Active Data Controller',
  type_specifications: 'Type Specification',
  annotations: 'Annotation',
  tenets: 'Action Tenet',
  scenarios: 'Scenario',
  scenario_variations: 'Scenario Variation',
  active_data: 'Active Data',
  needed_research: 'Needed Research',
} as const satisfies Record<string, AtlasDocumentType>;

export type ChildCollectionName = keyof typeof childCollectionNameToDocumentType;

export const childCollectionNames: ChildCollectionName[] = [
  'scopes',
  'articles',
  'sections',
  'core_documents',
  'active_data_controllers',
  'type_specifications',
  'annotations',
  'tenets',
  'scenarios',
  'scenario_variations',
  'active_data',
  'needed_research',
];

// This is not used - TODO: Delete? Also, these are out of date
// TODO: Refresh these rules based on the latest Atlas hierarchy rules and use in `validateChildTypes
export const allowedChildCollectionNamesPerDocumentType: Record<AtlasDocumentType, ChildCollectionName[]> = {
  Scope: ['articles'],
  Article: ['sections', 'annotations', 'needed_research', 'tenets'],
  Section: [
    'core_documents',
    'active_data_controllers',
    'type_specifications',
    'annotations',
    'needed_research',
    'tenets',
  ],
  Core: [
    'core_documents',
    'active_data_controllers',
    'type_specifications',
    'annotations',
    'needed_research',
    'tenets',
  ],
  'Active Data Controller': ['active_data', 'annotations', 'needed_research', 'tenets'],
  'Type Specification': ['annotations', 'needed_research', 'tenets'],
  Annotation: [],
  'Action Tenet': ['scenarios'],
  Scenario: ['scenario_variations'],
  'Scenario Variation': [],
  'Needed Research': [],
  'Active Data': [],
};

/**
 * Immutable Documents
 */

// ✅
export interface ScopeDocument extends BaseAtlasDocument {
  articles: ArticleDocument[];
}

// ✅
export interface ArticleDocument extends BaseAtlasDocument {
  sections: SectionDocument[];
  // Supporting documents
  annotations: AnnotationDocument[];
  needed_research: NeededResearchDocument[];
  tenets: TenetDocument[]; // TODO: Disable?
  // TODO: These are not allowed by Atlas hierarchy rules but it's present in the data
  core_documents: CoreDocument[];
}

export interface SectionDocument extends BaseAtlasDocument {
  core_documents: CoreDocument[];
  active_data_controllers: ActiveDataControllerDocument[];
  type_specifications: TypeSpecificationDocument[];
  // Supporting documents
  annotations: AnnotationDocument[];
  needed_research: NeededResearchDocument[];
  tenets: TenetDocument[];
}

/**
 * Primary Documents
 */

export interface CoreDocument extends BaseAtlasDocument {
  core_documents: CoreDocument[];
  active_data_controllers: ActiveDataControllerDocument[];
  type_specifications: TypeSpecificationDocument[];
  // Supporting documents
  annotations: AnnotationDocument[];
  needed_research: NeededResearchDocument[];
  tenets: TenetDocument[];
}

export interface ActiveDataControllerDocument extends BaseAtlasDocument {
  // Supporting documents
  active_data: ActiveDataDocument[];
  annotations: AnnotationDocument[];
  needed_research: NeededResearchDocument[];
  tenets: TenetDocument[];
}

export interface TypeSpecificationDocument extends BaseAtlasDocument {
  // Extra fields
  type_specification_doc_identifier_rules: string | null;
  type_specification_additional_logic: string | null;
  type_specification_type_category: string | null;
  type_specification_type_name: string | null;
  type_specification_type_overview: string | null;
  // Supporting documents
  annotations: AnnotationDocument[];
  needed_research: NeededResearchDocument[];
  tenets: TenetDocument[];
}

/**
 * Supporting Documents
 */

// ActiveData must always be under ActiveDataController
export interface ActiveDataDocument extends BaseAtlasDocument {}

export interface AnnotationDocument extends BaseAtlasDocument {}

export interface TenetDocument extends BaseAtlasDocument {
  scenarios: ScenarioDocument[];
}

export interface ScenarioDocument extends BaseAtlasDocument {
  // Extra fields
  scenario_finding: string | null;
  scenario_additional_guidance: string | null;
  // Child docs
  scenario_variations: ScenarioVariationDocument[];
}

export interface ScenarioVariationDocument extends BaseAtlasDocument {
  // Extra fields
  scenario_variation_finding: string | null;
  scenario_variation_additional_guidance: string | null;
}

export interface NeededResearchDocument extends BaseAtlasDocument {}
