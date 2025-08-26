import { supabase } from '@/app/server/services/supabase/supabase-client';
import { NotionBlock } from '../../database/notion-block';

export async function loadNotionBlocksFromSupabase(rootNotionBlockId: string) {
  const allBlocks: NotionBlock[] = [];
  let page = 0;
  const pageSize = 1000;

  // Load all blocks from Supabase with pagination
  while (true) {
    const { data, error } = await supabase
      .from('notion_blocks')
      .select('*')
      .eq('root_notion_block_id', rootNotionBlockId)
      .eq('archived', false)
      .order('sort_order') // Sort by sort_order
      //   .order('sort_order, id') // Sort by sort_order and ID
      .range(page * pageSize, (page + 1) * pageSize - 1);

    // Check for errors
    if (error) throw new Error(`Failed to load blocks (page ${page}): ${error.message}`);
    if (!data || data.length === 0) break;

    // Add the loaded blocks to the allBlocks array
    allBlocks.push(...data);

    // If we got less than pageSize, we've reached the end
    if (data.length < pageSize) break;

    page++;
  }

  console.log(`Loaded ${allBlocks.length} blocks from Supabase`);
  return allBlocks;
}
