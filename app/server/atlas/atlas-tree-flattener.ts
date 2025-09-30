import { NotionDatabasePage } from '../database/notion-database-page';
import { traverseTree } from './atlas-tree-traversal';
import { AtlasTreeNode } from './atlas-tree-types';
import { AtlasDatabaseName } from './constants';

export function flattenAtlasScopeTreesToNotionPages({
  scopeTrees,
}: {
  scopeTrees: AtlasTreeNode[];
}): Record<AtlasDatabaseName, NotionDatabasePage[]> {
  // Create a flat list of all Atlas pages for the AtlasList component, per database
  const flatAtlasPagesPerDatabase: Record<AtlasDatabaseName, NotionDatabasePage[]> = {
    Scopes: [],
    Articles: [],
    'Sections & Primary Docs': [],
    Annotations: [],
    Tenets: [],
    Scenarios: [],
    'Scenario Variations': [],
    'Active Data': [],
    'Agent Scope Database': [],
    'Needed Research': [],
  };

  // Helper function to convert AtlasTreeNode back to NotionDatabasePage
  const treeNodeToPage = (node: AtlasTreeNode): NotionDatabasePage => ({
    notion_page_id: node.notion_page_id,
    canonical_document_title: node.canonical_document_title,
    atlas_document_type: node.atlas_document_type,
    atlas_document_number: node.atlas_document_number,
    atlas_document_number_sortable: node.atlas_document_number_sortable,
    atlas_database_name: node.atlas_database_name,
    has_children: node.has_children,
    archived: node.archived,
    in_trash: node.in_trash,
    last_edited_by_user_id: node.last_edited_by_user_id,
    plain_text_name: node.plain_text_name,
    json_name: node.json_name,
    plain_text_content: node.plain_text_content,
    json_content: node.json_content,
    parent_notion_page_id: node.parent_notion_page_id,
    extra_fields: node.extra_fields,
    sort_order: node.sort_order,
    created_at: node.created_at,
    updated_at: node.updated_at,
    date_valid_from: node.date_valid_from,
    date_valid_to: node.date_valid_to,

    // These arrays are not used in the flat structure, so we set them to empty arrays
    child_scope_ids: [],
    child_article_ids: [],
    child_section_and_primary_doc_ids: [],
    child_annotation_ids: [],
    child_tenet_ids: [],
    child_scenario_ids: [],
    child_scenario_variation_ids: [],
    child_active_data_ids: [],
    child_agent_scope_ids: [],
    child_needed_research_ids: [],
  });

  // Traverse each scope tree and flatten all nodes by database
  scopeTrees.forEach((scopeTree) => {
    traverseTree(
      scopeTree,
      (node) => {
        const page = treeNodeToPage(node);
        flatAtlasPagesPerDatabase[node.atlas_database_name].push(page);
        return true; // Continue traversal
      },
      'preorder',
    );
  });

  return flatAtlasPagesPerDatabase;
}
