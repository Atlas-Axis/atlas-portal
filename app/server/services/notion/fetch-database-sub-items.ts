import type { PageObjectResponse, QueryDatabaseResponse } from '@notionhq/client/build/src/api-endpoints';
import { notion } from '@/app/server/services/notion/notion-client';
import { SUB_ITEM_PROPERTY_NAME } from './database-property-names';

export interface DatabaseSubItemTreeNode {
  id: string;
  subItems: string[];
}

export interface DatabaseSubItemTree {
  pagesById: Map<string, PageObjectResponse>;
  pageIdToSubPageIds: Map<string, string[]>;
  pageIdToParentId: Map<string, string | null>;
  roots: string[]; // pages with no parent
}

export type FetchTreeOptions = {
  subItemsPropertyName?: string; // name or property_id of the "Sub-items" relation
  parentPropertyName?: string; // optional inverse relation ("Parent"); speeds up parent detection if present
};

export async function fetchDatabaseTree(
  databaseId: string,
  options: FetchTreeOptions = {},
): Promise<DatabaseSubItemTree> {
  const {
    subItemsPropertyName = SUB_ITEM_PROPERTY_NAME,
    parentPropertyName = 'Parent', // TODO: Check if this is reliable and correct; Sub items may not have a parent relationship. Verify!
  } = options;

  // 1) Pull ALL pages in the database
  const allPages = await fetchAllDatabasePages(databaseId);

  console.log(`Fetched ${allPages.length} pages from database ${databaseId}`);
  // console.log({ allPages: allPages.map((page) => ({ ...page, properties: JSON.stringify(page.properties) })) });

  // 2) Build id->page map and read inline relation snippets (up to 25) cheaply
  const pagesById = new Map<string, PageObjectResponse>();
  for (const page of allPages) pagesById.set(page.id, page);

  const pageIdToSubItemIdsInline = new Map<string, string[]>(); // id -> (up to 25) children
  const needFullPropFetch: { pageId: string; propertyId: string }[] = []; // List of page ids needing full property list fetch, where there are >=25 properties

  // Resolve the actual property_id for Sub-items once (per page type-safe way)
  for (const page of allPages) {
    const {
      relationshipPropertyId: subItemsPropertyId,
      relatedPageIds: subItemPageIds,
      isPossiblyTruncated,
    } = readRelatedPagesInline(page, subItemsPropertyName);
    pageIdToSubItemIdsInline.set(page.id, subItemPageIds);
    if (isPossiblyTruncated && subItemsPropertyId) {
      needFullPropFetch.push({ pageId: page.id, propertyId: subItemsPropertyId });
    }
  }

  // 3) For the few heavy parents (exactly 25 sub-items loaded (max per page)), paginate the relation fully
  const pageIdToSubItemIdsFull = new Map<string, string[]>(); // id -> full children
  for (const { pageId, propertyId: subItemsPropertyId } of needFullPropFetch) {
    const fullIds = await fetchAllRelationIds(pageId, subItemsPropertyId);
    pageIdToSubItemIdsFull.set(pageId, fullIds);
  }

  // 4) Combine inline+full sub item id lists into children map
  const pageIdToSubPageIds = new Map<string, string[]>();
  for (const page of allPages) {
    const fullSubItemIdList = pageIdToSubItemIdsFull.get(page.id);
    const inlineSubItemIdList = pageIdToSubItemIdsInline.get(page.id) ?? [];
    pageIdToSubPageIds.set(page.id, fullSubItemIdList ?? inlineSubItemIdList);
  }

  // 5) Build parent map cheaply:
  //    (A) If an explicit "Parent" relation exists, use its inline values (same trick: only paginate when 25)
  //    (B) Otherwise infer by reverse lookup of childrenById
  const pageIdToParentId = new Map<string, string | null>(); // TODO: Check if this is reliable and correct; Sub items may not have a parent relationship. Verify!
  for (const page of allPages) pageIdToParentId.set(page.id, null); // initialize map

  // Try to use explicit Parent relation if present
  // TODO: Check if this is reliable and correct; Sub items may not have a parent relationship. Verify!
  let parentPropertyExists = false;
  if (allPages[0]) {
    const propMeta = allPages[0].properties?.[parentPropertyName];
    parentPropertyExists = !!propMeta && propMeta.type === 'relation';
  }

  console.log(`Parent property "${parentPropertyName}" exists: ${parentPropertyExists}`);

  if (parentPropertyExists) {
    console.log(`Using Parent property "${parentPropertyName}"`);
    const needFullParentFetch: { pageId: string; propertyId: string }[] = [];
    for (const page of allPages) {
      const {
        relationshipPropertyId: parentPropertyId,
        relatedPageIds: parentPageIds,
        isPossiblyTruncated,
      } = readRelatedPagesInline(page, parentPropertyName);
      // Usually Parent has 0..1 link; if there are >1, we'll still take the first (common pattern)
      if (parentPageIds.length) pageIdToParentId.set(page.id, parentPageIds[0]);
      if (parentPageIds.length > 1) console.warn(`Page ${page.id} has multiple Parents: ${parentPageIds.join(', ')}`);
      if (isPossiblyTruncated && parentPropertyId) {
        needFullParentFetch.push({ pageId: page.id, propertyId: parentPropertyId });
      }
    }
    // Rare: paginate Parent if overflowed
    for (const { pageId, propertyId } of needFullParentFetch) {
      const fullParentPageIds = await fetchAllRelationIds(pageId, propertyId);
      const parentId = fullParentPageIds[0] ?? null;
      pageIdToParentId.set(pageId, parentId);
      console.warn(`Page ${pageId} has many Parents: ${fullParentPageIds.join(', ')}`);
    }
  } else {
    console.log(`No Parent property found, inferring parents from children`);
    // Infer parent by reversing children
    // TODO: If Parent property doesn't exist, this may be all the code I need
    for (const [parentId, subPageIds] of pageIdToSubPageIds.entries()) {
      for (const childId of subPageIds) pageIdToParentId.set(childId, parentId);
    }
  }

  // 6) Compute roots (pages with no parent)
  const roots: string[] = [];
  for (const [id, parent] of pageIdToParentId.entries()) {
    if (!parent) roots.push(id);
  }

  console.log(`Computed ${roots.length} root pages (no parent)`);

  return { pagesById, pageIdToSubPageIds, pageIdToParentId, roots };
}

async function fetchAllDatabasePages(databaseId: string): Promise<PageObjectResponse[]> {
  console.log(`📡 Starting to fetch all pages from Notion database ${databaseId}...`);
  const results: PageObjectResponse[] = [];
  let cursor: string | undefined = undefined;
  let pageCount = 0;
  let batchNumber = 1;

  do {
    console.log(`  🔄 Fetching batch ${batchNumber} from Notion API...`);
    const response: QueryDatabaseResponse = await notion().databases.query({
      database_id: databaseId,
      page_size: 100,
      start_cursor: cursor,
      // TODO: add filters/sorts to have a stable order
    });

    const batchSize = response.results.length;
    console.log(`  📄 Received ${batchSize} pages in batch ${batchNumber}`);

    // Only keep full PageObjectResponse rows (ignore partials just in case)
    for (const result of response.results) {
      if ('object' in result && result.object === 'page') {
        results.push(result as PageObjectResponse);
        pageCount++;
      } else console.warn(`Ignoring partial result in database query:`, result);
    }

    cursor = response.next_cursor ?? undefined;
    console.log(`  ✅ Batch ${batchNumber} processed - Total pages so far: ${pageCount}`);

    if (cursor) {
      console.log(`  ➡️ More pages available, continuing to next batch...`);
    } else {
      console.log(`  🏁 Reached end of database - no more pages to fetch`);
    }

    batchNumber++;
  } while (cursor);

  console.log(`✅ Completed fetching all pages: ${results.length} total pages from database ${databaseId}`);
  return results;
}

/**
 * Read inline relation values (up to 25) and detect if there's likely more.
 */
function readRelatedPagesInline(
  page: PageObjectResponse,
  propertyName: string,
): { relationshipPropertyId?: string; relatedPageIds: string[]; isPossiblyTruncated: boolean } {
  const properties = page.properties ?? {};
  const relationshipProperty = properties[propertyName];

  if (!relationshipProperty || relationshipProperty.type !== 'relation') {
    console.warn(`No valid relation property found for "${propertyName}"`);
    return { relatedPageIds: [], isPossiblyTruncated: false };
  }

  const relationIds = Array.isArray(relationshipProperty.relation)
    ? relationshipProperty.relation.map((relation) => relation.id)
    : [];

  // Heuristic: Notion includes max 25 inline. If exactly 25, there might be more.
  const isPossiblyTruncated = relationIds.length === 25;

  return { relationshipPropertyId: relationshipProperty.id, relatedPageIds: relationIds, isPossiblyTruncated };
}

/**
 * Paginate a relation property fully via pages.properties.retrieve.
 */
async function fetchAllRelationIds(pageId: string, relationPropertyId: string): Promise<string[]> {
  const relationIds: string[] = [];
  let cursor: string | undefined = undefined;

  do {
    const response = await notion().pages.properties.retrieve({
      page_id: pageId,
      property_id: relationPropertyId,
      start_cursor: cursor,
      page_size: 100,
    });

    if (response.object === 'list' && Array.isArray(response.results)) {
      for (const item of response.results) {
        if (item.type === 'relation' && item.relation?.id) {
          relationIds.push(item.relation.id);
        }
      }
      cursor = response.next_cursor ?? undefined;
    } else {
      cursor = undefined;
    }
  } while (cursor);

  return relationIds;
}
