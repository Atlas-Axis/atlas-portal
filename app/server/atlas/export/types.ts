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
 * Base fields for Export Atlas Tree documents (External Atlas Representation).
 *
 * This is a minimal, platform-independent representation of Atlas documents designed for
 * external consumption (JSON/Markdown export, APIs, public interfaces). It is completely
 * decoupled from Notion and Supabase, using Atlas document UUIDs and markdown strings
 * instead of Notion-specific structures.
 *
 * For internal operations (tree construction, document numbering), use the Notion Tree
 * types (NotionAtlasTreeNode, etc.) instead.
 */
export interface ExportAtlasTreeBaseDocument {
  type: AtlasDocumentType;
  doc_no: string;
  name: string;
  uuid: string | null;
  last_modified: string; // TODO: Remove - The Markdown doesn't include this
  content: string;
}

export type ExportAtlasTreeDocument =
  | ExportAtlasTreeScopesDocument
  | ExportAtlasTreeArticlesDocument
  | ExportAtlasTreeSectionsAndPrimaryDocsDocument
  | ExportAtlasTreeAnnotationsDocument
  | ExportAtlasTreeTenetsDocument
  | ExportAtlasTreeScenariosDocument
  | ExportAtlasTreeScenarioVariationsDocument
  | ExportAtlasTreeActiveDataDocument
  | ExportAtlasTreeAgentScopeDatabaseDocument
  | ExportAtlasTreeNeededResearchDocument;

/** Root array of Export Atlas Tree scope trees. */
export type ExportAtlasTreeScopeTrees = ExportAtlasTreeDocument[];

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

/**
 * Order of child collections when iterating/exporting.
 *
 * IMPORTANT: 'needed_research' MUST be first in this array.
 * Needed Research documents use global numbering (NR-1, NR-2, etc.) that doesn't encode
 * their parent. The markdown importer uses stack-based parsing where NR documents are
 * attached to the nearest non-NR document on the stack. By outputting NR first, we ensure
 * the parent (not a sibling) is on top of the stack when NR is parsed.
 *
 * See: docs/ATLAS_DOCUMENT_NUMBERING_RULES.md (Needed Research section)
 */
export const childCollectionNames: ChildCollectionName[] = [
  'needed_research', // Must be first - see comment above
  'scopes',
  'articles',
  'sections_and_primary_docs',
  'annotations',
  'tenets',
  'scenarios',
  'scenario_variations',
  'active_data',
  'agent_scope_database',
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
 * Export Atlas Tree Documents (External Atlas Representation)
 * Each document type represents an Atlas database and contains children grouped by database.
 */

export interface ExportAtlasTreeScopesDocument extends ExportAtlasTreeBaseDocument {
  articles: ExportAtlasTreeArticlesDocument[];
}

export interface ExportAtlasTreeArticlesDocument extends ExportAtlasTreeBaseDocument {
  sections_and_primary_docs: ExportAtlasTreeSectionsAndPrimaryDocsDocument[];
  // agent_scope_database: ExportAtlasTreeAgentScopeDatabaseDocument[];
  annotations: ExportAtlasTreeAnnotationsDocument[];
  needed_research: ExportAtlasTreeNeededResearchDocument[];
}

export interface ExportAtlasTreeSectionsAndPrimaryDocsDocument
  extends ExportAtlasTreeBaseDocument,
    Partial<TypeSpecificationExtraFields> {
  sections_and_primary_docs: ExportAtlasTreeSectionsAndPrimaryDocsDocument[];
  agent_scope_database?: ExportAtlasTreeAgentScopeDatabaseDocument[];
  annotations: ExportAtlasTreeAnnotationsDocument[];
  tenets: ExportAtlasTreeTenetsDocument[];
  active_data: ExportAtlasTreeActiveDataDocument[];
  needed_research: ExportAtlasTreeNeededResearchDocument[];
  // TODO: Add extra fields for Type Specification documents (optional)
}

export interface ExportAtlasTreeAnnotationsDocument extends ExportAtlasTreeBaseDocument {
  // No children - leaf database
  needed_research: ExportAtlasTreeNeededResearchDocument[];
}

export interface ExportAtlasTreeTenetsDocument extends ExportAtlasTreeBaseDocument {
  scenarios: ExportAtlasTreeScenariosDocument[];
  needed_research: ExportAtlasTreeNeededResearchDocument[];
}

export interface ExportAtlasTreeScenariosDocument extends ExportAtlasTreeBaseDocument, Partial<ScenarioExtraFields> {
  scenario_variations: ExportAtlasTreeScenarioVariationsDocument[];
  needed_research: ExportAtlasTreeNeededResearchDocument[];
}

export interface ExportAtlasTreeScenarioVariationsDocument
  extends ExportAtlasTreeBaseDocument,
    Partial<ScenarioVariationExtraFields> {
  // No children - leaf database
  needed_research: ExportAtlasTreeNeededResearchDocument[];
}

export interface ExportAtlasTreeActiveDataDocument extends ExportAtlasTreeBaseDocument {
  // No children - leaf database
  needed_research: ExportAtlasTreeNeededResearchDocument[];
}

export interface ExportAtlasTreeAgentScopeDatabaseDocument extends ExportAtlasTreeBaseDocument {
  agent_scope_database: ExportAtlasTreeAgentScopeDatabaseDocument[];
  annotations: ExportAtlasTreeAnnotationsDocument[];
  tenets: ExportAtlasTreeTenetsDocument[];
  active_data: ExportAtlasTreeActiveDataDocument[];
  needed_research: ExportAtlasTreeNeededResearchDocument[];
}

export interface ExportAtlasTreeNeededResearchDocument
  extends ExportAtlasTreeBaseDocument,
    Partial<NeededResearchExtraFields> {
  // No children - leaf database
}

export const extraFieldsByDocumentType: Partial<Record<AtlasDocumentType, string[]>> = {
  'Type Specification': Object.keys(TYPE_SPECIFICATION_PROPERTY_MAPPING),
  Scenario: Object.keys(SCENARIO_PROPERTY_MAPPING),
  'Scenario Variation': Object.keys(SCENARIO_VARIATION_PROPERTY_MAPPING),
  'Needed Research': Object.keys(NEEDED_RESEARCH_PROPERTY_MAPPING),
};
