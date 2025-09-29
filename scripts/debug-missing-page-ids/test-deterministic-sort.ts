import { supabase } from './app/server/services/supabase/supabase-client';
import { loadEnv } from './scripts/utils/load-env';

loadEnv();

async function testWithDeterministicSort() {
  const targetId = '1b3f2ff0-8d73-8058-a715-efb37089f852';

  console.log('🔍 Testing query with deterministic sort (adding notion_page_id as tie-breaker)...');

  // Query with deterministic ordering
  const { data, error } = await supabase()
    .from('notion_database_pages')
    .select('notion_page_id, sort_order, canonical_document_title, atlas_document_number, plain_text_name')
    .is('date_valid_to', null)
    .eq('archived', false)
    .eq('in_trash', false)
    .eq('atlas_database_name', 'Sections & Primary Docs')
    .order('sort_order')
    .order('canonical_document_title')
    .order('notion_page_id') // ADD deterministic tie-breaker
    .range(0, 999);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`📊 Query with deterministic sort returned: ${data.length} results`);

  const targetPage = data.find((page) => page.notion_page_id === targetId);

  if (targetPage) {
    console.log('✅ Target page FOUND with deterministic sort!');
    const position = data.indexOf(targetPage) + 1;
    console.log(`  - Position: ${position}`);
    console.log(`  - Title: ${targetPage.plain_text_name}`);
    console.log(`  - Document number: ${targetPage.atlas_document_number}`);

    console.log('\n🔧 SOLUTION: Add notion_page_id as third sort criterion in loadNotionDatabasePagesFromSupabase!');
  } else {
    console.log('❌ Target page still NOT FOUND even with deterministic sort');

    // Let's see what "Agent Artifact Updates" pages are in this result
    const agentArtifactPages = data.filter(
      (page) => page.canonical_document_title === 'A.2.4 - Agent Artifact Updates',
    );

    console.log(`\nℹ️ Found ${agentArtifactPages.length} "Agent Artifact Updates" pages in deterministic results:`);
    agentArtifactPages.slice(0, 10).forEach((page, i) => {
      console.log(`  ${i + 1}. ${page.atlas_document_number} - ${page.plain_text_name} (${page.notion_page_id})`);
    });

    if (agentArtifactPages.length > 10) {
      console.log(`  ... and ${agentArtifactPages.length - 10} more`);
    }
  }
}

testWithDeterministicSort().catch(console.error);
