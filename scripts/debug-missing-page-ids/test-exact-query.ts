import { supabase } from './app/server/services/supabase/supabase-client';
import { loadEnv } from './scripts/utils/load-env';

loadEnv();

async function testExactQuery() {
  const targetId = '1b3f2ff0-8d73-8058-a715-efb37089f852';

  console.log('🔍 Testing exact query used by loadNotionDatabasePagesFromSupabase...');

  // This is the EXACT query used by the function
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

  console.log(`📊 Query returned ${data.length} pages`);

  const targetPage = data.find((page) => page.notion_page_id === targetId);

  if (targetPage) {
    console.log('✅ Target page FOUND!');
    console.log('  - Position:', data.indexOf(targetPage) + 1);
    console.log('  - Title:', targetPage.plain_text_name);
    console.log('  - Sort order:', targetPage.sort_order);
    console.log('  - Canonical title:', targetPage.canonical_document_title);
  } else {
    console.log('❌ Target page NOT FOUND!');

    // Find pages around where target should be based on sort_order and canonical_document_title
    console.log('\n🔍 Looking for pages with sort_order = 2...');
    const sort2Pages = data.filter((page) => page.sort_order === 2);
    console.log(`Found ${sort2Pages.length} pages with sort_order = 2`);

    // Look specifically for "Agent Artifact Updates" pages
    const agentArtifactPages = sort2Pages.filter(
      (page) => page.canonical_document_title === 'A.2.4 - Agent Artifact Updates',
    );

    console.log(`\nℹ️ Found ${agentArtifactPages.length} "Agent Artifact Updates" pages:`);
    agentArtifactPages.slice(0, 10).forEach((page, i) => {
      console.log(`  ${i + 1}. ${page.atlas_document_number} - ${page.plain_text_name} (${page.notion_page_id})`);
    });

    if (agentArtifactPages.length > 10) {
      console.log(`  ... and ${agentArtifactPages.length - 10} more`);
    }
  }
}

testExactQuery().catch(console.error);
