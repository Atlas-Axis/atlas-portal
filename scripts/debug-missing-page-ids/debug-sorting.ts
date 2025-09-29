import { supabase } from './app/server/services/supabase/supabase-client';
import { loadEnv } from './scripts/utils/load-env';

loadEnv();

async function debugSorting() {
  const targetId = '1b3f2ff0-8d73-8058-a715-efb37089f852';

  console.log('🔍 Checking sorting conflicts...');

  // First, get our target page details
  const { data: targetData } = await supabase()
    .from('notion_database_pages')
    .select('*')
    .eq('notion_page_id', targetId)
    .is('date_valid_to', null);

  if (!targetData || targetData.length === 0) {
    console.log('❌ Target page not found!');
    return;
  }

  const target = targetData[0];
  console.log('📋 Target page details:');
  console.log('  - ID:', target.notion_page_id);
  console.log('  - Sort order:', target.sort_order);
  console.log('  - Canonical title:', target.canonical_document_title);
  console.log('  - Document number:', target.atlas_document_number);
  console.log('  - Created at:', target.created_at);
  console.log('  - Updated at:', target.updated_at);

  // Check for pages with the same sort_order
  console.log('\n🔍 Pages with same sort_order (2):');
  const { data: sameSortOrder } = await supabase()
    .from('notion_database_pages')
    .select('notion_page_id, sort_order, canonical_document_title, atlas_document_number, plain_text_name')
    .is('date_valid_to', null)
    .eq('archived', false)
    .eq('in_trash', false)
    .eq('atlas_database_name', 'Sections & Primary Docs')
    .eq('sort_order', 2)
    .order('canonical_document_title');

  console.log(`  Found ${sameSortOrder?.length || 0} pages with sort_order = 2`);
  sameSortOrder?.forEach((page, index) => {
    const isTarget = page.notion_page_id === targetId;
    console.log(
      `  ${index + 1}. ${page.atlas_document_number} - ${page.plain_text_name} ${isTarget ? '🎯 TARGET' : ''}`,
    );
    console.log(`      ID: ${page.notion_page_id}`);
  });

  // Check for pages with the same canonical_document_title
  console.log('\n🔍 Pages with same canonical_document_title (A.2.4 - Agent Artifact Updates):');
  const { data: sameCanonical } = await supabase()
    .from('notion_database_pages')
    .select('notion_page_id, sort_order, canonical_document_title, atlas_document_number, plain_text_name')
    .is('date_valid_to', null)
    .eq('archived', false)
    .eq('in_trash', false)
    .eq('atlas_database_name', 'Sections & Primary Docs')
    .eq('canonical_document_title', 'A.2.4 - Agent Artifact Updates')
    .order('sort_order')
    .order('atlas_document_number');

  console.log(`  Found ${sameCanonical?.length || 0} pages with same canonical title`);
  sameCanonical?.forEach((page, index) => {
    const isTarget = page.notion_page_id === targetId;
    console.log(
      `  ${index + 1}. Sort: ${page.sort_order} | ${page.atlas_document_number} - ${page.plain_text_name} ${isTarget ? '🎯 TARGET' : ''}`,
    );
    console.log(`      ID: ${page.notion_page_id}`);
  });

  // Try a query with just our target UUID to see if it returns
  console.log('\n🔍 Direct query for target UUID:');
  const { data: directQuery } = await supabase()
    .from('notion_database_pages')
    .select('notion_page_id, sort_order, canonical_document_title')
    .is('date_valid_to', null)
    .eq('notion_page_id', targetId);

  console.log(`  Direct query returned ${directQuery?.length || 0} results`);
}

debugSorting().catch(console.error);
