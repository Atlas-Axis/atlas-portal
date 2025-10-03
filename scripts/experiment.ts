import { ATLAS_DATABASE_ID_MAP, AtlasDatabaseName } from '@/app/server/atlas/constants';
import { NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS } from '@/app/server/atlas/notion-database-properties-and-relationships';
import { notion } from '@/app/server/services/notion/notion-client';
import { loadEnv } from './utils/load-env';

async function loadDatabaseEntriesWithEmptyMasterStatus() {
  console.log('Fetching database entries with empty Master Status...');

  // Loop over all Notion databases in ATLAS_DATABASE_ID_MAP
  for (const [atlasDatabaseName, notionDatabaseId] of Object.entries(ATLAS_DATABASE_ID_MAP)) {
    console.log(`\nDatabase: ${atlasDatabaseName} (${notionDatabaseId})`);
    await fetchEntriesWithEmptyMasterStatus(notionDatabaseId);
  }
}

/**
 * Fetches and logs all pages in a Notion database where the "Master Status" property is empty.
 * @param notionDatabaseId - The ID of the Notion database to query.
 */
async function fetchEntriesWithEmptyMasterStatus(notionDatabaseId: string) {
  // Find the atlas database name for this ID
  const atlasDatabaseName = Object.entries(ATLAS_DATABASE_ID_MAP).find(
    ([, id]) => id.replace(/[-]/g, '') === notionDatabaseId.replace(/[-]/g, ''),
  )?.[0] as AtlasDatabaseName | undefined;

  // Build filter conditions - use any type for flexibility with Notion API
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filterConditions: any[] = [
    {
      property: 'Master Status',
      relation: {
        is_empty: true,
      },
    },
  ];

  const response = await notion().databases.query({
    database_id: notionDatabaseId,
    page_size: 100,
    filter: {
      and: filterConditions,
    },
  });

  const prefix = response.results.length === 0 ? '' : '👉👉👉';
  console.log(`${prefix} Fetched ${response.results.length} entries with empty Master Status.`);
  for (const page of response.results) {
    console.log(`- Page ID: ${page.id}`);
  }
}

// #!/usr/bin/env node
async function main() {
  const startTime = Date.now();

  // Load environment variables
  loadEnv();

  try {
    await loadDatabaseEntriesWithEmptyMasterStatus();

    // Log processing time
    const endTime = Date.now();
    const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`⏰ Processing time: ${durationSeconds} seconds`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

/**
 * Usage:
 * npx tsx scripts/experiment.ts
 */
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
