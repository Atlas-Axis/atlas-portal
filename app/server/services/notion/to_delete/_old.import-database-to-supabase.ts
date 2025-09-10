import type { PageObjectResponse } from '@notionhq/client';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { Json } from '@/app/server/services/supabase/database.types';
import { supabase } from '@/app/server/services/supabase/supabase-client';
import { _delete_loadDatabaseTreeFromSupabase } from '@/app/server/services/supabase/to_delete/_old.load-database-tree-from-supabase';
import { ATLAS_DATABASE_ID_MAP, AtlasDatabaseID, AtlasDatabaseName } from '../../atlas/constants';
import { NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS } from '../../atlas/notion-database-properties-and-relationships';
import { TreeComparisonResult, compareDatabaseTrees } from '../compare-database-trees';
import { acquireSyncLock, releaseSyncLock, verifySyncLock } from '../sync-lock';
import {
  _delete_DatabaseSubItemTree,
  _delete_fetchDatabaseTree as fetchDatabaseTreeFromNotion,
} from './_old.fetch-database-sub-items';

/**
 * Sync all pages from Notion database to Supabase
 */
export async function _delete_importDatabasePagesFromNotionToSupabase({
  atlasDatabaseName,
}: {
  atlasDatabaseName: AtlasDatabaseName;
}) {
  const startTime = performance.now();
  console.log(`🚀 Starting database import from Notion to Supabase`);

  const notionDatabaseId: AtlasDatabaseID = ATLAS_DATABASE_ID_MAP[atlasDatabaseName];

  console.log(`📊 Database: ${atlasDatabaseName}`);

  // Verify that the sync is not already in progress
  console.log(`🔒 Verifying sync lock for database ${notionDatabaseId}...`);
  await verifySyncLock(notionDatabaseId);
  console.log(`✅ Sync lock verified - proceeding with import`);

  try {
    // Update sync status in database
    console.log(`🔄 Acquiring sync lock for database ${notionDatabaseId}...`);
    await acquireSyncLock(notionDatabaseId);
    console.log(`✅ Sync lock acquired successfully`);

    // Load existing tree from Supabase
    console.log(`📥 Loading existing database tree from Supabase...`);
    const supabaseTree = await _delete_loadDatabaseTreeFromSupabase(notionDatabaseId);
    console.log(`✅ Loaded existing tree: ${supabaseTree.pagesById.size} pages found in Supabase`);

    // Fetch all pages from the Notion database with their tree structure
    console.log(`📡 Fetching database tree from Notion API...`);
    // const notionTree = await fetchDatabaseTreeFromNotion(notionDatabaseId, {
    //   subItemsPropertyName: NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[atlasDatabaseName].subItem,
    //   parentPropertyName: NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[atlasDatabaseName].parent,
    // });
    // console.log(`✅ Fetched Notion tree: ${notionTree.pagesById.size} pages found in Notion`);

    // TODO: Remove this debug logging later
    // TODO: Log parent-child relationships in a human-readable way
    // for (const [pageId, subItemIds] of notionTree.pageIdToSubPageIds.entries()) {
    //   console.log(`  - Page ${pageId} has ${subItemIds.length} sub-items: [${subItemIds.join(', ')}]`);
    // }
    // for (const [pageId, parentId] of notionTree.pageIdToParentId.entries()) {
    //   console.log(`  - Page ${pageId} has parent: ${parentId}`);
    // }

    // Convert the tree structure to individual NotionDatabasePage records
    // console.log(`🔄 Converting tree structure to page records...`);
    // const allPagesFromNotion = convertTreeToPageRecords(notionTree, notionDatabaseId);
    // console.log(`✅ Converted ${allPagesFromNotion.length} pages from Notion database ${notionDatabaseId}`);

    // Compare trees to determine what changes need to be made
    console.log(`🔍 Comparing trees to determine what changes need to be made...`);
    // const comparison = compareDatabaseTrees(notionTree, supabaseTree, allPagesFromNotion);

    console.log(`📊 Tree comparison results:`);
    // console.log(`  - New pages: ${comparison.pagesToInsert.length}`);
    // console.log(`  - Updated pages: ${comparison.pagesToUpdate.length}`);
    // console.log(`  - Deleted pages: ${comparison.pagesToDelete.length}`);
    // console.log(`  - Unchanged pages: ${comparison.unchangedPages.length}`);

    // Apply changes in the correct order to maintain referential integrity
    console.log(`🔄 Applying changes to Supabase database...`);
    // await applyTreeChanges(comparison, notionDatabaseId);

    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(`✅ Import completed successfully in ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(2)}s)`);

    const totalChanges =
      // comparison.pagesToInsert.length + comparison.pagesToUpdate.length + comparison.pagesToDelete.length;

      console.log(`📈 Final summary:`);
    console.log(`  - Total changes made: ${totalChanges}`);
    console.log(`  - Execution time: ${(duration / 1000).toFixed(2)}s`);

    await releaseSyncLock({
      notionDatabaseId,
      syncStatus: 'completed',
      syncErrorMessage: null,
      // blocksSyncedCount: totalChanges,
      blocksSyncedCount: 12345,
    });
    console.log(`🔓 Sync lock released successfully`);

    return {
      inserted: [],
      updated: [],
      deleted: [],
      unchanged: [],
    };

    // return {
    //   inserted: comparison.pagesToInsert,
    //   updated: comparison.pagesToUpdate,
    //   deleted: comparison.pagesToDelete,
    //   unchanged: comparison.unchangedPages,
    // };
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Import failed after ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(2)}s):`, error);

    await releaseSyncLock({
      notionDatabaseId,
      syncStatus: 'failed',
      syncErrorMessage: errorMessage,
      blocksSyncedCount: null,
    });

    throw error;
  }
}

/**
 * Apply tree changes in the correct order to maintain referential integrity
 */
async function applyTreeChanges(comparison: TreeComparisonResult, notionDatabaseId: string): Promise<void> {
  // 1. First, delete pages that no longer exist in Notion
  if (comparison.pagesToDelete.length > 0) {
    console.log(`🗑️ Deleting ${comparison.pagesToDelete.length} pages that no longer exist in Notion`);
    await supabase()
      .from('notion_database_pages')
      .delete()
      // .eq('root_notion_database_id', notionDatabaseId)
      .in('notion_page_id', comparison.pagesToDelete)
      .throwOnError();
    console.log(`✓ Deleted ${comparison.pagesToDelete.length} pages`);
  }

  // 2. Insert new pages
  if (comparison.pagesToInsert.length > 0) {
    console.log(`➕ Inserting ${comparison.pagesToInsert.length} new pages`);
    await insertPagesInBatches(comparison.pagesToInsert, false);
    console.log(`✓ Inserted ${comparison.pagesToInsert.length} new pages`);
  }

  // 3. Update existing pages that have changed
  if (comparison.pagesToUpdate.length > 0) {
    console.log(`🔄 Updating ${comparison.pagesToUpdate.length} changed pages`);
    await insertPagesInBatches(comparison.pagesToUpdate, true);
    console.log(`✓ Updated ${comparison.pagesToUpdate.length} pages`);
  }

  if (
    comparison.pagesToInsert.length === 0 &&
    comparison.pagesToUpdate.length === 0 &&
    comparison.pagesToDelete.length === 0
  ) {
    console.log(`✓ No changes needed - all pages are up to date`);
  }
}

/**
 * Insert pages into Supabase in batches to handle large datasets efficiently
 */
async function insertPagesInBatches(
  pages: NotionDatabasePage[],
  useUpsert: boolean = false,
  batchSize: number = 1000,
): Promise<void> {
  const totalPages = pages.length;

  for (let i = 0; i < totalPages; i += batchSize) {
    const batch = pages.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(totalPages / batchSize);

    console.log(
      `  ${useUpsert ? '🔄 Upserting' : '📝 Inserting'} batch ${batchNumber}/${totalBatches} (${batch.length} pages)...`,
    );

    if (useUpsert) {
      await supabase()
        .from('notion_database_pages')
        .upsert(batch, {
          onConflict: 'notion_page_id',
          ignoreDuplicates: false,
        })
        .throwOnError();
    } else {
      await supabase().from('notion_database_pages').insert(batch).throwOnError();
    }

    console.log(`  ✓ Batch ${batchNumber}/${totalBatches} completed successfully`);
  }
}

/**
 * Convert the tree structure from fetchDatabaseTree to individual NotionDatabasePage records
 */
function convertTreeToPageRecords(
  databaseTree: _delete_DatabaseSubItemTree,
  notionDatabaseId: string,
): NotionDatabasePage[] {
  const pages: NotionDatabasePage[] = [];
  const { pagesById, pageIdToParentId, pageIdToSubPageIds } = databaseTree;

  console.log(`  📋 Converting ${pagesById.size} pages from tree structure to database records...`);

  // Build sort order by processing children in their actual order
  const sortOrderMap = new Map<string, number>();

  // Function to assign sort orders recursively
  const assignSortOrders = (parentId: string | null, children: string[]) => {
    children.forEach((childId, index) => {
      sortOrderMap.set(childId, index);
      const grandChildren = pageIdToSubPageIds.get(childId) || [];
      if (grandChildren.length > 0) {
        assignSortOrders(childId, grandChildren);
      }
    });
  };

  // Start with root-level pages (those without parents)
  const rootPages = Array.from(pagesById.keys()).filter((pageId) => !pageIdToParentId.has(pageId));
  console.log(`  🌳 Found ${rootPages.length} root-level pages`);
  assignSortOrders(null, rootPages);

  // Convert each page to NotionDatabasePage format
  console.log(`  🔄 Converting Notion API pages to Supabase format...`);
  for (const [pageId, notionPage] of pagesById.entries()) {
    const parentId = pageIdToParentId.get(pageId) || null;
    const subPageIds = pageIdToSubPageIds.get(pageId) || [];

    // Extract page title - similar to how blocks extract plain text
    const pageTitle = extractPageTitle(
      notionPage,
      NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS['Sections & Primary Docs'].name,
    );
    const content = extractContent(
      notionPage,
      NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS['Sections & Primary Docs'].content,
    );
    const documentIdString = extractDocumentIdString(
      notionPage,
      NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS['Sections & Primary Docs'].atlasFullDocumentTitle,
    );

    const page: NotionDatabasePage = {
      notion_page_id: pageId,
      parent_notion_page_id: parentId,
      plain_text_name: pageTitle.plainText,
      json_name: pageTitle.richText,
      plain_text_content: content.plainText,
      json_content: content.richText,
      atlas_document_type: 'page', // All pages in a database are database pages // TODO: verify
      has_children: subPageIds.length > 0,
      archived: notionPage.archived,
      in_trash: notionPage.in_trash,
      last_edited_by_user_id: notionPage.last_edited_by?.id || null,
      sort_order: sortOrderMap.get(pageId) || 0,
      canonical_document_title: documentIdString,
      created_at: notionPage.created_time,
      updated_at: notionPage.last_edited_time,
    };

    pages.push(page);
  }

  console.log(`  ✅ Successfully converted ${pages.length} pages to database format`);
  return pages;
}

function extractPageTitle(
  page: PageObjectResponse,
  titlePropertyName: string,
): {
  plainText: string | null;
  richText: Json[] | null;
} {
  try {
    const property = page.properties[titlePropertyName];
    if (!property) {
      console.warn(`Property "${titlePropertyName}" not found in page ${page.id}`);
      return { plainText: null, richText: null };
    }

    if ('rich_text' in property && Array.isArray(property.rich_text) && property.rich_text.length > 0) {
      return {
        plainText: property.rich_text.map((text) => text.plain_text).join('') || null,
        richText: property.rich_text,
      };
    }

    if ('formula' in property && property.formula?.type === 'string' && property.formula.string) {
      return {
        plainText: property.formula.string,
        richText: null, // Formula properties don't have rich text formatting
      };
    }

    console.warn(
      `Property "${titlePropertyName}" in page ${page.id} is not a rich_text or formula property or is empty.`,
    );
    return { plainText: null, richText: null };
  } catch (error) {
    console.error(`Error extracting title from page ${page.id}:`, error);
    return { plainText: null, richText: null };
  }
}

function extractContent(
  page: PageObjectResponse,
  contentPropertyName: string,
): {
  plainText: string | null;
  richText: Json[] | null;
} {
  try {
    const property = page.properties[contentPropertyName];
    if (!property) {
      console.warn(`Property "${contentPropertyName}" not found in page ${page.id}`);
      return { plainText: null, richText: null };
    }

    if ('rich_text' in property && Array.isArray(property.rich_text) && property.rich_text.length > 0) {
      return {
        plainText: property.rich_text.map((text) => text.plain_text).join('') || null,
        richText: property.rich_text,
      };
    }

    console.warn(`Property "${contentPropertyName}" in page ${page.id} is not a rich_text property or is empty.`);
    return { plainText: null, richText: null };
  } catch (error) {
    console.error(`Error extracting content from page ${page.id}:`, error);
    return { plainText: null, richText: null };
  }
}

function extractDocumentIdString(page: PageObjectResponse, docNoPropertyName: string): string | null {
  try {
    const docNoProperty = page.properties[docNoPropertyName];
    if (!docNoProperty) {
      console.warn(`Property "${docNoPropertyName}" not found in page ${page.id}`);
      return null;
    }

    if ('title' in docNoProperty && Array.isArray(docNoProperty.title) && docNoProperty.title.length > 0) {
      return docNoProperty.title.map((text) => text.plain_text).join('') || null;
    }

    if ('formula' in docNoProperty && docNoProperty.formula?.type === 'string' && docNoProperty.formula.string) {
      return docNoProperty.formula.string;
    }

    console.warn(`Property "${docNoPropertyName}" in page ${page.id} is not a title property or is empty.`);
    return null;
  } catch (error) {
    console.error(`Error extracting document ID from page ${page.id}:`, error);
    return null;
  }
}
