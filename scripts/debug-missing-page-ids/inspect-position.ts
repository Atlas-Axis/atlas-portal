import { supabase } from './app/server/services/supabase/supabase-client';
import { loadEnv } from './scripts/utils/load-env';

loadEnv();

async function inspectAroundPosition() {
  console.log('🔍 Inspecting pages around position 983...');

  // Get pages 980-990 (around where target should be)
  const { data, error } = await supabase()
    .from('notion_database_pages')
    .select('notion_page_id, sort_order, canonical_document_title, atlas_document_number, plain_text_name')
    .is('date_valid_to', null)
    .eq('archived', false)
    .eq('in_trash', false)
    .eq('atlas_database_name', 'Sections & Primary Docs')
    .order('sort_order')
    .order('canonical_document_title')
    .range(975, 990);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log(`📊 Pages 976-991 (positions around target):`);
  data.forEach((page, index) => {
    const position = 976 + index;
    const isTarget = page.notion_page_id === '1b3f2ff0-8d73-8058-a715-efb37089f852';
    console.log(
      `  ${position}. ${page.atlas_document_number} - ${page.plain_text_name} ${isTarget ? '🎯 TARGET' : ''}`,
    );
    console.log(`      Sort: ${page.sort_order} | Canonical: ${page.canonical_document_title}`);
    console.log(`      ID: ${page.notion_page_id}`);
    console.log('');
  });

  // Also check if there are any pages with exactly the same sort criteria as our target
  console.log('\n🔍 Pages with identical sort criteria to target...');
  const { data: identicalData } = await supabase()
    .from('notion_database_pages')
    .select('notion_page_id, sort_order, canonical_document_title, atlas_document_number, plain_text_name')
    .is('date_valid_to', null)
    .eq('archived', false)
    .eq('in_trash', false)
    .eq('atlas_database_name', 'Sections & Primary Docs')
    .eq('sort_order', 2)
    .eq('canonical_document_title', 'A.2.4 - Agent Artifact Updates')
    .order('atlas_document_number');

  console.log(`Found ${identicalData?.length || 0} pages with identical sort criteria:`);
  identicalData?.forEach((page, index) => {
    const isTarget = page.notion_page_id === '1b3f2ff0-8d73-8058-a715-efb37089f852';
    console.log(
      `  ${index + 1}. ${page.atlas_document_number} - ${page.plain_text_name} ${isTarget ? '🎯 TARGET' : ''}`,
    );
    console.log(`      ID: ${page.notion_page_id}`);
  });
}

inspectAroundPosition().catch(console.error);
