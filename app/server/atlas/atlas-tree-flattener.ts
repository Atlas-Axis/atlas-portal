import { traverseTree } from './atlas-tree-traversal';
import { AtlasTreeNode } from './atlas-tree-types';
import { AtlasDatabaseName } from './atlas-types';

const ALLOWED_DUPLICATE_TYPES = ['Needed Research'];

export function flattenAtlasScopeTreesToNodesPerDatabase({
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

  // Keep track of seen nodes to prevent duplicates for most types
  const seenNodeIds = new Set<string>();

  // Traverse each scope tree and flatten all nodes by database
  scopeTrees.forEach((scopeTree) => {
    traverseTree(
      scopeTree,
      (node) => {
        const allowDuplicatesForType = ALLOWED_DUPLICATE_TYPES.includes(node.atlas_document_type);

        // Skip if we've already processed this node (except allowed duplicate types)
        if (seenNodeIds.has(node.notion_page_id) && !allowDuplicatesForType) {
          console.warn(
            `[flattenAtlasScopeTreesToNotionPages] Duplicate node detected: ${node.notion_page_id} - ${node.canonical_document_title || node.plain_text_name}. Skipping duplicate occurrence.`,
          );
          return true; // Skip adding this duplicate to output, but continue traversal
        }

        // Log kept Needed Research duplicates
        if (seenNodeIds.has(node.notion_page_id) && allowDuplicatesForType) {
          console.info(
            `[flattenAtlasScopeTreesToNotionPages] Duplicate 'Needed Research' document kept: ${node.notion_page_id} - ${node.canonical_document_title || node.plain_text_name}`,
          );
        }

        if (!seenNodeIds.has(node.notion_page_id)) {
          seenNodeIds.add(node.notion_page_id);
        }

        const normalizedNode = normalizeNode(node);
        flatAtlasNodesPerDatabase[node.atlas_database_name].push(normalizedNode);
        return true; // Continue traversal
      },
      'preorder',
    );
  });

  return flatAtlasNodesPerDatabase;
}
