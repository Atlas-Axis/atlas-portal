import Link from 'next/link';
import ContentTree from '@/app/edit-page-list/[notion-page-id]/content-tree';
import { NotionBlock } from '@/app/server/database/notion-block';
import { convertSupabaseBlocksToTreeNodes } from '@/app/server/diff/convert-supabase-blocks-to-tree-nodes';
import { Tree, TreeNode, buildTree } from '@/app/server/diff/tree';
import { loadNotionBlocksFromSupabase } from '@/app/server/services/supabase/load-notion-blocks-from-supabase';

export default async function Page({ params }: { params: Promise<{ 'notion-page-id': string }> }) {
  const { 'notion-page-id': notionPageId } = await params;

  // Load Notion blocks from Supabase and convert them to tree nodes
  const blocks = await loadNotionBlocksFromSupabase(notionPageId);
  const blockIdMap: Map<string, NotionBlock> = new Map(blocks.map((block) => [block.notion_block_id, block]));
  const treeNodes: TreeNode[] = convertSupabaseBlocksToTreeNodes(blocks);
  const tree: Tree = buildTree(treeNodes);

  return (
    <div>
      <Link href="#" className="mb-4 inline-block text-indigo-500 hover:underline">
        {/* <Link href="/visualize" className="mb-4 inline-block text-indigo-500 hover:underline"> */}← Back to overview
      </Link>
      <ContentTree tree={tree} blockIdMap={blockIdMap} />
    </div>
  );
}
