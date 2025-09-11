import Link from 'next/link';
import { Divider, Spacer } from '@heroui/react';
import { supabase } from '@/app/server/services/supabase/supabase-client';
import { ATLAS_DATABASE_ID_MAP } from '../server/services/atlas/constants';

export default async function Page() {
  // Load root Notion blocks from Supabase and convert them to links to subpages
  const { data: rootBlocks, error: rootBlocksError } = await supabase()
    .from('notion_blocks')
    .select('notion_block_id, plain_text_content')
    .is('parent_notion_block_id', null);

  // Load Notion database names from Supabase
  const { data: databaseNames, error: databaseNameError } = await supabase()
    .from('notion_database_pages')
    .select('atlas_database_name, notion_page_id.count()');
  // .is('parent_notion_page_id', null);
  // const databaseIds = [...new Set((databasePages ?? []).map((r) => r.root_notion_database_id))];

  console.log('Database names:', databaseNames);

  if (rootBlocksError) {
    return (
      <p className="text-red-500">Failed to load Notion pages: {rootBlocksError.message || String(rootBlocksError)}</p>
    );
  }
  if (databaseNameError) {
    return (
      <p className="text-red-500">
        Failed to load Notion databases: {databaseNameError.message || String(databaseNameError)}
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

  const rootDatabasePageLinks = databaseNames.map((db) => (
    <li key={db.atlas_database_name}>
      <Link
        href={`/visualize/database/${ATLAS_DATABASE_ID_MAP[db.atlas_database_name]}`}
        className="font-semibold text-indigo-500 hover:underline"
      >
        👉 {db.atlas_database_name} ({db.count})
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
    </div>
  );
}
