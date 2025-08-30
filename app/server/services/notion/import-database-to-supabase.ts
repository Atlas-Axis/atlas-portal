import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { Json } from '@/app/server/services/supabase/database.types';
import { supabase } from '@/app/server/services/supabase/supabase-client';
import { NOTION_DATABASE_PROPERTY_NAMES } from './database-property-names';
import { DatabaseSubItemTree, fetchDatabaseTree } from './fetch-database-sub-items';
import { endSyncStatus, startSyncStatus } from './reset-sync-status';
import { verifySyncLock } from './verify-sync-lock';

/**
 * Sync all pages from Notion database to Supabase
 */
export async function importDatabasePagesFromNotionToSupabase({
  notionDatabaseId,
  taskRunId,
}: {
  notionDatabaseId: string;
  taskRunId: string;
}) {
  const startTime = performance.now();
  console.log(`➡️ Importing pages from Notion database to Supabase...`);
  console.log(`Task run ID: ${taskRunId}`);

  // Verify that the sync is not already in progress
  await verifySyncLock(notionDatabaseId);

  try {
    // Update sync status in database
    await startSyncStatus(notionDatabaseId);

    // Fetch all pages from the Notion database with their tree structure
    const databaseTree = await fetchDatabaseTree(notionDatabaseId);

    // Convert the tree structure to individual NotionDatabasePage records
    const pages = convertTreeToPageRecords(databaseTree, notionDatabaseId);

    console.log(`Fetched ${pages.length} pages from Notion database ${notionDatabaseId}`);

    // Delete existing pages in Supabase that are not in the fetched pages. Descendants are cascade deleted automatically
    await supabase
      .from('notion_database_pages')
      .delete()
      .eq('root_notion_database_id', notionDatabaseId)
      .throwOnError();

    console.log(`Deleted existing pages in Supabase for Notion database ${notionDatabaseId}`);

    // Save pages to Supabase database in batches
    await insertPagesInBatches(pages);

    console.log(`Inserted ${pages.length} pages into Supabase for Notion database ${notionDatabaseId}`);

    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(`✅ Import completed successfully in ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(2)}s)`);

    await endSyncStatus({
      notionPageId: notionDatabaseId,
      syncStatus: 'completed',
      syncErrorMessage: null,
      blocksSyncedCount: pages.length,
    });

    return pages;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.error(`❌ Import failed after ${duration.toFixed(2)}ms (${(duration / 1000).toFixed(2)}s):`, error);

    await endSyncStatus({
      notionPageId: notionDatabaseId,
      syncStatus: 'failed',
      syncErrorMessage: JSON.stringify(error),
      blocksSyncedCount: null,
    });

    throw error;
  }
}

/**
 * Insert pages into Supabase in batches to handle large datasets efficiently
 */
async function insertPagesInBatches(pages: NotionDatabasePage[], batchSize: number = 1000): Promise<void> {
  const totalPages = pages.length;

  for (let i = 0; i < totalPages; i += batchSize) {
    const batch = pages.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(totalPages / batchSize);

    console.log(`Inserting batch ${batchNumber}/${totalBatches} (${batch.length} pages)...`);

    await supabase.from('notion_database_pages').insert(batch).throwOnError();

    console.log(`✓ Batch ${batchNumber}/${totalBatches} inserted successfully`);
  }
}

/**
 * Convert the tree structure from fetchDatabaseTree to individual NotionDatabasePage records
 */
function convertTreeToPageRecords(databaseTree: DatabaseSubItemTree, notionDatabaseId: string): NotionDatabasePage[] {
  const pages: NotionDatabasePage[] = [];
  const { pagesById, pageIdToParentId, pageIdToSubPageIds } = databaseTree;

  // Create a map to track sort order for each parent
  const nextOrderNumberByParent = new Map<string | null, number>();

  // Function to get the next sort order for a given parent
  const getNextSortOrder = (parentId: string | null): number => {
    const currentOrder = nextOrderNumberByParent.get(parentId) || 0;
    nextOrderNumberByParent.set(parentId, currentOrder + 1);
    return currentOrder;
  };

  // Convert each page to NotionDatabasePage format
  for (const [pageId, notionPage] of pagesById.entries()) {
    const parentId = pageIdToParentId.get(pageId) || null;
    const subPageIds = pageIdToSubPageIds.get(pageId) || [];

    // Extract page title - similar to how blocks extract plain text
    const pageTitle = extractPageTitle(notionPage, NOTION_DATABASE_PROPERTY_NAMES['Sections & Primary Docs'].name);
    const content = extractContent(notionPage, NOTION_DATABASE_PROPERTY_NAMES['Sections & Primary Docs'].content);
    const documentIdString = extractDocumentIdString(
      notionPage,
      NOTION_DATABASE_PROPERTY_NAMES['Sections & Primary Docs'].docNo,
    );

    const page: NotionDatabasePage = {
      notion_page_id: pageId,
      parent_notion_page_id: parentId,
      root_notion_database_id: notionDatabaseId,
      plain_text_name: pageTitle.plainText,
      json_name: pageTitle.richText,
      plain_text_content: content.plainText,
      json_content: content.richText,
      page_type: 'page', // All pages in a database are database pages // TODO: verify
      has_children: subPageIds.length > 0,
      archived: notionPage.archived,
      in_trash: notionPage.in_trash,
      last_edited_by_user_id: notionPage.last_edited_by?.id || null,
      sort_order: getNextSortOrder(parentId),
      canonical_document_title: documentIdString,
      created_at: notionPage.created_time,
      updated_at: notionPage.last_edited_time,
      belongs_to_edit_page: false, // Default to false, can be updated later for edit pages
      edit_page_original_notion_page_id: null,
      edit_page_original_root_notion_page_id: null,
    };

    pages.push(page);
  }

  return pages;
}

function extractPageTitle(
  page: PageObjectResponse,
  titlePropertyName: string,
): {
  plainText: string | null;
  richText: Json[] | null;
} {
  for (const [propertyName, property] of Object.entries(page.properties)) {
    if (propertyName === titlePropertyName && 'rich_text' in property && property['rich_text'].length > 0) {
      return {
        plainText: property['rich_text'][0]?.plain_text || null,
        richText: property['rich_text'],
      };
    }
    if (propertyName === titlePropertyName && !('rich_text' in property && property['rich_text'].length > 0))
      console.warn(`Property "${propertyName}" is not a rich_text property or is empty.`);
  }
  return {
    plainText: null,
    richText: null,
  };
}

function extractContent(
  page: PageObjectResponse,
  contentPropertyName: string,
): {
  plainText: string | null;
  richText: Json[] | null;
} {
  for (const [propertyName, property] of Object.entries(page.properties)) {
    if (propertyName === contentPropertyName && 'rich_text' in property && property['rich_text'].length > 0) {
      return {
        plainText: property['rich_text'][0]?.plain_text || null,
        richText: property['rich_text'],
      };
    }
    if (propertyName === contentPropertyName && !('rich_text' in property && property['rich_text'].length > 0))
      console.warn(`Property "${propertyName}" is not a rich_text property or is empty.`);
  }
  return {
    plainText: null,
    richText: null,
  };
}

function extractDocumentIdString(page: PageObjectResponse, docNoPropertyName: string): string | null {
  const docNoProperty = page.properties[docNoPropertyName];
  if (docNoProperty && 'title' in docNoProperty && docNoProperty['title'].length > 0) {
    return docNoProperty['title'][0]?.plain_text || null;
  }
  console.warn(`Property "${docNoPropertyName}" is not a title property or is empty.`);
  return null;
}
