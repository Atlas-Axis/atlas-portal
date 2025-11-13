import { AtlasDatabaseName, AtlasDocumentType } from '@/app/server/atlas/atlas-types';
import {
  NEEDED_RESEARCH_PROPERTY_MAPPING,
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '../notion-mapping/notion-database-properties-and-relationships';

/**
 * Extra field types for JSON export (string-only versions).
 * These are converted from the Supabase rich text structure to markdown strings.
 */
type ExtraFieldsAsStrings<T extends Record<string, string>> = {
  [K in keyof T]?: string | null;
};

export type TypeSpecificationExtraFields = ExtraFieldsAsStrings<typeof TYPE_SPECIFICATION_PROPERTY_MAPPING>;
export type ScenarioExtraFields = ExtraFieldsAsStrings<typeof SCENARIO_PROPERTY_MAPPING>;
export type ScenarioVariationExtraFields = ExtraFieldsAsStrings<typeof SCENARIO_VARIATION_PROPERTY_MAPPING>;
export type NeededResearchExtraFields = ExtraFieldsAsStrings<typeof NEEDED_RESEARCH_PROPERTY_MAPPING>;

/**
 * A simplified, standardized representation of an Atlas document used for downstream processing.
 * Now grouped by Atlas database instead of document type.
 */
export interface BaseAtlasDocument {
  type: AtlasDocumentType;
  doc_no: string;
  name: string;
  uuid: string | null;
  last_modified: string; // TODO: Remove - The Markdown doesn't include this
  content: string;
}

export type StandardizedAtlasDocument =
  | ScopesDocument
  | ArticlesDocument
  | SectionsAndPrimaryDocsDocument
  | AnnotationsDocument
  | TenetsDocument
  | ScenariosDocument
  | ScenarioVariationsDocument
  | ActiveDataDocument
  | AgentScopeDatabaseDocument
  | NeededResearchDocument;

/** Root array of standardized Atlas database trees. */
export type StandardizedAtlasScopeTrees = StandardizedAtlasDocument[];

export const childCollectionNameToDatabaseName = {
  scopes: 'Scopes',
  articles: 'Articles',
  sections_and_primary_docs: 'Sections & Primary Docs',
  annotations: 'Annotations',
  tenets: 'Tenets',
  scenarios: 'Scenarios',
  scenario_variations: 'Scenario Variations',
  active_data: 'Active Data',
  agent_scope_database: 'Agent Scope Database',
  needed_research: 'Needed Research',
} as const satisfies Record<string, AtlasDatabaseName>;

export type ChildCollectionName = keyof typeof childCollectionNameToDatabaseName;

export const childCollectionNames: ChildCollectionName[] = [
  'scopes',
  'articles',
  'sections_and_primary_docs',
  'annotations',
  'tenets',
  'scenarios',
  'scenario_variations',
  'active_data',
  'agent_scope_database',
  'needed_research',
];

/**
 * Defines which child collection names are allowed for each Atlas database.
 * Based on the Atlas Database Hierarchy from the documentation.
 */
export const allowedChildCollectionNamesPerDatabase: Record<AtlasDatabaseName, ChildCollectionName[]> = {
  Scopes: ['articles'],
  Articles: ['sections_and_primary_docs', 'annotations', 'needed_research'],
  'Sections & Primary Docs': [
    'sections_and_primary_docs',
    'agent_scope_database',
    'annotations',
    'tenets',
    'active_data',
    'needed_research',
  ],
  Annotations: ['needed_research'],
  Tenets: ['scenarios', 'needed_research'],
  Scenarios: ['scenario_variations', 'needed_research'],
  'Scenario Variations': ['needed_research'],
  'Active Data': ['needed_research'],
  'Agent Scope Database': ['agent_scope_database', 'annotations', 'tenets', 'active_data', 'needed_research'],
  'Needed Research': [],
};

/**
 * Atlas Database Documents
 * Each document type represents an Atlas database and contains children grouped by database.
 */

export interface ScopesDocument extends BaseAtlasDocument {
  articles: ArticlesDocument[];
}

export interface ArticlesDocument extends BaseAtlasDocument {
  sections_and_primary_docs: SectionsAndPrimaryDocsDocument[];
  // agent_scope_database: AgentScopeDatabaseDocument[];
  annotations: AnnotationsDocument[];
  needed_research: NeededResearchDocument[];
}

export interface SectionsAndPrimaryDocsDocument extends BaseAtlasDocument, Partial<TypeSpecificationExtraFields> {
  sections_and_primary_docs: SectionsAndPrimaryDocsDocument[];
  agent_scope_database?: AgentScopeDatabaseDocument[];
  annotations: AnnotationsDocument[];
  tenets: TenetsDocument[];
  active_data: ActiveDataDocument[];
  needed_research: NeededResearchDocument[];
  // TODO: Add extra fields for Type Specification documents (optional)
}

export interface AnnotationsDocument extends BaseAtlasDocument {
  // No children - leaf database
  needed_research: NeededResearchDocument[];
}

export interface TenetsDocument extends BaseAtlasDocument {
  scenarios: ScenariosDocument[];
  needed_research: NeededResearchDocument[];
}

export interface ScenariosDocument extends BaseAtlasDocument, Partial<ScenarioExtraFields> {
  scenario_variations: ScenarioVariationsDocument[];
  needed_research: NeededResearchDocument[];
}

export interface ScenarioVariationsDocument extends BaseAtlasDocument, Partial<ScenarioVariationExtraFields> {
  // No children - leaf database
  needed_research: NeededResearchDocument[];
}

export interface ActiveDataDocument extends BaseAtlasDocument {
  // No children - leaf database
  needed_research: NeededResearchDocument[];
}

export interface AgentScopeDatabaseDocument extends BaseAtlasDocument {
  agent_scope_database: AgentScopeDatabaseDocument[];
  annotations: AnnotationsDocument[];
  tenets: TenetsDocument[];
  active_data: ActiveDataDocument[];
  needed_research: NeededResearchDocument[];
}

export interface NeededResearchDocument extends BaseAtlasDocument, Partial<NeededResearchExtraFields> {
  // No children - leaf database
}

export const extraFieldsByDocumentType: Partial<Record<AtlasDocumentType, string[]>> = {
  'Type Specification': Object.keys(TYPE_SPECIFICATION_PROPERTY_MAPPING),
  Scenario: Object.keys(SCENARIO_PROPERTY_MAPPING),
  'Scenario Variation': Object.keys(SCENARIO_VARIATION_PROPERTY_MAPPING),
  'Needed Research': Object.keys(NEEDED_RESEARCH_PROPERTY_MAPPING),
};
