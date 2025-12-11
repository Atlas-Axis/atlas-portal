/**
 * Convert Notion Atlas Tree to Export Atlas Tree
 *
 * Purpose
 * - Converts a `NotionAtlasTreeNode` (Internal Atlas Representation) into an
 *   `ExportAtlasTreeDocument` (External Atlas Representation).
 * - Preserves original child order and recursively converts all descendants.
 *
 * How it works
 * - Base fields use stored values from Supabase (from standardized Notion fields):
 *   - `doc_no`: from `atlas_document_number` (standardized "Document Number" Notion field)
 *   - `name`: from `plain_text_name` (standardized "Document Title" Notion field)
 *   - `type`: from `atlas_document_type`
 *   - `uuid`: from UUID mapping table
 * - For relationships: children are grouped by Atlas database, maintaining the same structure as NotionAtlasTreeNode.
 * - The `type` field uses Atlas document types (Scope, Article, Section, etc.) for compatibility.
 * - Child collections use database-based grouping (articles, sections_and_primary_docs, etc.).
 * - Everything is recursive: child nodes are converted with the same function.
 * - Uses underscore_case for JSON export compatibility.
 *
 * See: docs/action-plans/NOTION_PROPERTY_STANDARDIZATION_ACTION_PLAN.md
 *
 * Usage
 * ```ts
 * import { notionTreeNodeToExportTreeNode } from '@/app/server/atlas/export/notion-tree-to-export-tree';
 * const exportDoc: ExportAtlasTreeDocument = notionTreeNodeToExportTreeNode(rootNode, uuidMappings);
 * ```
 */
import { RichTextItemResponse } from '@notionhq/client';
import { type AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import {
  NEEDED_RESEARCH_PROPERTY_MAPPING,
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '@/app/server/atlas/notion-mapping/notion-database-properties-and-relationships';
import { type NotionAtlasTreeNode } from '@/app/server/atlas/notion-tree/atlas-tree-system';
import { convertNotionRichTextToMarkdown } from '@/app/server/markdown/rich-text-to-markdown';
import { uuidToHyphens } from '@/app/shared/utils/utils';
import { atlasDatabasePageToMarkdown } from '../formatters/atlas-rich-text-formatter';
import { UuidMappings } from '../load-uuid-mapping';
import {
  type ExportAtlasTreeActiveDataDocument,
  type ExportAtlasTreeAgentScopeDatabaseDocument,
  type ExportAtlasTreeAnnotationsDocument,
  type ExportAtlasTreeArticlesDocument,
  type ExportAtlasTreeBaseDocument,
  type ExportAtlasTreeDocument,
  type ExportAtlasTreeNeededResearchDocument,
  type ExportAtlasTreeScenarioVariationsDocument,
  type ExportAtlasTreeScenariosDocument,
  type ExportAtlasTreeScopesDocument,
  type ExportAtlasTreeSectionsAndPrimaryDocsDocument,
  type ExportAtlasTreeTenetsDocument,
} from './types';

/**
 * Options for export tree conversion
 *
 * @todo CLEANUP: Remove after migration complete (Phase 8)
 */
export interface ExportTreeOptions {
  /**
   * Use dynamically calculated doc_no/name (generatedDocID/generatedDocName)
   * instead of stored values from Supabase (atlas_document_number/plain_text_name).
   *
   * Default: true (use dynamic values until production migration is complete)
   *
   * After migration is complete (Phase 8):
   * - Change default to false (use stored values)
   * - Eventually remove this option entirely
   *
   * @todo CLEANUP: After migration, change default to false and remove option (Phase 8)
   */
  useDynamicValues?: boolean;
}

/**
 * Converts an extra field value to markdown string.
 * Handles the new rich text structure: { plain_text, rich_text }.
 */
function convertExtraFieldToMarkdown(
  fieldValue: { plain_text: string | null; rich_text: RichTextItemResponse[] | null } | string | null,
  uuidMappings: UuidMappings,
): string {
  // Handle null or undefined
  if (!fieldValue) {
    return '';
  }

  // Handle legacy string format (for backward compatibility during transition)
  if (typeof fieldValue === 'string') {
    return fieldValue;
  }

  // Handle new structure with rich_text
  if (typeof fieldValue === 'object' && 'plain_text' in fieldValue) {
    const richText = fieldValue.rich_text;

    // If rich_text exists and is an array, convert to markdown
    if (richText && Array.isArray(richText) && richText.length > 0) {
      return convertNotionRichTextToMarkdown(richText as RichTextItemResponse[], uuidMappings);
    }

    // Otherwise, return plain text
    return fieldValue.plain_text || '';
  }

  return '';
}

// Validation helper to check allowed child databases per Atlas hierarchy rules
function validateChildDatabases(node: NotionAtlasTreeNode, allowedDatabases: AtlasDatabaseName[]): void {
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
// By default, uses dynamically generated values (generatedDocID/generatedDocName) until
// the production migration is complete (Phase 8).
// When useDynamicValues is explicitly set to false, uses stored values from Supabase.
// See: docs/action-plans/NOTION_PROPERTY_STANDARDIZATION_ACTION_PLAN.md
// @todo CLEANUP: After migration, change default to false and remove options parameter (Phase 8)
function toBase(
  node: NotionAtlasTreeNode,
  uuidMappings: UuidMappings,
  options?: ExportTreeOptions,
): ExportAtlasTreeBaseDocument {
  const useDynamic = options?.useDynamicValues ?? true; // @todo CLEANUP: After migration, change default to false and remove option (Phase 8)

  // @todo CLEANUP: Remove conditional validation after migration (Phase 8) - only keep stored mode validation
  if (useDynamic) {
    // Dynamic mode: check for generatedDocName
    if (!(node.generatedDocName && node.generatedDocName.length > 0)) {
      console.warn(
        `⚠️  Missing 'generatedDocName' value for ${node.atlas_document_type} document (id: ${node.notion_page_id})`,
      );
    }
  } else {
    // Stored mode: check for plain_text_name
    if (!(node.plain_text_name && node.plain_text_name.length > 0)) {
      console.warn(
        `⚠️  Missing 'plain_text_name' value for ${node.atlas_document_type} document (id: ${node.notion_page_id})`,
      );
    }
  }

  const atlasUUID = uuidMappings.notionPageIDsToAtlasUUIDs.get(uuidToHyphens(node.notion_page_id)) ?? null;
  if (!atlasUUID) {
    console.warn(`⚠️  Missing Atlas UUID for ${node.atlas_document_type} document (id: ${node.notion_page_id})`);
  }

  return {
    type: node.atlas_document_type,
    // @todo CLEANUP: After migration (Phase 8), simplify to: doc_no: node.atlas_document_number ?? '', name: node.plain_text_name ?? ''
    doc_no: useDynamic ? (node.generatedDocID ?? '') : (node.atlas_document_number ?? ''),
    name: useDynamic ? (node.generatedDocName ?? '') : (node.plain_text_name ?? ''),
    uuid: atlasUUID,
    last_modified: '',
    // last_modified: node.updated_at, // TODO: Remove
    content: atlasDatabasePageToMarkdown(node, uuidMappings).trim(),
  };
}

// Helper: deterministically pick extra_fields for a node based on database
// Optionally require a specific document type to include fields
function pickExtraFields(node: NotionAtlasTreeNode, uuidMappings: UuidMappings): Record<string, unknown> {
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
    case 'Needed Research':
      allowedKeys = Object.keys(NEEDED_RESEARCH_PROPERTY_MAPPING);
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

  const extra = node.extra_fields as Record<
    string,
    { plain_text: string | null; rich_text: RichTextItemResponse[] | null } | string | null
  >;

  // Extract and convert each field to markdown string
  const result = Object.fromEntries(
    allowedKeys.map((key) => {
      if (key in extra) {
        const fieldValue = extra[key];
        // Convert rich text structure to markdown string
        const markdownValue = convertExtraFieldToMarkdown(fieldValue, uuidMappings);
        return [key, markdownValue || null];
      }
      return [key, null];
    }),
  );

  const missingKeys = allowedKeys.filter((k) => !(k in extra));
  if (missingKeys.length > 0) {
    console.warn(
      `⚠️  Incomplete extra_fields for ${node.atlas_document_type} document (generatedDocName: "${node.generatedDocName ?? ''}", id: ${node.notion_page_id}). Missing keys: ${missingKeys.join(', ')}`,
    );
  }
  return result;
}

// Main entry: convert a `NotionAtlasTreeNode` into an `ExportAtlasTreeDocument`
// @todo CLEANUP: Remove options parameter after migration (Phase 8)
export function notionTreeNodeToExportTreeNode(
  node: NotionAtlasTreeNode,
  uuidMappings: UuidMappings,
  options?: ExportTreeOptions,
): ExportAtlasTreeDocument {
  const base = toBase(node, uuidMappings, options);

  switch (node.atlas_database_name) {
    case 'Scopes': {
      // Scopes → has `articles`
      validateChildDatabases(node, ['Articles']);
      const doc: ExportAtlasTreeScopesDocument = {
        ...base,
        articles: node.articles.map(
          (c) => notionTreeNodeToExportTreeNode(c, uuidMappings, options) as ExportAtlasTreeArticlesDocument,
        ),
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
      const doc: ExportAtlasTreeArticlesDocument = {
        ...base,
        sections_and_primary_docs: node.sectionsAndPrimaryDocs.map(
          (c) =>
            notionTreeNodeToExportTreeNode(c, uuidMappings, options) as ExportAtlasTreeSectionsAndPrimaryDocsDocument,
        ),
        // agent_scope_database: node.agentScopeDocs.map((c) => notionTreeNodeToExportTreeNode(c, uuidMappings, options) as ExportAtlasTreeAgentScopeDatabaseDocument),
        annotations: node.annotations.map(
          (c) => notionTreeNodeToExportTreeNode(c, uuidMappings, options) as ExportAtlasTreeAnnotationsDocument,
        ),
        needed_research: node.neededResearch.map(
          (c) => notionTreeNodeToExportTreeNode(c, uuidMappings, options) as ExportAtlasTreeNeededResearchDocument,
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
      const doc: ExportAtlasTreeSectionsAndPrimaryDocsDocument = {
        ...base,
        ...pickExtraFields(node, uuidMappings),
        sections_and_primary_docs: node.sectionsAndPrimaryDocs.map(
          (c) =>
            notionTreeNodeToExportTreeNode(c, uuidMappings, options) as ExportAtlasTreeSectionsAndPrimaryDocsDocument,
        ),
        annotations: node.annotations.map(
          (c) => notionTreeNodeToExportTreeNode(c, uuidMappings, options) as ExportAtlasTreeAnnotationsDocument,
        ),
        tenets: node.tenets.map(
          (c) => notionTreeNodeToExportTreeNode(c, uuidMappings, options) as ExportAtlasTreeTenetsDocument,
        ),
        active_data: node.activeData.map(
          (c) => notionTreeNodeToExportTreeNode(c, uuidMappings, options) as ExportAtlasTreeActiveDataDocument,
        ),
        needed_research: node.neededResearch.map(
          (c) => notionTreeNodeToExportTreeNode(c, uuidMappings, options) as ExportAtlasTreeNeededResearchDocument,
        ),
      };
      if (node.agentScopeDocs.length > 0) {
        doc.agent_scope_database = node.agentScopeDocs.map(
          (c) => notionTreeNodeToExportTreeNode(c, uuidMappings, options) as ExportAtlasTreeAgentScopeDatabaseDocument,
        );
      }
      return doc;
    }

    case 'Annotations': {
      // Annotations → leaf database
      validateChildDatabases(node, ['Needed Research']); // TODO: Add needed_research
      const doc: ExportAtlasTreeAnnotationsDocument = {
        ...base,
        needed_research: node.neededResearch.map(
          (c) => notionTreeNodeToExportTreeNode(c, uuidMappings, options) as ExportAtlasTreeNeededResearchDocument,
        ),
      };
      return doc;
    }

    case 'Tenets': {
      // Tenets → has `scenarios`
      validateChildDatabases(node, ['Scenarios', 'Needed Research']); // TODO: Add needed_research
      const doc: ExportAtlasTreeTenetsDocument = {
        ...base,
        scenarios: node.scenarios.map(
          (c) => notionTreeNodeToExportTreeNode(c, uuidMappings, options) as ExportAtlasTreeScenariosDocument,
        ),
        needed_research: node.neededResearch.map(
          (c) => notionTreeNodeToExportTreeNode(c, uuidMappings, options) as ExportAtlasTreeNeededResearchDocument,
        ),
      };
      return doc;
    }

    case 'Scenarios': {
      // Scenarios → has `scenario_variations`
      validateChildDatabases(node, ['Scenario Variations', 'Needed Research']); // TODO: Add needed_research
      const doc: ExportAtlasTreeScenariosDocument = {
        ...base,
        ...pickExtraFields(node, uuidMappings),
        scenario_variations: node.scenarioVariations.map(
          (c) => notionTreeNodeToExportTreeNode(c, uuidMappings, options) as ExportAtlasTreeScenarioVariationsDocument,
        ),
        needed_research: node.neededResearch.map(
          (c) => notionTreeNodeToExportTreeNode(c, uuidMappings, options) as ExportAtlasTreeNeededResearchDocument,
        ),
      };
      return doc;
    }

    case 'Scenario Variations': {
      // Scenario Variations → leaf database
      validateChildDatabases(node, ['Needed Research']); // TODO: Add needed_research
      const doc: ExportAtlasTreeScenarioVariationsDocument = {
        ...base,
        ...pickExtraFields(node, uuidMappings),
        needed_research: node.neededResearch.map(
          (c) => notionTreeNodeToExportTreeNode(c, uuidMappings, options) as ExportAtlasTreeNeededResearchDocument,
        ),
      };
      return doc;
    }

    case 'Active Data': {
      // Active Data → leaf database
      validateChildDatabases(node, ['Needed Research']); // TODO: Add needed_research
      const doc: ExportAtlasTreeActiveDataDocument = {
        ...base,
        needed_research: node.neededResearch.map(
          (c) => notionTreeNodeToExportTreeNode(c, uuidMappings, options) as ExportAtlasTreeNeededResearchDocument,
        ),
      };
      return doc;
    }

    case 'Agent Scope Database': {
      // Agent Scope Database → has `annotations`, `tenets`, and `active_data`
      validateChildDatabases(node, ['Agent Scope Database', 'Annotations', 'Tenets', 'Active Data', 'Needed Research']); // TODO: Add needed_research
      const doc: ExportAtlasTreeAgentScopeDatabaseDocument = {
        ...base,
        agent_scope_database: node.agentScopeDocs.map(
          (c) => notionTreeNodeToExportTreeNode(c, uuidMappings, options) as ExportAtlasTreeAgentScopeDatabaseDocument,
        ),
        annotations: node.annotations.map(
          (c) => notionTreeNodeToExportTreeNode(c, uuidMappings, options) as ExportAtlasTreeAnnotationsDocument,
        ),
        tenets: node.tenets.map(
          (c) => notionTreeNodeToExportTreeNode(c, uuidMappings, options) as ExportAtlasTreeTenetsDocument,
        ),
        active_data: node.activeData.map(
          (c) => notionTreeNodeToExportTreeNode(c, uuidMappings, options) as ExportAtlasTreeActiveDataDocument,
        ),
        needed_research: node.neededResearch.map(
          (c) => notionTreeNodeToExportTreeNode(c, uuidMappings, options) as ExportAtlasTreeNeededResearchDocument,
        ),
      };
      return doc;
    }

    case 'Needed Research': {
      // Needed Research → leaf database
      validateChildDatabases(node, []);
      const doc: ExportAtlasTreeNeededResearchDocument = {
        ...base,
        ...pickExtraFields(node, uuidMappings),
      };
      return doc;
    }

    default:
      console.error(`Unknown database: ${node.atlas_database_name}`);
      return { ...base } as ExportAtlasTreeDocument;
  }
}

export default notionTreeNodeToExportTreeNode;
