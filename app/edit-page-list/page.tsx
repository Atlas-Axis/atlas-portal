import Link from 'next/link';
import { supabase } from '@/app/server/services/supabase/supabase-client';

export default async function Page() {
  // Load root Notion blocks from Supabase and convert them to links to subpages
  const { data: rootBlocks, error: rootBlocksError } = await supabase()
    .from('notion_blocks')
    .select('notion_block_id, plain_text_content')
    .is('parent_notion_block_id', null);

  if (rootBlocksError) {
    return (
      <p className="text-red-500">Failed to load Notion pages: {rootBlocksError.message || String(rootBlocksError)}</p>
    );
  }
  const rootBlockLinks = rootBlocks.map((block) => (
    <li key={block.notion_block_id}>
      <Link
        href="#"
        // href={`/visualize/blocks/${block.notion_block_id}`}
        className="font-semibold text-indigo-500 hover:underline"
      >
        👉 {block.plain_text_content}
      </Link>
    </li>
  ));

  return (
    <div className="min-h-screen p-6">
      <h2 className="mb-4 text-lg font-semibold">&quot;Edit Pages&quot; in Supabase</h2>
      <ul>{rootBlockLinks}</ul>
    </div>
  );
}
