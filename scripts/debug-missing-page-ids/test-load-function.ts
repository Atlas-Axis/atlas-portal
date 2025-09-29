import { loadNotionDatabasePagesFromSupabase } from './app/server/services/supabase/load-notion-database-pages-from-supabase';
import { loadEnv } from './scripts/utils/load-env';

loadEnv();

async function testLoadFunction() {
  const targetId = '1b3f2ff0-8d73-8058-a715-efb37089f852';

  console.log('🔍 Testing loadNotionDatabasePagesFromSupabase function directly...');

  const pages = await loadNotionDatabasePagesFromSupabase({
    atlasDatabaseName: 'Sections & Primary Docs',
  });

  console.log(`📊 Function loaded: ${pages.length} pages`);

  const targetPage = pages.find((page) => page.notion_page_id === targetId);

  if (targetPage) {
    console.log('✅ Target page FOUND by function!');
    console.log('  - Title:', targetPage.plain_text_name);
    console.log('  - Document number:', targetPage.atlas_document_number);
  } else {
    console.log('❌ Target page NOT FOUND by function!');

    // Check where A.2.4.8.2.2.3.5.4.2 should be in the sorted order
    const similarPages = pages.filter(
      (page) => page.atlas_document_type === 'Core' && page.atlas_document_number?.startsWith('A.2.4.8.2.2.3.5.'),
    );

    console.log(`📊 Found ${similarPages.length} similar Core pages:`);
    similarPages.forEach((page, i) => {
      console.log(`  ${i + 1}. ${page.atlas_document_number}: ${page.plain_text_name}`);
    });

    // Look for pages around where our target should be
    const A_2_4_8_pages = pages.filter((page) => page.atlas_document_number?.startsWith('A.2.4.8.'));

    console.log(`\nℹ️  Found ${A_2_4_8_pages.length} pages starting with A.2.4.8.`);
    console.log('First 10:');
    A_2_4_8_pages.slice(0, 10).forEach((page, i) => {
      console.log(`  ${i + 1}. ${page.atlas_document_number}: ${page.plain_text_name}`);
    });
  }
}

testLoadFunction().catch(console.error);
