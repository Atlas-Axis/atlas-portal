/**
 * Standardize Atlas Trees
 *
 * Purpose
 * - Converts an `AtlasTreeNode` (children grouped by Atlas database) into a
 *   `StandardizedAtlasDocument` (children grouped by Atlas document type).
 * - Preserves original child order and recursively converts all descendants.
 *
 * How it works
 * - Base fields are mapped 1:1 from the node: `type`, `docNo`, `name`, `uuid`.
 * - For relationships:
 *   - Simple 1:1 arrays are mapped directly (`articles`, `annotations`, etc.).
 *   - Mixed collections are split by document type:
 *     - `sectionsAndPrimaryDocs` → `sections`, `categories`, `coreDocuments`,
 *       `activeDataControllers`, `typeSpecifications`.
 *     - `agentScopeDocs` → `coreDocuments`, `activeDataControllers`.
 *   - Supporting documents are grouped under `supportingDocuments` when present.
 * - Everything is recursive: child nodes are converted with the same function.
 *
 * Usage
 * ```ts
 * import { atlasNodeToStandardized } from '@/app/server/atlas/json-export/atlas-node-tree-to-standardized-atlas-node-tree';
 * const standardized: StandardizedAtlasDocument = atlasNodeToStandardized(rootNode);
 * ```
 */
import { type AtlasTreeNode } from '@/app/server/atlas/atlas-tree-types';
import { AGENT_ROOT_SECTION_UUIDS, type AtlasDocumentType } from '@/app/server/atlas/constants';
import {
  type ActiveDataControllerDocument,
  type ActiveDataDocument,
  type AnnotationDocument,
  type ArticleDocument,
  type BaseAtlasDocument,
  type CategoryDocument,
  type CoreDocument,
  type NeededResearchDocument,
  type PlaceholderDocument,
  type ScenarioDocument,
  type ScenarioVariationDocument,
  type ScopeDocument,
  type SectionDocument,
  type StandardizedAtlasDocument,
  type TenetDocument,
  type TypeSpecificationDocument,
} from './types';

// Validation helper to check allowed child types per Atlas hierarchy rules
function validateChildTypes(node: AtlasTreeNode, allowedTypes: AtlasDocumentType[]): void {
  const allChildren = [
    ...node.scopes,
    ...node.articles,
    ...node.sectionsAndPrimaryDocs,
    ...node.annotations,
    ...node.tenets,
    ...node.scenarios,
    ...node.scenarioVariations,
    ...node.activeData,
    ...node.agentScopeDocs,
    ...node.neededResearch,
  ];

  const invalidChildren = allChildren.filter((child) => !allowedTypes.includes(child.atlas_document_type));
  if (invalidChildren.length > 0) {
    console.warn(
      `‼️  ${node.atlas_document_type} "${node.plain_text_name}" has invalid child types: ${invalidChildren.map((c) => c.atlas_document_type).join(', ')}`,
    );
  }
}

// Convert simple fields
function toBase(node: AtlasTreeNode): BaseAtlasDocument {
  return {
    type: node.atlas_document_type,
    docNo: node.generatedDocID ?? node.atlas_document_number ?? '',
    name: node.generatedDocName ?? node.plain_text_name ?? '',
    uuid: node.notion_page_id ?? null,
    content: node.plain_text_content ?? '',
  };
}

// Generic helpers to reduce duplication
function filterMapByType<T extends StandardizedAtlasDocument>(
  items: AtlasTreeNode[],
  expectedType: AtlasDocumentType,
): T[] {
  return items.filter((c) => c.atlas_document_type === expectedType).map((c) => atlasNodeToStandardized(c) as T);
}

function mapAllAs<T extends StandardizedAtlasDocument>(items: AtlasTreeNode[]): T[] {
  return items.map((c) => atlasNodeToStandardized(c) as T);
}

// Split `sectionsAndPrimaryDocs` (atlas-database-grouped) into atlas-document-type-grouped arrays
function mapSectionsAndPrimaryDocs(node: AtlasTreeNode): {
  sections: SectionDocument[];
  categories: CategoryDocument[];
  coreDocuments: CoreDocument[];
  activeDataControllers: ActiveDataControllerDocument[];
  typeSpecifications: TypeSpecificationDocument[];
  placeholders: PlaceholderDocument[];
} {
  return {
    sections: filterMapByType<SectionDocument>(node.sectionsAndPrimaryDocs, 'Section'),
    categories: filterMapByType<CategoryDocument>(node.sectionsAndPrimaryDocs, 'Category'),
    coreDocuments: filterMapByType<CoreDocument>(node.sectionsAndPrimaryDocs, 'Core'),
    activeDataControllers: filterMapByType<ActiveDataControllerDocument>(
      node.sectionsAndPrimaryDocs,
      'Active Data Controller',
    ),
    typeSpecifications: filterMapByType<TypeSpecificationDocument>(node.sectionsAndPrimaryDocs, 'Type Specification'),
    placeholders: filterMapByType<PlaceholderDocument>(node.sectionsAndPrimaryDocs, 'Placeholder'),
  };
}

// Split `agentScopeDocs` (mixed Core + Active Data Controller + Placeholder) into atlas-document-type-grouped arrays
function mapAgentScopeDocs(node: AtlasTreeNode): {
  coreDocuments: CoreDocument[];
  activeDataControllers: ActiveDataControllerDocument[];
  placeholders: PlaceholderDocument[];
} {
  return {
    coreDocuments: filterMapByType<CoreDocument>(node.agentScopeDocs, 'Core'),
    activeDataControllers: filterMapByType<ActiveDataControllerDocument>(node.agentScopeDocs, 'Active Data Controller'),
    placeholders: filterMapByType<PlaceholderDocument>(node.agentScopeDocs, 'Placeholder'),
  };
}

// Build supporting docs for `Article`
function mapSupportingDocsForArticle(node: AtlasTreeNode): ArticleDocument['supportingDocuments'] {
  const result: NonNullable<ArticleDocument['supportingDocuments']> = {};
  if (node.annotations.length > 0) result.annotations = mapAllAs<AnnotationDocument>(node.annotations);
  if (node.neededResearch.length > 0) result.neededResearch = mapAllAs<NeededResearchDocument>(node.neededResearch);
  if (node.tenets.length > 0) result.tenets = mapAllAs<TenetDocument>(node.tenets);
  return Object.keys(result).length > 0 ? result : undefined;
}

// Build supporting docs for `Section` / `Core` / `Type Specification`
function mapSupportingDocsForSectionCoreSpec(node: AtlasTreeNode): SectionDocument['supportingDocuments'] {
  const result: NonNullable<SectionDocument['supportingDocuments']> = {};
  if (node.annotations.length > 0) result.annotations = mapAllAs<AnnotationDocument>(node.annotations);
  if (node.neededResearch.length > 0) result.neededResearch = mapAllAs<NeededResearchDocument>(node.neededResearch);
  if (node.tenets.length > 0) result.tenets = mapAllAs<TenetDocument>(node.tenets);
  return Object.keys(result).length > 0 ? result : undefined;
}

// Build supporting docs for `Active Data Controller` (includes `activeData`, which must be nested under `Active Data Controller`)
function mapSupportingDocsForActiveDataController(
  node: AtlasTreeNode,
): ActiveDataControllerDocument['supportingDocuments'] {
  const result: NonNullable<ActiveDataControllerDocument['supportingDocuments']> = {};
  if (node.activeData.length > 0) result.activeData = mapAllAs<ActiveDataDocument>(node.activeData);
  if (node.annotations.length > 0) result.annotations = mapAllAs<AnnotationDocument>(node.annotations);
  if (node.neededResearch.length > 0) result.neededResearch = mapAllAs<NeededResearchDocument>(node.neededResearch);
  if (node.tenets.length > 0) result.tenets = mapAllAs<TenetDocument>(node.tenets);
  return Object.keys(result).length > 0 ? result : undefined;
}

// Main entry: convert an `AtlasTreeNode` into a `StandardizedAtlasDocument`
export function atlasNodeToStandardized(
  node: AtlasTreeNode,
  options?: { omitAgents: boolean },
): StandardizedAtlasDocument {
  const base = toBase(node);

  // If omitting Agent Scope subtrees (for BLUE JSON compatibility) and this node matches one of the agent roots,
  // prune all its children (keep the node itself with empty children arrays).
  const isAgentRoot = node.notion_page_id != null && AGENT_ROOT_SECTION_UUIDS.has(node.notion_page_id);
  if (options?.omitAgents && isAgentRoot) {
    return { ...base } as StandardizedAtlasDocument;
  }

  switch (node.atlas_document_type) {
    case 'Scope': {
      // Scope → has `articles`
      validateChildTypes(node, ['Article']);
      const doc: ScopeDocument = { ...base, articles: [] };
      if (node.articles.length > 0) {
        doc.articles = node.articles.map((c) => atlasNodeToStandardized(c) as ArticleDocument);
      }
      return doc;
    }

    case 'Article': {
      // Article → only sections and categories (per Atlas hierarchy rules) - But in practice can have mixed children
      validateChildTypes(node, [
        'Section',
        'Category',
        'Core',
        'Placeholder',
        'Annotation',
        // 'Action Tenet',
        'Needed Research',
      ]);
      const doc: ArticleDocument = { ...base };
      const splitDb = mapSectionsAndPrimaryDocs(node);
      const splitAgent = mapAgentScopeDocs(node);
      if (splitDb.sections.length > 0) doc.sections = splitDb.sections;
      if (splitDb.categories.length > 0) doc.categories = splitDb.categories;
      const coreDocs = [...splitDb.coreDocuments, ...splitAgent.coreDocuments];
      // const activeDataControllers = [...splitDb.activeDataControllers, ...splitAgent.activeDataControllers];
      const placeholders = [...splitDb.placeholders, ...splitAgent.placeholders];
      if (coreDocs.length > 0) doc.coreDocuments = coreDocs;
      // if (activeDataControllers.length > 0) doc.activeDataControllers = activeDataControllers;
      // if (splitDb.typeSpecifications.length > 0) doc.typeSpecifications = splitDb.typeSpecifications;
      if (placeholders.length > 0) doc.placeholders = placeholders;

      const supportingDocs = mapSupportingDocsForArticle(node);
      if (supportingDocs) doc.supportingDocuments = supportingDocs;
      return doc;
    }

    case 'Category': {
      // Category → omits `docNo`, has only `sections` (per Atlas hierarchy rules)
      validateChildTypes(node, ['Section', 'Category', 'Placeholder']);
      // validateChildTypes(node, ['Section', 'Core', 'Active Data Controller', 'Type Specification', 'Placeholder', 'Annotation', 'Action Tenet', 'Needed Research']);
      const baseCategory: Omit<BaseAtlasDocument, 'docNo'> = {
        type: base.type,
        name: base.name,
        uuid: base.uuid,
        content: base.content,
      };
      const doc: CategoryDocument = { ...baseCategory, sections: [] };
      const splitDb = mapSectionsAndPrimaryDocs(node);
      const splitAgent = mapAgentScopeDocs(node);
      if (splitDb.sections.length > 0) doc.sections = splitDb.sections;
      if (splitDb.categories.length > 0) doc.categories = splitDb.categories;
      // const coreDocs = [...splitDb.coreDocuments, ...splitAgent.coreDocuments];
      // const activeDataControllers = [...splitDb.activeDataControllers, ...splitAgent.activeDataControllers];
      const placeholders = [...splitDb.placeholders, ...splitAgent.placeholders];
      // if (coreDocs.length > 0) doc.coreDocuments = coreDocs;
      // if (activeDataControllers.length > 0) doc.activeDataControllers = activeDataControllers;
      // if (splitDb.typeSpecifications.length > 0) doc.typeSpecifications = splitDb.typeSpecifications;
      if (placeholders.length > 0) doc.placeholders = placeholders;
      // const supportingDocs = mapSupportingDocsForSectionCoreSpec(node);
      // if (supportingDocs) doc.supportingDocuments = supportingDocs;

      return doc;
    }

    case 'Section': {
      // Section → mixed children split + supporting docs
      validateChildTypes(node, [
        'Section',
        'Core',
        'Active Data Controller',
        'Type Specification',
        'Placeholder',
        'Annotation',
        'Action Tenet',
        'Needed Research',
      ]);
      const doc: SectionDocument = { ...base };
      const splitDb = mapSectionsAndPrimaryDocs(node);
      const splitAgent = mapAgentScopeDocs(node);
      const coreDocs = [...splitDb.coreDocuments, ...splitAgent.coreDocuments];
      const activeDataControllers = [...splitDb.activeDataControllers, ...splitAgent.activeDataControllers];
      const placeholders = [...splitDb.placeholders, ...splitAgent.placeholders];
      if (coreDocs.length > 0) doc.coreDocuments = coreDocs;
      if (activeDataControllers.length > 0) doc.activeDataControllers = activeDataControllers;
      if (splitDb.typeSpecifications.length > 0) doc.typeSpecifications = splitDb.typeSpecifications;
      if (placeholders.length > 0) doc.placeholders = placeholders;
      const supportingDocs = mapSupportingDocsForSectionCoreSpec(node);
      if (supportingDocs) doc.supportingDocuments = supportingDocs;
      return doc;
    }

    case 'Core': {
      // Core → mixed children split + supporting docs
      validateChildTypes(node, [
        'Core',
        'Active Data Controller',
        'Type Specification',
        'Placeholder',
        'Annotation',
        'Action Tenet',
        'Needed Research',
      ]);
      const doc: CoreDocument = { ...base };
      const splitDb = mapSectionsAndPrimaryDocs(node);
      const splitAgent = mapAgentScopeDocs(node);
      const coreDocs = [...splitDb.coreDocuments, ...splitAgent.coreDocuments];
      const activeDataControllers = [...splitDb.activeDataControllers, ...splitAgent.activeDataControllers];
      const placeholders = [...splitDb.placeholders, ...splitAgent.placeholders];
      if (coreDocs.length > 0) doc.coreDocuments = coreDocs;
      if (activeDataControllers.length > 0) doc.activeDataControllers = activeDataControllers;
      if (splitDb.typeSpecifications.length > 0) doc.typeSpecifications = splitDb.typeSpecifications;
      if (placeholders.length > 0) doc.placeholders = placeholders;
      const supportingDocs = mapSupportingDocsForSectionCoreSpec(node);
      if (supportingDocs) doc.supportingDocuments = supportingDocs;
      return doc;
    }

    case 'Active Data Controller': {
      // Active Data Controller → supporting docs include `activeData`
      validateChildTypes(node, ['Active Data', 'Annotation', 'Action Tenet', 'Needed Research']);
      const doc: ActiveDataControllerDocument = { ...base };
      const supportingDocs = mapSupportingDocsForActiveDataController(node);
      if (supportingDocs) doc.supportingDocuments = supportingDocs;
      return doc;
    }

    case 'Type Specification': {
      // Type Specification → supporting docs only
      validateChildTypes(node, ['Annotation', 'Action Tenet', 'Needed Research']);
      const doc: TypeSpecificationDocument = { ...base };
      const supportingDocs = mapSupportingDocsForSectionCoreSpec(node);
      if (supportingDocs) doc.supportingDocuments = supportingDocs;
      return doc;
    }

    case 'Action Tenet': {
      // Tenet → has `scenarios`
      validateChildTypes(node, ['Scenario']);
      const doc: TenetDocument = { ...base };
      if (node.scenarios.length > 0) {
        doc.scenarios = node.scenarios.map((c) => atlasNodeToStandardized(c) as ScenarioDocument);
      }
      return doc;
    }

    case 'Scenario': {
      // Scenario → has `scenarioVariations`
      validateChildTypes(node, ['Scenario Variation']);
      const doc: ScenarioDocument = { ...base, scenarioVariations: [] };
      if (node.scenarioVariations.length > 0) {
        doc.scenarioVariations = mapAllAs<ScenarioVariationDocument>(node.scenarioVariations);
      }
      return doc;
    }

    case 'Annotation':
    case 'Active Data':
    case 'Scenario Variation':
    case 'Needed Research':
    case 'Placeholder':
      // Leaf docs → base only
      validateChildTypes(node, []);
      return { ...base } as StandardizedAtlasDocument;

    default:
      console.error(`Unknown document type: ${node.atlas_document_type}`);
      return { ...base } as StandardizedAtlasDocument;
  }
}

export default atlasNodeToStandardized;
