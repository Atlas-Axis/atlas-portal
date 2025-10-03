/* eslint-disable @typescript-eslint/no-empty-object-type */
import { AtlasDocumentType } from '@/app/server/atlas/constants';

/**
 * A simplified, standardized representation of an Atlas document used for downstream processing.
 */
export interface BaseAtlasDocument {
  type: AtlasDocumentType; // Allow string for unknown/custom types
  docNo: string;
  name: string;
  uuid: string | null;
  lastModified: string;
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
  coreDocuments: 'Core',
  activeDataControllers: 'Active Data Controller',
  typeSpecifications: 'Type Specification',
  annotations: 'Annotation',
  tenets: 'Action Tenet',
  scenarios: 'Scenario',
  scenarioVariations: 'Scenario Variation',
  activeData: 'Active Data',
  neededResearch: 'Needed Research',
} as const satisfies Record<string, AtlasDocumentType>;

export type ChildCollectionName = keyof typeof childCollectionNameToDocumentType;

export const childCollectionNames: ChildCollectionName[] = [
  'scopes',
  'articles',
  'sections',
  'coreDocuments',
  'activeDataControllers',
  'typeSpecifications',
  'annotations',
  'tenets',
  'scenarios',
  'scenarioVariations',
  'activeData',
  'neededResearch',
];

// This is not used - TODO: Delete? Also, these are out of date
export const allowedChildCollectionNamesPerDocumentType: Record<AtlasDocumentType, ChildCollectionName[]> = {
  Scope: ['articles'],
  Article: ['sections', 'annotations', 'neededResearch', 'tenets'],
  Section: ['coreDocuments', 'activeDataControllers', 'typeSpecifications', 'annotations', 'neededResearch', 'tenets'],
  Core: ['coreDocuments', 'activeDataControllers', 'typeSpecifications', 'annotations', 'neededResearch', 'tenets'],
  'Active Data Controller': ['activeData', 'annotations', 'neededResearch', 'tenets'],
  'Type Specification': ['annotations', 'neededResearch', 'tenets'],
  Annotation: [],
  'Action Tenet': ['scenarios'],
  Scenario: ['scenarioVariations'],
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
  // supporting documents
  annotations: AnnotationDocument[];
  neededResearch: NeededResearchDocument[];
  tenets: TenetDocument[]; // TODO: Disable?
  // TODO: These are not allowed by Atlas hierarchy rules but it's present in the data
  coreDocuments: CoreDocument[];
}

export interface SectionDocument extends BaseAtlasDocument {
  coreDocuments: CoreDocument[];
  activeDataControllers: ActiveDataControllerDocument[];
  typeSpecifications: TypeSpecificationDocument[];
  // supporting documents
  annotations: AnnotationDocument[];
  neededResearch: NeededResearchDocument[];
  tenets: TenetDocument[];
}

/**
 * Primary Documents
 */

export interface CoreDocument extends BaseAtlasDocument {
  coreDocuments: CoreDocument[];
  activeDataControllers: ActiveDataControllerDocument[];
  typeSpecifications: TypeSpecificationDocument[];
  // supporting documents
  annotations: AnnotationDocument[];
  neededResearch: NeededResearchDocument[];
  tenets: TenetDocument[];
}

export interface ActiveDataControllerDocument extends BaseAtlasDocument {
  // supporting documents
  activeData: ActiveDataDocument[];
  annotations: AnnotationDocument[];
  neededResearch: NeededResearchDocument[];
  tenets: TenetDocument[];
}

export interface TypeSpecificationDocument extends BaseAtlasDocument {
  // TODO: Extra fields
  // supporting documents
  annotations: AnnotationDocument[];
  neededResearch: NeededResearchDocument[];
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
  scenarioVariations: ScenarioVariationDocument[];
  // TODO: Extra fields
}

export interface ScenarioVariationDocument extends BaseAtlasDocument {
  // TODO: Extra fields
}

export interface NeededResearchDocument extends BaseAtlasDocument {
  // TODO: Extra fields
}
