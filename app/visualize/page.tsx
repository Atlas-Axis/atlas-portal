import Link from 'next/link';
import { Divider, Spacer } from '@heroui/react';
import { supabase } from '@/app/server/services/supabase/supabase-client';

export default async function Page() {
  // Load root Notion blocks from Supabase and convert them to links to subpages
  const { data: rootBlocks, error: rootBlocksError } = await supabase
    .from('notion_blocks')
    .select('notion_block_id, plain_text_content')
    .is('parent_notion_block_id', null);

  // Load original root Notion databases from Supabase
  const { data: originalRootDatabasePages, error: rootDatabasesError } = await supabase
    .from('notion_database_pages')
    .select('root_notion_database_id')
    .is('parent_notion_page_id', null)
    .eq('belongs_to_edit_page', false);
  const databaseIds = [...new Set((originalRootDatabasePages ?? []).map((r) => r.root_notion_database_id))];

  // Load duplicated root Notion databases from Supabase
  const { data: duplicatedRootDatabasePages, error: duplicatedRootDatabasesError } = await supabase
    .from('notion_database_pages')
    .select('root_notion_database_id')
    .is('parent_notion_page_id', null)
    .eq('belongs_to_edit_page', true);
  const duplicatedDatabaseIds = [...new Set((duplicatedRootDatabasePages ?? []).map((r) => r.root_notion_database_id))];

  if (rootBlocksError) {
    return (
      <p className="text-red-500">Failed to load Notion pages: {rootBlocksError.message || String(rootBlocksError)}</p>
    );
  }
  if (rootDatabasesError) {
    return (
      <p className="text-red-500">
        Failed to load Notion databases: {rootDatabasesError.message || String(rootDatabasesError)}
      </p>
    );
  }

  const rootBlockLinks = rootBlocks.map((block) => (
    <li key={block.notion_block_id}>
      <Link
        href={`/visualize/blocks/${block.notion_block_id}`}
        className="font-semibold text-indigo-500 hover:underline"
      >
        👉 {block.plain_text_content}
      </Link>
    </li>
  ));

  const rootDatabasePageLinks = databaseIds.map((db) => (
    <li key={db}>
      <Link href={`/visualize/database/${db}`} className="font-semibold text-indigo-500 hover:underline">
        👉 {db}
      </Link>
    </li>
  ));

  const duplicatedDatabaseLinks = duplicatedDatabaseIds.map((db) => (
    <li key={db}>
      <Link href={`/visualize/database/${db}`} className="font-semibold text-indigo-500 hover:underline">
        👉 {db}
      </Link>
    </li>
  ));

  return (
    <div className="p-6">
      <h2 className="mb-4 text-lg font-semibold">Notion Pages in Supabase</h2>
      <ul>{rootBlockLinks}</ul>

      <Spacer y={9} />
      <Divider />
      <Spacer y={9} />

      <h2 className="mb-4 text-lg font-semibold">Notion Databases in Supabase (Original)</h2>
      <ul>{rootDatabasePageLinks}</ul>

      <Spacer y={9} />
      <Divider />
      <Spacer y={9} />

      <h2 className="mb-4 text-lg font-semibold">Notion Databases in Supabase (Duplicated)</h2>
      <ul>{duplicatedDatabaseLinks}</ul>
    </div>
  );
}
