import { supabase } from './app/server/services/supabase/supabase-client';
import { loadEnv } from './scripts/utils/load-env';

loadEnv();

async function findTargetPosition() {
  const targetId = '1b3f2ff0-8d73-8058-a715-efb37089f852';

  console.log('🔍 Finding target page position in sorted results...');

  // First, get the target page's sort criteria
  const { data: targetData, error: targetError } = await supabase()
    .from('notion_database_pages')
    .select('sort_order, canonical_document_title, atlas_document_number')
    .eq('notion_page_id', targetId)
    .is('date_valid_to', null)
    .single();

  if (targetError || !targetData) {
    console.error('❌ Could not get target page:', targetError);
    return;
  }

  console.log('🎯 Target page criteria:');
  console.log('  - sort_order:', targetData.sort_order);
  console.log('  - canonical_document_title:', targetData.canonical_document_title);
  console.log('  - atlas_document_number:', targetData.atlas_document_number);

  // Count pages that would come BEFORE our target in the sorted order
  const { count, error: countError } = await supabase()
    .from('notion_database_pages')
    .select('*', { count: 'exact', head: true })
    .is('date_valid_to', null)
    .eq('archived', false)
    .eq('in_trash', false)
    .eq('atlas_database_name', 'Sections & Primary Docs')
    .or(
      `sort_order.lt.${targetData.sort_order},and(sort_order.eq.${targetData.sort_order},canonical_document_title.lt.${targetData.canonical_document_title})`,
    );

  if (countError) {
    console.error('❌ Error counting pages:', countError);
    return;
  }

  console.log(`\n📊 Pages that would come BEFORE target: ${count}`);
  console.log(`📄 Target would be at position: ${(count || 0) + 1}`);
  console.log(`📄 Target would be on page: ${Math.floor((count || 0) / 1000) + 1} (with 1000 per page)`);

  if ((count || 0) >= 1000) {
    console.log("🚨 TARGET IS ON PAGE 2 OR LATER - explains why it's missing from first 1000 results!");
  }
}

findTargetPosition().catch(console.error);
