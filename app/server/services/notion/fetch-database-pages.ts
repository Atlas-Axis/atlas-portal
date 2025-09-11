import { PageObjectResponse, QueryDatabaseResponse } from '@notionhq/client/build/src/api-endpoints';
import { ATLAS_DATABASE_ID_MAP, AtlasDatabaseID, AtlasDatabaseName } from '../atlas/constants';
import { NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS } from '../atlas/notion-database-properties-and-relationships';
import { notion } from './notion-client';

// Enhanced version of PageObjectResponse with all relationships loaded, even if there are more than 25.
export interface EnhancedPageObjectResponse extends PageObjectResponse {
  enhancedRelations: Map<string, string[]>; // propertyName -> array of related page IDs
}

/**
 * Fetches all pages in a Notion database. Fetches relationships for each page, even if there are more than 25.
 */
export async function fetchNotionDatabasePagesWithRelationships({
  atlasDatabaseName,
}: {
  atlasDatabaseName: AtlasDatabaseName;
}): Promise<EnhancedPageObjectResponse[]> {
  const notionDatabaseId: AtlasDatabaseID = ATLAS_DATABASE_ID_MAP[atlasDatabaseName];
  console.log(
    `📡 Starting to fetch all pages with relationships from Notion database "${atlasDatabaseName}" (${notionDatabaseId})`,
  );

  // First, fetch all pages
  const pages = await fetchNotionDatabasePages({ atlasDatabaseName });
  console.log(`📄 Fetched ${pages.length} pages, now loading relationships...`);

  // Process each page to load relationships
  const enhancedPages: EnhancedPageObjectResponse[] = [];
  const enhancedPagesById = new Map<string, EnhancedPageObjectResponse>(); // For efficient lookups
  const needFullPropFetch: { pageId: string; propertyName: string; propertyId: string }[] = [];

  // First pass: read inline relationships and identify which need full fetching (have 25+ relations)
  for (const page of pages) {
    const enhancedRelations = new Map<string, string[]>();

    for (const propertyName of Object.keys(
      NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[atlasDatabaseName].relationships,
    )) {
      const { relationshipPropertyId, relatedPageIds, isPossiblyTruncated } = readRelatedPagesInline(
        page,
        propertyName,
      );

      enhancedRelations.set(propertyName, relatedPageIds);

      if (isPossiblyTruncated && relationshipPropertyId) {
        needFullPropFetch.push({
          pageId: page.id,
          propertyName,
          propertyId: relationshipPropertyId,
        });
      }
    }

    const enhancedPage: EnhancedPageObjectResponse = {
      ...page,
      enhancedRelations,
    };

    enhancedPages.push(enhancedPage);
    enhancedPagesById.set(page.id, enhancedPage); // Store in map for efficient lookups
  }

  if (needFullPropFetch.length > 0) {
    console.log(`📊 ${needFullPropFetch.length} properties need full relationship fetching (had 25+ relations)`);
  }

  // Second pass: fetch full relationships for properties that were truncated (had 25+ relations)
  for (const { pageId, propertyName, propertyId } of needFullPropFetch) {
    const fullRelationIds = await fetchAllRelationIds(pageId, propertyId);

    // Update the enhanced page with full relationship data using efficient Map lookup
    const enhancedPage = enhancedPagesById.get(pageId);
    if (enhancedPage) {
      enhancedPage.enhancedRelations.set(propertyName, fullRelationIds);
    } else {
      console.warn(`⚠️ Could not find enhanced page with ID ${pageId} for relationship update`);
    }
  }

  console.log(
    `✅ Completed fetching all pages with relationships: ${enhancedPages.length} total pages from database "${atlasDatabaseName}"`,
  );

  return enhancedPages;
}

export async function fetchNotionDatabasePages({
  atlasDatabaseName,
}: {
  atlasDatabaseName: AtlasDatabaseName;
}): Promise<PageObjectResponse[]> {
  const notionDatabaseId: AtlasDatabaseID = ATLAS_DATABASE_ID_MAP[atlasDatabaseName];
  // console.log(`📡 Starting to fetch all pages from Notion database "${atlasDatabaseName}" (${notionDatabaseId})`);

  const results: PageObjectResponse[] = [];
  let cursor: string | undefined = undefined;
  let pageCount = 0;
  let batchNumber = 1;

  do {
    // console.log(`  🔄 Fetching batch ${batchNumber} from Notion API...`);
    const response: QueryDatabaseResponse = await notion().databases.query({
      database_id: notionDatabaseId,
      page_size: 100,
      start_cursor: cursor,
      // TODO: add filters/sorts to have a stable order
    });

    // const batchSize = response.results.length;
    // console.log(`  📄 Received ${batchSize} Notion pages in batch ${batchNumber}`);

    // Only keep full PageObjectResponse rows (ignore partials just in case)
    for (const result of response.results) {
      if ('object' in result && result.object === 'page') {
        results.push(result as PageObjectResponse);
        pageCount++;
      } else {
        console.warn(`Ignoring partial result in database query:`, result);
      }
    }

    cursor = response.next_cursor ?? undefined;
    console.log(`  Batch ${batchNumber} processed - Total Notion pages so far: ${pageCount}`);

    if (cursor) {
      // console.log(`  ➡️ More Notion pages available, continuing to next batch...`);
    } else {
      // console.log(`  🏁 Reached end of database - no more Notion pages to fetch`);
    }

    // TODO: Delete
    if (batchNumber >= 3) {
      console.log(`  ⚠️ Stopping after 3 batches for testing purposes - remove this limit in production`);
      break;
    }

    batchNumber++;
  } while (cursor);

  console.log(
    `✅ Completed fetching all Notion pages: ${results.length} total Notion pages from database "${atlasDatabaseName}"`,
  );
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
 * Paginate a relation property fully via pages.properties.retrieve for relationships with more than 25 items.
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
