import { supabase } from './app/server/services/supabase/supabase-client';
import { loadEnv } from './scripts/utils/load-env';

loadEnv();

async function debugSupabaseQuery() {
  const targetId = '1b3f2ff0-8d73-8058-a715-efb37089f852';

  console.log('🔍 Testing Supabase query with exact same filters as loadNotionDatabasePagesFromSupabase...');

  // This is the exact same query that loadNotionDatabasePagesFromSupabase uses for "Sections & Primary Docs"
  const { data, error } = await supabase()
    .from('notion_database_pages')
    .select('*')
    .is('date_valid_to', null)
    .eq('archived', false)
    .eq('in_trash', false)
    .eq('atlas_database_name', 'Sections & Primary Docs')
    .order('sort_order')
    .order('canonical_document_title');

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`✅ Query returned ${data.length} total pages`);

  // Look for our target page
  const targetPage = data.find((page) => page.notion_page_id === targetId);

  if (targetPage) {
    console.log('✅ Found target page in query results:');
    console.log('  - ID:', targetPage.notion_page_id);
    console.log('  - Title:', targetPage.plain_text_name);
    console.log('  - Document number:', targetPage.atlas_document_number);
    console.log('  - Archived:', targetPage.archived);
    console.log('  - In trash:', targetPage.in_trash);
    console.log('  - Date valid to:', targetPage.date_valid_to);
    console.log('  - Database name:', targetPage.atlas_database_name);
  } else {
    console.log('❌ Target page NOT found in query results!');

    // Let's check for pages with similar document numbers
    const similarPages = data.filter(
      (page) => page.atlas_document_type === 'Core' && page.atlas_document_number?.startsWith('A.2.4.8.2.2.3.5.4'),
    );

    console.log(`\n📊 Found ${similarPages.length} Core pages with similar document numbers:`);
    similarPages.forEach((page) => {
      console.log(`  - ${page.atlas_document_number}: ${page.plain_text_name} (${page.notion_page_id})`);
    });
  }

  // Also do a direct query for just our target page to double-check
  console.log('\n🔍 Direct query for target UUID...');
  const { data: directData, error: directError } = await supabase()
    .from('notion_database_pages')
    .select('*')
    .eq('notion_page_id', targetId)
    .is('date_valid_to', null);

  if (directError) {
    console.error('❌ Direct query error:', directError);
    return;
  }

  if (directData && directData.length > 0) {
    const page = directData[0];
    console.log('✅ Direct query found the page:');
    console.log('  - Database name:', page.atlas_database_name);
    console.log('  - Archived:', page.archived);
    console.log('  - In trash:', page.in_trash);
    console.log('  - Date valid to:', page.date_valid_to);
  } else {
    console.log('❌ Direct query did not find the page!');
  }
}

debugSupabaseQuery().catch(console.error);
