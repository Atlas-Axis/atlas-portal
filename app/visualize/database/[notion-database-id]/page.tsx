import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { convertSupabaseDatabasePagesToTreeNodes } from '@/app/server/diff/convert-supabase-database-pages-to-tree-nodes';
import { Tree, TreeNode, buildTree } from '@/app/server/diff/tree';
import { loadNotionDatabasePagesFromSupabase } from '@/app/server/services/supabase/load-notion-database-pages-from-supabase';
import ContentTree from '@/app/visualize/database/[notion-database-id]/content-tree';

export default async function Page({ params }: { params: Promise<{ 'notion-database-id': string }> }) {
  const { 'notion-database-id': notionDatabaseId } = await params;

  // Load Notion blocks from Supabase and convert them to tree nodes
  const pages = await loadNotionDatabasePagesFromSupabase(notionDatabaseId);
  const pageIdMap: Map<string, NotionDatabasePage> = new Map(pages.map((page) => [page.notion_page_id, page]));
  const treeNodes: TreeNode[] = convertSupabaseDatabasePagesToTreeNodes(pages);
  // const tree: Tree = buildTree(treeNodes);
  const tree: Tree = buildTree(withRootNode(treeNodes));

  return (
    <div className="p-6">
      <pre className="mb-12 text-xs text-gray-500">{notionDatabaseId}</pre>
      <ContentTree tree={tree} pageIdMap={pageIdMap} />
    </div>
  );
}

function withRootNode(treeNodes: TreeNode[]) {
  if (treeNodes.length === 0) return [];

  const rootNode: TreeNode = {
    id: 'root',
    parentId: null,
    blockType: 'root',
    sortOrder: 0,
    rootNotionPageId: treeNodes[0].rootNotionPageId,
    canonicalDocumentTitle: '',
  };
  treeNodes.push(rootNode);

  // Set parentId of original root nodes to the new root node
  const originalRootNodes = treeNodes.filter((node) => node.parentId === null && node.id !== rootNode.id);
  for (const node of originalRootNodes) {
    node.parentId = rootNode.id;
  }

  return treeNodes;
}
