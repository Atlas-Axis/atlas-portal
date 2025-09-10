import { QueryDatabaseResponse } from '@notionhq/client/build/src/api-endpoints';
import { notion } from './notion-client';

export async function getDatabasePageCount(databaseId: string): Promise<number> {
  console.log(`📊 Starting to count pages in Notion database ${databaseId}...`);
  let cursor: string | undefined = undefined;
  let totalCount = 0;
  let batchNumber = 1;

  do {
    const response: QueryDatabaseResponse = await notion().databases.query({
      database_id: databaseId,
      page_size: 100,
      start_cursor: cursor,
    });

    // Count only full PageObjectResponse rows (ignore partials just in case)
    for (const result of response.results) {
      if ('object' in result && result.object === 'page') {
        totalCount++;
      }
    }

    cursor = response.next_cursor ?? undefined;
    console.log(`  Batch ${batchNumber} processed - Total page count so far: ${totalCount}`);

    if (!cursor) {
      console.log(`  🏁 Reached end of database - final count complete`);
    }

    batchNumber++;
  } while (cursor);

  console.log(`✅ Completed counting Notion pages: ${totalCount} total pages in database ${databaseId}`);
  return totalCount;
}
