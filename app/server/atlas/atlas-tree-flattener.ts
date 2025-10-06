import { traverseTree } from './atlas-tree-traversal';
import { AtlasTreeNode } from './atlas-tree-types';
import { AtlasDatabaseName } from './constants';

export function flattenAtlasScopeTreesToNotionPages({
  scopeTrees,
}: {
  scopeTrees: AtlasTreeNode[];
}): Record<AtlasDatabaseName, AtlasTreeNode[]> {
  // Create a flat list of all Atlas pages for the AtlasList component, per database
  const flatAtlasNodesPerDatabase: Record<AtlasDatabaseName, AtlasTreeNode[]> = {
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
  const normalizeNode = (node: AtlasTreeNode): AtlasTreeNode => ({
    ...node,
    // These arrays are not used in the flat structure, so we set them to empty arrays
    scopes: [],
    articles: [],
    sectionsAndPrimaryDocs: [],
    annotations: [],
    tenets: [],
    scenarios: [],
    scenarioVariations: [],
    activeData: [],
    agentScopeDocs: [],
    neededResearch: [],
  });

  // Keep track of seen nodes to prevent duplicates
  const seenNodeIds = new Set<string>();

  // Traverse each scope tree and flatten all nodes by database
  scopeTrees.forEach((scopeTree) => {
    traverseTree(
      scopeTree,
      (node) => {
        // Skip if we've already processed this node
        if (seenNodeIds.has(node.notion_page_id)) {
          console.warn(
            `[flattenAtlasScopeTreesToNotionPages] Duplicate node detected: ${node.notion_page_id} - ${node.canonical_document_title || node.plain_text_name}`,
          );
          // Continue traversal
        }

        seenNodeIds.add(node.notion_page_id);
        const normalizedNode = normalizeNode(node);
        flatAtlasNodesPerDatabase[node.atlas_database_name].push(normalizedNode);
        return true; // Continue traversal
      },
      'preorder',
    );
  });

  return flatAtlasNodesPerDatabase;
}
