/* eslint-disable @typescript-eslint/no-empty-object-type */
import { AtlasDocumentType } from '@/app/server/atlas/constants';

/** UUIDs of agent root documents whose subtrees can be omitted via --omit-agents */
export const AGENT_ROOT_UUIDS = new Set<string>([
  '1b4f2ff0-8d73-8082-862b-dcd586862638',
  '1b4f2ff0-8d73-802f-a054-fece4d8731a4',
]);

/**
 * A simplified, standardized representation of an Atlas document used for downstream processing.
 */
export interface BaseAtlasDocument {
  type: AtlasDocumentType | string; // Allow string for unknown/custom types
  docNo: string;
  name: string;
  uuid: string | null;

  // TODO: content
}

export type StandardizedAtlasDocument =
  | ScopeDocument
  | ArticleDocument
  | CategoryDocument
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
  categories: 'Category',
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
  'categories',
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

export const allowedChildCollectionNamesPerDocumentType: Record<
  Exclude<AtlasDocumentType, 'Spell SP Controller' | 'Placeholder'>,
  ChildCollectionName[]
> = {
  Scope: ['articles'],
  Article: ['sections', 'categories', 'annotations', 'neededResearch', 'tenets'],
  Category: ['sections'],
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
  sections?: SectionDocument[];
  categories?: CategoryDocument[];
  supportingDocuments?: Pick<SupportingDocuments, 'annotations' | 'neededResearch' | 'tenets'>;
}

// ✅
export interface CategoryDocument extends Omit<BaseAtlasDocument, 'docNo'> {
  sections: SectionDocument[];
}

export interface SectionDocument extends BaseAtlasDocument {
  coreDocuments?: CoreDocument[];
  activeDataControllers?: ActiveDataControllerDocument[];
  typeSpecifications?: TypeSpecificationDocument[];
  supportingDocuments?: Pick<SupportingDocuments, 'annotations' | 'neededResearch' | 'tenets'>;
}

/**
 * Primary Documents
 */

// ✅
export interface CoreDocument extends BaseAtlasDocument {
  coreDocuments?: CoreDocument[];
  activeDataControllers?: ActiveDataControllerDocument[];
  typeSpecifications?: TypeSpecificationDocument[];
  supportingDocuments?: Pick<SupportingDocuments, 'annotations' | 'neededResearch' | 'tenets'>;
}

// ✅
export interface ActiveDataControllerDocument extends BaseAtlasDocument {
  supportingDocuments?: Pick<SupportingDocuments, 'activeData' | 'annotations' | 'neededResearch' | 'tenets'>;
}

export interface TypeSpecificationDocument extends BaseAtlasDocument {
  // TODO: Extra fields
  supportingDocuments?: Pick<SupportingDocuments, 'annotations' | 'neededResearch' | 'tenets'>;
}

/**
 * Supporting Documents
 */

// ActiveData must always be under ActiveDataController
// ✅
export type ActiveDataDocument = BaseAtlasDocument;

// ✅
export type AnnotationDocument = BaseAtlasDocument;

// ✅
export interface TenetDocument extends BaseAtlasDocument {
  scenarios?: ScenarioDocument[];
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

/**
 * Type Collections
 */

// ✅
export interface SupportingDocuments {
  annotations?: AnnotationDocument[];
  tenets?: TenetDocument[];
  neededResearch?: NeededResearchDocument[];
  activeData?: ActiveDataDocument[];
}
