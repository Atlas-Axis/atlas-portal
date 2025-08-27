import Link from 'next/link';
import { supabase } from '@/app/server/services/supabase/supabase-client';

export default async function Page() {
  // Load root Notion block ids from Supabase and convert them to links to subpages
  const { data: rootBlocks, error } = await supabase
    .from('notion_blocks')
    .select('notion_block_id, plain_text_content')
    .is('parent_notion_block_id', null);

  if (error) {
    return <p className="text-red-500">Failed to load Notion pages: {error.message || String(error)}</p>;
  }

  const rootBlockLinks = rootBlocks.map((block) => (
    <Link
      key={block.notion_block_id}
      href={`/visualize/${block.notion_block_id}`}
      className="font-semibold text-indigo-500 hover:underline"
    >
      👉 {block.plain_text_content}
    </Link>
  ));

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Notion Pages in Supabase</h2>
      {rootBlockLinks}
    </div>
  );
}
