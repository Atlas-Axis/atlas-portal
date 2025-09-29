import { supabase } from './app/server/services/supabase/supabase-client';
import { loadEnv } from './scripts/utils/load-env';

loadEnv();

async function debugPagination() {
  const targetId = '1b3f2ff0-8d73-8058-a715-efb37089f852';
  const pageSize = 1000;

  console.log('🔍 Testing pagination to find where target page appears...');

  let page = 0;
  let found = false;

  while (!found && page < 10) {
    // Safety limit
    console.log(`\n📄 Page ${page} (records ${page * pageSize} - ${(page + 1) * pageSize - 1})`);

    const { data, error } = await supabase()
      .from('notion_database_pages')
      .select('notion_page_id, atlas_document_number, plain_text_name, sort_order, canonical_document_title')
      .is('date_valid_to', null)
      .eq('archived', false)
      .eq('in_trash', false)
      .eq('atlas_database_name', 'Sections & Primary Docs')
      .order('sort_order')
      .order('canonical_document_title')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('❌ Error:', error);
      break;
    }

    console.log(`  - Returned ${data.length} records`);

    if (data.length === 0) {
      console.log('  - No more data, stopping');
      break;
    }

    // Check if target is in this page
    const targetInThisPage = data.find((row) => row.notion_page_id === targetId);
    if (targetInThisPage) {
      console.log(`✅ FOUND target page in page ${page}!`);
      console.log('  - Document number:', targetInThisPage.atlas_document_number);
      console.log('  - Title:', targetInThisPage.plain_text_name);
      console.log('  - Sort order:', targetInThisPage.sort_order);
      console.log('  - Canonical title:', targetInThisPage.canonical_document_title);
      found = true;
      break;
    } else {
      console.log('  - Target NOT in this page');
    }

    // Show first few and last few records for context
    if (data.length > 0) {
      console.log('  - First record:', data[0].atlas_document_number, '-', data[0].plain_text_name);
      if (data.length > 1) {
        console.log(
          '  - Last record:',
          data[data.length - 1].atlas_document_number,
          '-',
          data[data.length - 1].plain_text_name,
        );
      }
    }

    page++;
  }

  if (!found) {
    console.log('\n❌ Target page not found in any of the first 10 pages!');

    // Let's also check the target page's sort_order and canonical_document_title
    console.log('\n🔍 Checking target page sorting fields...');
    const { data: targetData, error: targetError } = await supabase()
      .from('notion_database_pages')
      .select('sort_order, canonical_document_title, atlas_document_number, plain_text_name')
      .eq('notion_page_id', targetId)
      .is('date_valid_to', null);

    if (!targetError && targetData && targetData.length > 0) {
      const target = targetData[0];
      console.log('  - Sort order:', target.sort_order);
      console.log('  - Canonical title:', target.canonical_document_title);
      console.log('  - Document number:', target.atlas_document_number);
    }
  }
}

debugPagination().catch(console.error);
