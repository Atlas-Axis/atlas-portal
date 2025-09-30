import { PageObjectResponse, QueryDatabaseResponse } from '@notionhq/client/build/src/api-endpoints';
import { ATLAS_DATABASE_ID_MAP, AtlasDatabaseID, AtlasDatabaseName } from '@/app/server/atlas/constants';
import { NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS } from '@/app/server/atlas/notion-database-properties-and-relationships';
import { NOTION_DATABASE_FILTERS } from '@/app/server/atlas/notion-master-status-filters';
import { hasCachedData, loadCachedDatabasePages, saveCachedDatabasePages } from './local-file-cache';
import { notion } from './notion-client';

const DEBUG_LOGGING = Boolean(Number(process.env.DEBUG_LOGGING));

// Enhanced version of PageObjectResponse with all relationships loaded, even if there are more than in the initial fetch.
export interface EnhancedPageObjectResponse extends PageObjectResponse {
  enhancedRelations: Map<string, string[]>; // propertyName -> array of related page IDs
}

/**
 * Fetches all pages in a Notion database. Fetches relationships for each page, even if there are more than in the initial fetch.
 */
export async function fetchNotionDatabasePagesWithRelationships({
  atlasDatabaseName,
  useLocalCache = false,
}: {
  atlasDatabaseName: AtlasDatabaseName;
  useLocalCache?: boolean;
}): Promise<EnhancedPageObjectResponse[]> {
  const databaseConfig = NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[atlasDatabaseName];
  const notionPageRelationshipPropertyNames = Object.values(databaseConfig.childRelationships);

  // Add parent property name if it exists
  if (databaseConfig.parentPropertyName) {
    notionPageRelationshipPropertyNames.push(databaseConfig.parentPropertyName);
  }

  if (DEBUG_LOGGING) {
    console.log(`Database config for "${atlasDatabaseName}":`, databaseConfig);
    console.log(`Notion property names to check for relationships:`, notionPageRelationshipPropertyNames);
  }

  // Try to load from cache first if enabled
  if (useLocalCache) {
    console.log(`🔍 Checking for cached data for database "${atlasDatabaseName}"...`);
    if (await hasCachedData(atlasDatabaseName)) {
      const cachedPages = await loadCachedDatabasePages(atlasDatabaseName);
      if (cachedPages) {
        return cachedPages;
      }
    } else {
      console.log(`📁 No cached data found for database "${atlasDatabaseName}", will fetch from Notion API`);
    }
  }

  // First, fetch all pages
  const pages = await fetchNotionDatabasePages({ atlasDatabaseName });
  console.log(`Fetched ${pages.length} pages, now loading relationships...`);

  // Process each page to load relationships
  const enhancedPages: EnhancedPageObjectResponse[] = [];
  const enhancedPagesById = new Map<string, EnhancedPageObjectResponse>(); // For efficient lookups
  const needFullPropFetch: { pageId: string; propertyName: string; propertyId: string }[] = [];

  // First pass: read inline relationships and identify which need full fetching
  for (const page of pages) {
    const enhancedRelations = new Map<string, string[]>();

    for (const notionPagePropertyName of notionPageRelationshipPropertyNames) {
      const { relationshipPropertyId, relatedPageIds, isPossiblyTruncated } = readRelatedPagesInline(
        page,
        notionPagePropertyName,
      );

      enhancedRelations.set(notionPagePropertyName, relatedPageIds);

      if (isPossiblyTruncated && relationshipPropertyId) {
        needFullPropFetch.push({
          pageId: page.id,
          propertyName: notionPagePropertyName,
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
    console.log(`📊 ${needFullPropFetch.length} properties need full relationship fetching`);
  }

  // Second pass: fetch full relationships for properties that were truncated
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

  // Save to file cache
  await saveCachedDatabasePages(atlasDatabaseName, enhancedPages);

  return enhancedPages;
}

export async function fetchNotionDatabasePages({
  atlasDatabaseName,
}: {
  atlasDatabaseName: AtlasDatabaseName;
}): Promise<PageObjectResponse[]> {
  const notionDatabaseId: AtlasDatabaseID = ATLAS_DATABASE_ID_MAP[atlasDatabaseName];
  if (DEBUG_LOGGING) {
    console.log(`Starting to fetch all pages from Notion database "${atlasDatabaseName}" (${notionDatabaseId})`);
  }

  const results: PageObjectResponse[] = [];
  let cursor: string | undefined = undefined;
  let pageCount = 0;
  let batchNumber = 1;

  do {
    if (DEBUG_LOGGING) {
      console.log(`  🔄 Fetching batch ${batchNumber} from Notion API...`);
    }
    const response: QueryDatabaseResponse = await notion().databases.query({
      database_id: notionDatabaseId,
      page_size: 100,
      start_cursor: cursor,
      filter: NOTION_DATABASE_FILTERS,
    });

    if (DEBUG_LOGGING) {
      const batchSize = response.results.length;
      console.log(`  📄 Received ${batchSize} Notion pages in batch ${batchNumber}`);
    }

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
      if (DEBUG_LOGGING) {
        console.log(`  ➡️ More Notion pages available, continuing to next batch...`);
      }
    } else {
      if (DEBUG_LOGGING) {
        console.log(`  🏁 Reached end of database - no more Notion pages to fetch`);
      }
    }

    batchNumber++;
  } while (cursor);

  console.log(
    `Completed fetching all Notion pages: ${results.length} total Notion pages from database "${atlasDatabaseName}"`,
  );
  return results;
}

/**
 * Read inline relation values and detect if there's likely more.
 */
function readRelatedPagesInline(
  page: PageObjectResponse,
  propertyName: string,
): { relationshipPropertyId?: string; relatedPageIds: string[]; isPossiblyTruncated: boolean } {
  const notionPageProperties = page.properties ?? {};
  const notionRelationshipProperty = notionPageProperties[propertyName];

  if (!notionRelationshipProperty || notionRelationshipProperty.type !== 'relation') {
    console.warn(`No valid relation property found for "${propertyName}"`, notionRelationshipProperty);
    return { relatedPageIds: [], isPossiblyTruncated: false };
  }

  const relationIds = Array.isArray(notionRelationshipProperty.relation)
    ? notionRelationshipProperty.relation.map((relation) => relation.id)
    : [];

  // Note: `has_more` is not officially documented in the Notion SDK types, but it appears in the API responses.
  const hasMore = (notionRelationshipProperty as unknown & { has_more?: boolean }).has_more;

  // Heuristic: Notion includes `has_more: true` if there are more relations
  const isPossiblyTruncated = hasMore === true;

  return {
    relationshipPropertyId: notionRelationshipProperty.id,
    relatedPageIds: relationIds,
    isPossiblyTruncated,
  };
}

/**
 * Paginate a relation property fully via pages.properties.retrieve for relationships with more items.
 */
async function fetchAllRelationIds(pageId: string, relationPropertyId: string): Promise<string[]> {
  const relationIds: string[] = [];
  let cursor: string | undefined = undefined;
  let isFirstIteration = true;

  do {
    if (isFirstIteration) {
      console.log(`    Fetching more relations for page ${pageId}...`);
      isFirstIteration = false;
    } else {
      console.log(`    Fetching more relations...`);
    }
    const response = await notion().pages.properties.retrieve({
      page_id: pageId,
      property_id: relationPropertyId,
      start_cursor: cursor,
      page_size: 50,
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
