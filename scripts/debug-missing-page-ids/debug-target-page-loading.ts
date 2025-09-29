import { ATLAS_DATABASES } from './app/server/services/atlas/constants';
import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from './app/server/services/atlas/load-atlas-from-supabase';
import { loadEnv } from './scripts/utils/load-env';

loadEnv();

async function findTargetPage() {
  const targetId = '1b3f2ff0-8d73-8058-a715-efb37089f852';

  console.log('🔍 Loading Atlas data from Supabase...');
  const atlasData = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();

  // Check all databases for the target page
  let found = false;

  for (const [dbName, pages] of Object.entries(atlasData)) {
    const targetPage = pages.find((page) => page.notion_page_id === targetId);

    if (targetPage) {
      console.log(`✅ Found target page in "${dbName}" database:`);
      console.log('  - ID:', targetPage.notion_page_id);
      console.log('  - Title:', targetPage.plain_text_name);
      console.log('  - Document type:', targetPage.atlas_document_type);
      console.log('  - Document number:', targetPage.atlas_document_number);
      console.log('  - Archived:', targetPage.archived);
      console.log('  - In trash:', targetPage.in_trash);
      found = true;
    } else {
      console.log(`❌ Target page NOT found in "${dbName}" (${pages.length} pages)`);
    }
  }

  if (!found) {
    console.log('\n❌ Target page not found in ANY loaded database!');
  }

  // Also check the Sections & Primary Docs database specifically
  const sectionsPages = atlasData[ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS];
  console.log(`\n📊 Sections & Primary Docs database stats:`);
  console.log(`  - Total pages: ${sectionsPages.length}`);

  // Check for any Core documents in the range A.2.4.8.2.2.3.5.*
  const relatedCorePages = sectionsPages.filter(
    (page) => page.atlas_document_type === 'Core' && page.atlas_document_number?.startsWith('A.2.4.8.2.2.3.5.'),
  );

  console.log(`  - Core pages in A.2.4.8.2.2.3.5.* range: ${relatedCorePages.length}`);
  relatedCorePages.forEach((page) => {
    console.log(`    - ${page.atlas_document_number}: ${page.plain_text_name} (ID: ${page.notion_page_id})`);
  });
}

findTargetPage().catch(console.error);
