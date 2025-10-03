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
 *     - `sectionsAndPrimaryDocs` → `sections`, `coreDocuments`,
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
  type CoreDocument,
  type NeededResearchDocument,
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
      `‼️  ${node.atlas_document_type} "${node.plain_text_name} (${node.notion_page_id})" has invalid child types: ${invalidChildren.map((c) => c.atlas_document_type).join(', ')}`,
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
    lastModified: node.updated_at,
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
  coreDocuments: CoreDocument[];
  activeDataControllers: ActiveDataControllerDocument[];
  typeSpecifications: TypeSpecificationDocument[];
} {
  return {
    sections: filterMapByType<SectionDocument>(node.sectionsAndPrimaryDocs, 'Section'),
    coreDocuments: filterMapByType<CoreDocument>(node.sectionsAndPrimaryDocs, 'Core'),
    activeDataControllers: filterMapByType<ActiveDataControllerDocument>(
      node.sectionsAndPrimaryDocs,
      'Active Data Controller',
    ),
    typeSpecifications: filterMapByType<TypeSpecificationDocument>(node.sectionsAndPrimaryDocs, 'Type Specification'),
  };
}

// Split `agentScopeDocs` (mixed Core + Active Data Controller) into atlas-document-type-grouped arrays
function mapAgentScopeDocs(node: AtlasTreeNode): {
  coreDocuments: CoreDocument[];
  activeDataControllers: ActiveDataControllerDocument[];
} {
  return {
    coreDocuments: filterMapByType<CoreDocument>(node.agentScopeDocs, 'Core'),
    activeDataControllers: filterMapByType<ActiveDataControllerDocument>(node.agentScopeDocs, 'Active Data Controller'),
  };
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
      const doc: ScopeDocument = {
        ...base,
        articles: node.articles.map((c) => atlasNodeToStandardized(c) as ArticleDocument),
      };
      return doc;
    }

    case 'Article': {
      // Article → only sections (per Atlas hierarchy rules) - But in practice can have mixed children
      validateChildTypes(node, [
        'Section',
        'Core',
        'Annotation',
        // 'Action Tenet',
        'Needed Research',
      ]);
      const splitDb = mapSectionsAndPrimaryDocs(node);
      const splitAgent = mapAgentScopeDocs(node);
      const doc: ArticleDocument = {
        ...base,
        sections: splitDb.sections,
        coreDocuments: [...splitDb.coreDocuments, ...splitAgent.coreDocuments],
        // Supporting docs
        annotations: mapAllAs<AnnotationDocument>(node.annotations),
        neededResearch: mapAllAs<NeededResearchDocument>(node.neededResearch),
        tenets: mapAllAs<TenetDocument>(node.tenets),
      };
      return doc;
    }

    case 'Section': {
      // Section → mixed children split + supporting docs
      validateChildTypes(node, [
        'Section', // TODO: Remove
        'Core',
        'Active Data Controller',
        'Type Specification',
        'Annotation',
        'Action Tenet',
        'Needed Research',
      ]);
      const splitDb = mapSectionsAndPrimaryDocs(node);
      const splitAgent = mapAgentScopeDocs(node);
      const doc: SectionDocument = {
        ...base,
        coreDocuments: [...splitDb.coreDocuments, ...splitAgent.coreDocuments],
        activeDataControllers: [...splitDb.activeDataControllers, ...splitAgent.activeDataControllers],
        typeSpecifications: splitDb.typeSpecifications,
        // Supporting docs
        annotations: mapAllAs<AnnotationDocument>(node.annotations),
        neededResearch: mapAllAs<NeededResearchDocument>(node.neededResearch),
        tenets: mapAllAs<TenetDocument>(node.tenets),
      };
      return doc;
    }

    case 'Core': {
      // Core → mixed children split + supporting docs
      validateChildTypes(node, [
        'Core',
        'Active Data Controller',
        'Type Specification',
        'Annotation',
        'Action Tenet',
        'Needed Research',
      ]);
      const splitDb = mapSectionsAndPrimaryDocs(node);
      const splitAgent = mapAgentScopeDocs(node);
      const doc: CoreDocument = {
        ...base,
        coreDocuments: [...splitDb.coreDocuments, ...splitAgent.coreDocuments],
        activeDataControllers: [...splitDb.activeDataControllers, ...splitAgent.activeDataControllers],
        typeSpecifications: splitDb.typeSpecifications,

        // Supporting docs
        annotations: mapAllAs<AnnotationDocument>(node.annotations),
        neededResearch: mapAllAs<NeededResearchDocument>(node.neededResearch),
        tenets: mapAllAs<TenetDocument>(node.tenets),
      };
      return doc;
    }

    case 'Active Data Controller': {
      // Active Data Controller → supporting docs include `activeData`
      validateChildTypes(node, ['Active Data', 'Annotation', 'Action Tenet', 'Needed Research']);
      const doc: ActiveDataControllerDocument = {
        ...base,

        // Supporting docs
        activeData: mapAllAs<ActiveDataDocument>(node.activeData),
        annotations: mapAllAs<AnnotationDocument>(node.annotations),
        neededResearch: mapAllAs<NeededResearchDocument>(node.neededResearch),
        tenets: mapAllAs<TenetDocument>(node.tenets),
      };
      return doc;
    }

    case 'Type Specification': {
      // Type Specification → supporting docs only
      validateChildTypes(node, ['Annotation', 'Action Tenet', 'Needed Research']);
      const doc: TypeSpecificationDocument = {
        ...base,

        // Supporting docs
        annotations: mapAllAs<AnnotationDocument>(node.annotations),
        neededResearch: mapAllAs<NeededResearchDocument>(node.neededResearch),
        tenets: mapAllAs<TenetDocument>(node.tenets),
      };
      return doc;
    }

    case 'Action Tenet': {
      // Tenet → has `scenarios`
      validateChildTypes(node, ['Scenario']);
      const doc: TenetDocument = {
        ...base,
        scenarios: node.scenarios.map((c) => atlasNodeToStandardized(c) as ScenarioDocument),
      };
      return doc;
    }

    case 'Scenario': {
      // Scenario → has `scenarioVariations`
      validateChildTypes(node, ['Scenario Variation']);
      const doc: ScenarioDocument = {
        ...base,
        scenarioVariations: node.scenarioVariations.map((c) => atlasNodeToStandardized(c) as ScenarioVariationDocument),
      };
      return doc;
    }

    case 'Annotation':
    case 'Active Data':
    case 'Scenario Variation':
    case 'Needed Research':
      // Leaf docs → base only
      validateChildTypes(node, []);
      return {
        ...base,
      } as StandardizedAtlasDocument;

    default:
      console.error(`Unknown document type: ${node.atlas_document_type}`);
      return { ...base } as StandardizedAtlasDocument;
  }
}

export default atlasNodeToStandardized;
