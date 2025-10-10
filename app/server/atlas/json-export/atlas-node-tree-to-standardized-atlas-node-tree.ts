/**
 * Standardize Atlas Trees
 *
 * Purpose
 * - Converts an `AtlasTreeNode` (children grouped by Atlas database) into a
 *   `StandardizedAtlasDocument` (children grouped by Atlas database).
 * - Preserves original child order and recursively converts all descendants.
 *
 * How it works
 * - Base fields are mapped 1:1 from the node: `type` (document type), `doc_no`, `name`, `uuid`.
 * - For relationships: children are grouped by Atlas database, maintaining the same structure as AtlasTreeNode.
 * - The `type` field uses Atlas document types (Scope, Article, Section, etc.) for compatibility.
 * - Child collections use database-based grouping (articles, sections_and_primary_docs, etc.).
 * - Everything is recursive: child nodes are converted with the same function.
 * - Uses underscore_case for JSON export compatibility.
 *
 * Usage
 * ```ts
 * import { atlasNodeToStandardized } from '@/app/server/atlas/json-export/atlas-node-tree-to-standardized-atlas-node-tree';
 * const standardized: StandardizedAtlasDocument = atlasNodeToStandardized(rootNode);
 * ```
 */
import { type AtlasTreeNode } from '@/app/server/atlas/atlas-tree-types';
import { AGENT_ROOT_SECTION_UUIDS, type AtlasDatabaseName } from '@/app/server/atlas/constants';
import {
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '@/app/server/atlas/notion-database-properties-and-relationships';
import { uuidToHyphens } from '@/app/shared/utils/utils';
import { atlasDatabasePageToMarkdown } from '../atlas-rich-text-formatter';
import { UuidMappings } from '../load-uuid-mapping';
import {
  type ActiveDataDocument,
  type AgentScopeDatabaseDocument,
  type AnnotationsDocument,
  type ArticlesDocument,
  type BaseAtlasDocument,
  type NeededResearchDocument,
  type ScenarioVariationsDocument,
  type ScenariosDocument,
  type ScopesDocument,
  type SectionsAndPrimaryDocsDocument,
  type StandardizedAtlasDocument,
  type TenetsDocument,
} from './types';

// Validation helper to check allowed child databases per Atlas hierarchy rules
function validateChildDatabases(node: AtlasTreeNode, allowedDatabases: AtlasDatabaseName[]): void {
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

  const invalidChildren = allChildren.filter((child) => !allowedDatabases.includes(child.atlas_database_name));
  if (invalidChildren.length > 0) {
    console.warn(
      `‼️  ${node.atlas_database_name} (generatedDocName: "${node.generatedDocName ?? ''}", id: ${node.notion_page_id}) has invalid child databases: ${invalidChildren
        .map((c) => c.atlas_database_name)
        .join(', ')}`,
    );
  }
}

// Convert simple fields
function toBase(node: AtlasTreeNode, uuidMappings: UuidMappings): BaseAtlasDocument {
  if (!(node.generatedDocName && node.generatedDocName.length > 0)) {
    console.warn(
      `⚠️  Missing 'generatedDocName' value for ${node.atlas_document_type} document (id: ${node.notion_page_id})`,
    );
  }

  const atlasUUID = uuidMappings.notionPageIDsToAtlasUUIDs.get(uuidToHyphens(node.notion_page_id)) ?? null;
  if (!atlasUUID) {
    console.warn(`⚠️  Missing Atlas UUID for ${node.atlas_document_type} document (id: ${node.notion_page_id})`);
  }

  return {
    type: node.atlas_document_type,
    doc_no: node.generatedDocID ?? node.atlas_document_number ?? '',
    name: node.generatedDocName ?? '',
    uuid: atlasUUID,
    last_modified: '',
    // last_modified: node.updated_at, // TODO: Remove
    content: atlasDatabasePageToMarkdown(node, uuidMappings).trim(),
  };
}

// Helper: deterministically pick extra_fields for a node based on database
// Optionally require a specific document type to include fields
function pickExtraFields(node: AtlasTreeNode): Record<string, unknown> {
  let allowedKeys: string[] = [];
  switch (node.atlas_document_type) {
    case 'Type Specification':
      allowedKeys = Object.keys(TYPE_SPECIFICATION_PROPERTY_MAPPING);
      break;
    case 'Scenario':
      allowedKeys = Object.keys(SCENARIO_PROPERTY_MAPPING);
      break;
    case 'Scenario Variation':
      allowedKeys = Object.keys(SCENARIO_VARIATION_PROPERTY_MAPPING);
      break;
    default:
      return {};
  }

  if (!node.extra_fields || typeof node.extra_fields !== 'object' || Array.isArray(node.extra_fields)) {
    console.warn(
      `⚠️  Missing extra_fields for ${node.atlas_document_type} document (generatedDocName: "${node.generatedDocName ?? ''}", id: ${node.notion_page_id}). Expected keys: ${allowedKeys.join(', ')}`,
    );
    // Provide all expected keys with null so downstream generators can surface "empty" rather than "missing"
    const nullFilled = Object.fromEntries(allowedKeys.map((key) => [key, null]));
    return nullFilled;
  }

  const extra = node.extra_fields as Record<string, unknown>;
  const result = Object.fromEntries(allowedKeys.map((key) => [key, key in extra ? extra[key] : null]));
  const missingKeys = allowedKeys.filter((k) => !(k in extra));
  if (missingKeys.length > 0) {
    console.warn(
      `⚠️  Incomplete extra_fields for ${node.atlas_document_type} document (generatedDocName: "${node.generatedDocName ?? ''}", id: ${node.notion_page_id}). Missing keys: ${missingKeys.join(', ')}`,
    );
  }
  return result;
}

// Main entry: convert an `AtlasTreeNode` into a `StandardizedAtlasDocument`
export function atlasNodeToStandardized(
  node: AtlasTreeNode,
  uuidMappings: UuidMappings,
  options?: { omitAgents: boolean },
): StandardizedAtlasDocument {
  const base = toBase(node, uuidMappings);

  // If omitting Agent Scope subtrees (for BLUE JSON compatibility) and this node matches one of the agent roots,
  // prune all its children (keep the node itself with empty children arrays).
  const isAgentRoot = node.notion_page_id != null && AGENT_ROOT_SECTION_UUIDS.has(node.notion_page_id);
  if (options?.omitAgents && isAgentRoot) {
    return { ...base } as StandardizedAtlasDocument;
  }

  switch (node.atlas_database_name) {
    case 'Scopes': {
      // Scopes → has `articles`
      validateChildDatabases(node, ['Articles']);
      const doc: ScopesDocument = {
        ...base,
        articles: node.articles.map((c) => atlasNodeToStandardized(c, uuidMappings) as ArticlesDocument),
      };
      return doc;
    }

    case 'Articles': {
      // Articles → has `sections_and_primary_docs` and `agent_scope_database`
      validateChildDatabases(node, [
        'Sections & Primary Docs',
        'Agent Scope Database',
        'Annotations',
        'Needed Research',
      ]); // TODO: Add annotations, needed_research
      const doc: ArticlesDocument = {
        ...base,
        sections_and_primary_docs: node.sectionsAndPrimaryDocs.map(
          (c) => atlasNodeToStandardized(c, uuidMappings) as SectionsAndPrimaryDocsDocument,
        ),
        // agent_scope_database: node.agentScopeDocs.map((c) => atlasNodeToStandardized(c) as AgentScopeDatabaseDocument),
        annotations: node.annotations.map((c) => atlasNodeToStandardized(c, uuidMappings) as AnnotationsDocument),
        needed_research: node.neededResearch.map(
          (c) => atlasNodeToStandardized(c, uuidMappings) as NeededResearchDocument,
        ),
      };
      return doc;
    }

    case 'Sections & Primary Docs': {
      // Sections & Primary Docs → has `annotations` and `tenets`
      validateChildDatabases(node, [
        'Sections & Primary Docs',
        'Agent Scope Database',
        'Annotations',
        'Tenets',
        'Active Data',
        'Needed Research',
      ]);
      const doc: SectionsAndPrimaryDocsDocument = {
        ...base,
        ...pickExtraFields(node),
        sections_and_primary_docs: node.sectionsAndPrimaryDocs.map(
          (c) => atlasNodeToStandardized(c, uuidMappings) as SectionsAndPrimaryDocsDocument,
        ),
        annotations: node.annotations.map((c) => atlasNodeToStandardized(c, uuidMappings) as AnnotationsDocument),
        tenets: node.tenets.map((c) => atlasNodeToStandardized(c, uuidMappings) as TenetsDocument),
        active_data: node.activeData.map((c) => atlasNodeToStandardized(c, uuidMappings) as ActiveDataDocument),
        needed_research: node.neededResearch.map(
          (c) => atlasNodeToStandardized(c, uuidMappings) as NeededResearchDocument,
        ),
      };
      if (node.agentScopeDocs.length > 0) {
        doc.agent_scope_database = node.agentScopeDocs.map(
          (c) => atlasNodeToStandardized(c, uuidMappings) as AgentScopeDatabaseDocument,
        );
      }
      return doc;
    }

    case 'Annotations': {
      // Annotations → leaf database
      validateChildDatabases(node, ['Needed Research']); // TODO: Add needed_research
      const doc: AnnotationsDocument = {
        ...base,
        needed_research: node.neededResearch.map(
          (c) => atlasNodeToStandardized(c, uuidMappings) as NeededResearchDocument,
        ),
      };
      return doc;
    }

    case 'Tenets': {
      // Tenets → has `scenarios`
      validateChildDatabases(node, ['Scenarios', 'Needed Research']); // TODO: Add needed_research
      const doc: TenetsDocument = {
        ...base,
        scenarios: node.scenarios.map((c) => atlasNodeToStandardized(c, uuidMappings) as ScenariosDocument),
        needed_research: node.neededResearch.map(
          (c) => atlasNodeToStandardized(c, uuidMappings) as NeededResearchDocument,
        ),
      };
      return doc;
    }

    case 'Scenarios': {
      // Scenarios → has `scenario_variations`
      validateChildDatabases(node, ['Scenario Variations', 'Needed Research']); // TODO: Add needed_research
      const doc: ScenariosDocument = {
        ...base,
        ...pickExtraFields(node),
        scenario_variations: node.scenarioVariations.map(
          (c) => atlasNodeToStandardized(c, uuidMappings) as ScenarioVariationsDocument,
        ),
        needed_research: node.neededResearch.map(
          (c) => atlasNodeToStandardized(c, uuidMappings) as NeededResearchDocument,
        ),
      };
      return doc;
    }

    case 'Scenario Variations': {
      // Scenario Variations → leaf database
      validateChildDatabases(node, ['Needed Research']); // TODO: Add needed_research
      const doc: ScenarioVariationsDocument = {
        ...base,
        ...pickExtraFields(node),
        needed_research: node.neededResearch.map(
          (c) => atlasNodeToStandardized(c, uuidMappings) as NeededResearchDocument,
        ),
      };
      return doc;
    }

    case 'Active Data': {
      // Active Data → leaf database
      validateChildDatabases(node, ['Needed Research']); // TODO: Add needed_research
      const doc: ActiveDataDocument = {
        ...base,
        needed_research: node.neededResearch.map(
          (c) => atlasNodeToStandardized(c, uuidMappings) as NeededResearchDocument,
        ),
      };
      return doc;
    }

    case 'Agent Scope Database': {
      // Agent Scope Database → has `annotations`, `tenets`, and `active_data`
      validateChildDatabases(node, ['Agent Scope Database', 'Annotations', 'Tenets', 'Active Data', 'Needed Research']); // TODO: Add needed_research
      const doc: AgentScopeDatabaseDocument = {
        ...base,
        agent_scope_database: node.agentScopeDocs.map(
          (c) => atlasNodeToStandardized(c, uuidMappings) as AgentScopeDatabaseDocument,
        ),
        annotations: node.annotations.map((c) => atlasNodeToStandardized(c, uuidMappings) as AnnotationsDocument),
        tenets: node.tenets.map((c) => atlasNodeToStandardized(c, uuidMappings) as TenetsDocument),
        active_data: node.activeData.map((c) => atlasNodeToStandardized(c, uuidMappings) as ActiveDataDocument),
        needed_research: node.neededResearch.map(
          (c) => atlasNodeToStandardized(c, uuidMappings) as NeededResearchDocument,
        ),
      };
      return doc;
    }

    case 'Needed Research': {
      // Needed Research → leaf database
      validateChildDatabases(node, []);
      const doc: NeededResearchDocument = {
        ...base,
      };
      return doc;
    }

    default:
      console.error(`Unknown database: ${node.atlas_database_name}`);
      return { ...base } as StandardizedAtlasDocument;
  }
}

export default atlasNodeToStandardized;
