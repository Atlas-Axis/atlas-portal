// import { v7 as uuidv7 } from 'uuid';
import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { NotionBlock } from '@/app/server/database/notion-block';
import { extractPlainText } from '@/app/server/services/notion/extract-plain-text-from-notion-block';
import { notion } from '@/app/server/services/notion/notion-client';
import { Json } from '@/app/server/services/supabase/database.types';

export interface EditPageProps {
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
  notionBlockType = '',
  editPage = null, // TODO: document what this means
}: {
  notionBlockId: string;
  parentNotionBlockId?: string | null;
  rootNotionBlockId: string;
  notionBlockType: string; // TODO: Specify accepted values in type definition
  editPage?: EditPageProps | null;
}): Promise<NotionBlock[]> {
  // On first iteration (when parentNotionBlockId is null), verify that notionBlockId matches rootNotionBlockId
  if (parentNotionBlockId === null && notionBlockId !== rootNotionBlockId) {
    throw new Error(
      `First iteration mismatch: notionBlockId "${notionBlockId}" must match rootNotionBlockId "${rootNotionBlockId}" when parentNotionBlockId is null`,
    );
  }

  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;
  let sortOrder = 0;

  // On first iteration, fetch the root block itself
  if (parentNotionBlockId === null) {
    try {
      // TODO: If the root block is a Page, `notion().blocks.retrieve` may not work
      const rootBlockResponse = await notion().blocks.retrieve({
        block_id: rootNotionBlockId,
      });

      if ('type' in rootBlockResponse) {
        const rootBlock = mapNotionApiBlockToDatabaseObject(
          rootBlockResponse as BlockObjectResponse,
          null, // Root block has no parent
          rootNotionBlockId,
          0,
          editPage,
        );

        blocks.push(rootBlock);
      } else console.warn(`Root block response missing 'type' field:`, rootBlockResponse);
    } catch (error) {
      throw new Error(`Failed to fetch root block "${rootNotionBlockId}": ${error}`);
    }
  }

  checkUnhandledBlockType(notionBlockType);

  // Fetch all children blocks for the current block ID, paginated
  do {
    // TODO: Paginate
    const response = await notion().blocks.children.list({
      block_id: notionBlockId,
      start_cursor: cursor,
      page_size: 100,
    });

    const currentBatch: NotionBlock[] = [];

    // Map the response results to NotionBlock database objects
    for (const block of response.results) {
      if (!('type' in block)) {
        console.warn('Skipping block without type field:', block);
        continue;
      }

      // Database mapping
      const notionBlock = mapNotionApiBlockToDatabaseObject(
        block as BlockObjectResponse,
        notionBlockId, // The parent of these children is the current block we're processing
        rootNotionBlockId,
        sortOrder++,
        editPage,
      );

      currentBatch.push(notionBlock);
    }

    blocks.push(...currentBatch);

    // Fetch children recursively for each block
    const childPromises = currentBatch
      .filter((block) => block.has_children)
      .map((block) =>
        fetchBlocksRecursively({
          notionBlockId: block.notion_block_id,
          parentNotionBlockId: notionBlockId, // Use the current block's ID as parent for its children
          rootNotionBlockId: rootNotionBlockId,
          notionBlockType: block.block_type,
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

/**
 * Maps a Notion API block to a NotionBlock database object.
 */
function mapNotionApiBlockToDatabaseObject(
  block: BlockObjectResponse,
  parentNotionBlockId: string | null,
  rootNotionBlockId: string,
  sortOrder: number,
  editPageProps?: EditPageProps | null,
): NotionBlock {
  return {
    // Primary keys and identifiers
    notion_block_id: block.id,
    parent_notion_block_id: parentNotionBlockId,
    root_notion_toggle_block_id: rootNotionBlockId,

    // Notion block metadata
    block_type: block.type,
    has_children: block.has_children,
    archived: block.archived,
    in_trash: block.in_trash,
    last_edited_by_user_id: block.last_edited_by?.id || null,

    // Content fields
    plain_text_content: extractPlainText(block),
    json_content: (block as Record<string, unknown>)[block.type] as Json,

    // Ordering
    sort_order: sortOrder,

    // Atlas document fields
    canonical_document_title: '?', // TODO

    // Timestamps
    created_at: new Date(block.created_time).toISOString(),
    updated_at: new Date(block.last_edited_time).toISOString(),

    // Edit Page related fields
    edit_page_original_notion_page_id: editPageProps?.editPageOriginalNotionPageId || null,
  };
}

function checkUnhandledBlockType(notionBlockType: string) {
  if (
    [
      'child_page',
      'child_database',
      'equation',
      'image',
      'link_preview',
      'embed',
      'video',
      'synced_block',
      'unsupported',
      'pdf',
      'file',
    ].includes(notionBlockType)
  ) {
    console.warn(`Unhandled block type "${notionBlockType}".`);
  }
}
