import { ATLAS_DATABASES } from './app/server/services/atlas/constants';
import { loadAtlasFromSupabase } from './app/server/services/atlas/load-atlas-from-supabase';
import { loadEnv } from './scripts/utils/load-env';

loadEnv();

async function testDirectLoad() {
  const targetId = '1b3f2ff0-8d73-8058-a715-efb37089f852';

  console.log('🔍 Testing loadAtlasFromSupabase directly...');
  const atlasData = await loadAtlasFromSupabase();

  // Check for target page
  const sectionsPages = atlasData[ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS];
  console.log(`📊 Sections & Primary Docs: ${sectionsPages.length} pages`);

  const targetPage = sectionsPages.find((page) => page.notion_page_id === targetId);

  if (targetPage) {
    console.log('✅ Target page FOUND in direct load!');
    console.log('  - Title:', targetPage.plain_text_name);
    console.log('  - Document number:', targetPage.atlas_document_number);
  } else {
    console.log('❌ Target page NOT FOUND in direct load!');

    // Let's check the first few and last few pages to see what's loaded
    console.log('\n📋 First 5 pages:');
    sectionsPages.slice(0, 5).forEach((page, i) => {
      console.log(`  ${i + 1}. ${page.atlas_document_number} - ${page.plain_text_name}`);
    });

    console.log('\n📋 Last 5 pages:');
    sectionsPages.slice(-5).forEach((page, i) => {
      console.log(`  ${sectionsPages.length - 4 + i}. ${page.atlas_document_number} - ${page.plain_text_name}`);
    });

    // Check if any pages have the similar document number range
    const similarPages = sectionsPages.filter(
      (page) => page.atlas_document_type === 'Core' && page.atlas_document_number?.startsWith('A.2.4.8.2.2.3.5.'),
    );

    console.log(`\n📊 Core pages in A.2.4.8.2.2.3.5.* range: ${similarPages.length}`);
    similarPages.forEach((page) => {
      console.log(`  - ${page.atlas_document_number}: ${page.plain_text_name} (${page.notion_page_id})`);
    });
  }
}

testDirectLoad().catch(console.error);
