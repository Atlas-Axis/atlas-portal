import { NotionBlock } from '@/app/server/database/notion-block';
import { convertSupabaseBlocksToTreeNodes } from '@/app/server/services/diff/convert-supabase-blocks-to-tree-nodes';
import { Tree, TreeNode, buildTree } from '@/app/server/services/diff/tree';
import { loadNotionBlocksFromSupabase } from '@/app/server/services/supabase/load-notion-blocks-from-supabase';
import ContentTree from '@/app/visualize/block/[notion-page-id]/content-tree';

export default async function Page({ params }: { params: Promise<{ 'notion-page-id': string }> }) {
  const { 'notion-page-id': notionPageId } = await params;

  // Load Notion blocks from Supabase and convert them to tree nodes
  const blocks = await loadNotionBlocksFromSupabase(notionPageId);
  const blockIdMap: Map<string, NotionBlock> = new Map(blocks.map((block) => [block.notion_block_id, block]));
  const treeNodes: TreeNode[] = convertSupabaseBlocksToTreeNodes(blocks);
  const tree: Tree = buildTree(treeNodes);

  return (
    <div>
      <pre className="mb-12 text-xs text-gray-500">{notionPageId}</pre>
      <ContentTree tree={tree} blockIdMap={blockIdMap} />
    </div>
  );
}
