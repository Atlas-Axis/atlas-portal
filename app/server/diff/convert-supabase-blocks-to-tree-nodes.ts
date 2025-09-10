import { NotionBlock } from '../database/notion-block';
import { TreeNode } from './tree';

// Convert Supabase NotionBlock type to TreeNode type
export function convertSupabaseBlocksToTreeNodes(blocks: NotionBlock[]): TreeNode[] {
  return blocks.map((block) => ({
    id: block.notion_block_id,
    parentId: block.parent_notion_block_id || null,
    type: block.block_type,
    sortOrder: block.sort_order,
    canonicalDocumentTitle: block.canonical_document_title || '',
  }));
}
