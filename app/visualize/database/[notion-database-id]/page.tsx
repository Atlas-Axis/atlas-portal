import Link from 'next/link';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { convertSupabaseDatabasePagesToTreeNodes } from '@/app/server/diff/to_delete/convert-supabase-database-pages-to-tree-nodes-old';
import { Tree, TreeNode, buildTree } from '@/app/server/diff/tree';
import { withRootNode } from '@/app/server/diff/with-root-node';
import { ATLAS_DATABASE_ID_MAP_REVERSED, AtlasDatabaseName } from '@/app/server/services/atlas/constants';
import { loadNotionDatabasePagesFromSupabase } from '@/app/server/services/supabase/load-notion-database-pages-from-supabase';
import ContentTree from '@/app/visualize/database/[notion-database-id]/content-tree';

export default async function Page({ params }: { params: Promise<{ 'notion-database-id': string }> }) {
  const { 'notion-database-id': notionDatabaseId } = await params;

  // Find the database name from the ID by looking it up in the ATLAS_DATABASE_ID_MAP (need to reverse the map)
  const atlasDatabaseName: AtlasDatabaseName | undefined = ATLAS_DATABASE_ID_MAP_REVERSED[notionDatabaseId];

  // Load Notion blocks from Supabase and convert them to tree nodes
  const pages = await loadNotionDatabasePagesFromSupabase({ atlasDatabaseName });
  const pageIdMap: Map<string, NotionDatabasePage> = new Map(pages.map((page) => [page.notion_page_id, page]));
  const treeNodes: TreeNode[] = convertSupabaseDatabasePagesToTreeNodes(pages);
  // const tree: Tree = buildTree(treeNodes);
  const tree: Tree = buildTree(withRootNode(treeNodes));

  return (
    <div className="p-6">
      <Link href="/visualize" className="mb-4 inline-block text-indigo-500 hover:underline">
        ← Back to overview
      </Link>
      <ContentTree tree={tree} pageIdMap={pageIdMap} atlasDatabaseName={atlasDatabaseName} />
    </div>
  );
}
