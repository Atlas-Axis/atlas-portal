import { v7 as uuidv7 } from 'uuid';
import { NotionBlock } from '@/app/server/database/notion-block';
import { extractPlainText } from '@/app/server/services/notion/extract-plain-text-from-notion-block';
import { notion } from '@/app/server/services/notion/notion-client';

export interface EditPageProps {
  belongsToEditPage: boolean;
  editPageOriginalNotionBlockId: string;
  editPageOriginalNotionPageId: string;
}

/**
 * Recursively fetch all Notion blocks under a given block ID.
 */
export async function fetchBlocksRecursively({
  notionBlockId,
  parentNotionBlockId = null,
  rootNotionBlockId, // The Notion page id this block belongs to, or the root/top-most block id of a subtree of blocks
  editPage = null,
}: {
  notionBlockId: string;
  parentNotionBlockId?: string | null;
  rootNotionBlockId: string;
  editPage?: EditPageProps | null;
}): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;
  let sortOrder = 0;

  // Fetch all children blocks for the current block ID, paginated
  do {
    const response = await notion().blocks.children.list({
      block_id: notionBlockId,
      start_cursor: cursor,
      page_size: 100,
    });

    const currentBatch: NotionBlock[] = [];

    // Map the response results to NotionBlock database objects
    for (const block of response.results) {
      if (!('type' in block)) continue;

      // Database mapping
      const notionBlock: NotionBlock = {
        // Primary keys and identifiers
        id: uuidv7(),
        notion_block_id: block.id,
        parent_notion_block_id: parentNotionBlockId,
        root_notion_block_id: rootNotionBlockId,

        // Notion block metadata
        block_type: block.type,
        has_children: block.has_children,
        archived: block.archived,
        in_trash: block.in_trash,
        last_edited_by_user_id: block.last_edited_by?.id || null,

        // Content fields
        plain_text_content: extractPlainText(block),
        json_content: (block as Record<string, unknown>)[block.type] as Record<string, unknown>,

        // Ordering
        sort_order: sortOrder++,

        // Atlas document fields
        canonical_document_title: '?', // TODO
        // canonical_document_title: canonicalDocumentTitle,

        // Timestamps
        created_at: new Date(block.created_time),
        updated_at: new Date(block.last_edited_time),

        // Versioning
        // date_valid_from: new Date(block.created_time),
        // date_valid_to: block.last_edited_time ? new Date(block.last_edited_time) : null,

        // Edit Page related fields
        belongs_to_edit_page: editPage?.belongsToEditPage || false,
        edit_page_original_notion_block_id: editPage?.editPageOriginalNotionBlockId || null,
        edit_page_original_notion_page_id: editPage?.editPageOriginalNotionPageId || null,
      };

      currentBatch.push(notionBlock);
    }

    blocks.push(...currentBatch);

    // Fetch children recursively for each block
    const childPromises = currentBatch
      .filter((block) => block.has_children)
      .map((block) =>
        fetchBlocksRecursively({
          notionBlockId: block.notion_block_id,
          parentNotionBlockId: notionBlockId,
          rootNotionBlockId: rootNotionBlockId,
          editPage,
        }),
      );

    if (childPromises.length > 0) {
      const childResults = await Promise.all(childPromises);
      const childBlocks = childResults.flat();
      blocks.push(...childBlocks);
    }

    cursor = response.next_cursor || undefined;
  } while (cursor);

  return blocks;
}
