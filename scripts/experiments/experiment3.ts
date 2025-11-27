/**
 * Dual Relationship Discrepancy Checker
 *
 * This script checks for discrepancies in Notion's dual "Sub-item" relationships.
 * In Notion, parent-child relationships should be symmetric: when a page has a
 * "Parent item" pointing to another page, that parent should have the child in
 * its "Sub-item" array, and vice versa.
 *
 * This script specifically checks for Case A discrepancies:
 * - Pages that have a "Parent item" relationship set
 * - BUT are NOT listed in that parent's "Sub-item" array
 *
 * Output:
 * - Lists each discrepant page with its name and Notion URL
 * - Shows the parent page it points to (name and URL)
 * - Reports total count of discrepancies found
 *
 * Usage:
 *   npx tsx scripts/experiments/experiment3.ts
 */
import { notion } from '@/app/server/services/notion/notion-client';
import { loadEnv } from '../utils/load-env';

const NOTION_DATABASE_ID = '292f2ff08d7380df9acede66fe5a9d89';

interface NotionPage {
  id: string;
  properties: {
    Name?: {
      title: Array<{ plain_text: string }>;
    };
    'Parent item'?: {
      relation: Array<{ id: string }>;
    };
    'Sub-item'?: {
      relation: Array<{ id: string }>;
    };
  };
}

// #!/usr/bin/env node
async function main() {
  // Load environment variables
  loadEnv();

  try {
    console.log(`🚀 Checking dual relationship discrepancies in database ${NOTION_DATABASE_ID}...\n`);

    const startTime = Date.now();

    // Fetch all pages from the database
    const pages: NotionPage[] = [];
    let hasMore = true;
    let startCursor: string | undefined = undefined;

    while (hasMore) {
      const response = await notion().databases.query({
        database_id: NOTION_DATABASE_ID,
        start_cursor: startCursor,
      });

      pages.push(...(response.results as NotionPage[]));
      hasMore = response.has_more;
      startCursor = response.next_cursor ?? undefined;
    }

    console.log(`✅ Fetched ${pages.length} pages from the database\n`);

    // Build a map of page ID -> sub-item IDs
    const subItemMap = new Map<string, Set<string>>();
    for (const page of pages) {
      const subItems = page.properties['Sub-item']?.relation || [];
      subItemMap.set(page.id, new Set(subItems.map((si) => si.id)));
    }

    // Check for discrepancies (Case A: has Parent item but not in parent's Sub-item array)
    const discrepancies: Array<{
      pageId: string;
      pageName: string;
      pageUrl: string;
      parentId: string;
      parentName: string;
      parentUrl: string;
    }> = [];

    for (const page of pages) {
      const parentItems = page.properties['Parent item']?.relation || [];

      if (parentItems.length === 0) continue;

      const pageName = page.properties.Name?.title?.[0]?.plain_text || 'Untitled';
      const pageUrl = `https://notion.so/${page.id.replace(/-/g, '')}`;

      for (const parent of parentItems) {
        const parentSubItems = subItemMap.get(parent.id);

        // Check if this page is NOT in the parent's Sub-item array
        if (!parentSubItems || !parentSubItems.has(page.id)) {
          const parentPage = pages.find((p) => p.id === parent.id);
          const parentName = parentPage?.properties.Name?.title?.[0]?.plain_text || 'Untitled';
          const parentUrl = `https://notion.so/${parent.id.replace(/-/g, '')}`;

          discrepancies.push({
            pageId: page.id,
            pageName,
            pageUrl,
            parentId: parent.id,
            parentName,
            parentUrl,
          });
        }
      }
    }

    // Report results
    if (discrepancies.length === 0) {
      console.log('✅ No dual relationship discrepancies found!');
    } else {
      console.log(`⚠️  Found ${discrepancies.length} dual relationship discrepancy(ies):\n`);

      for (const disc of discrepancies) {
        console.log(`Page: ${disc.pageName}`);
        console.log(`  URL: ${disc.pageUrl}`);
        console.log(`  Has "Parent item" pointing to: ${disc.parentName}`);
        console.log(`    Parent URL: ${disc.parentUrl}`);
        console.log(`  ❌ But parent's "Sub-item" array does NOT include this page\n`);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  Completed in ${duration}s`);
  } catch (error) {
    console.error('\n❌ Error checking relationships:', error);
    process.exit(1);
  }
}

/**
 * Usage:
 * npx tsx scripts/experiments/experiment3.ts
 */
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
