import { supabase } from './app/server/services/supabase/supabase-client';
import { loadEnv } from './scripts/utils/load-env';

loadEnv();

async function comparePages() {
  const targetId = '1b3f2ff0-8d73-8058-a715-efb37089f852';
  const workingId = '1b3f2ff0-8d73-8000-8e24-f959442d588d'; // A.2.4.8.2.2.3.5.4.1 - Sky Core Atlas Updates

  console.log('🔍 Comparing target page vs working page...');

  // Get both pages
  const { data, error } = await supabase()
    .from('notion_database_pages')
    .select('*')
    .in('notion_page_id', [targetId, workingId])
    .is('date_valid_to', null);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!data || data.length !== 2) {
    console.log(`❌ Expected 2 pages, got ${data?.length || 0}`);
    return;
  }

  const targetPage = data.find((p) => p.notion_page_id === targetId);
  const workingPage = data.find((p) => p.notion_page_id === workingId);

  if (!targetPage || !workingPage) {
    console.log('❌ Could not find both pages');
    return;
  }

  console.log('\n📋 Comparison:');
  console.log('=====================================');

  const compareFields = [
    'notion_page_id',
    'atlas_database_name',
    'atlas_document_type',
    'atlas_document_number',
    'plain_text_name',
    'archived',
    'in_trash',
    'date_valid_to',
    'sort_order',
    'canonical_document_title',
    'created_at',
    'updated_at',
  ];

  for (const field of compareFields) {
    const targetVal = targetPage[field as keyof typeof targetPage];
    const workingVal = workingPage[field as keyof typeof workingPage];
    const match = targetVal === workingVal;

    console.log(`${field}:`);
    console.log(`  Target:  ${targetVal} ${match ? '✅' : '❌'}`);
    console.log(`  Working: ${workingVal} ${match ? '✅' : '❌'}`);

    if (!match) {
      console.log(`  >>> DIFFERENCE FOUND! <<<`);
    }
    console.log('');
  }

  // Also check if there are any null values that might cause issues
  console.log('📊 Null value checks:');
  for (const field of compareFields) {
    const targetVal = targetPage[field as keyof typeof targetPage];
    const workingVal = workingPage[field as keyof typeof workingPage];

    if (targetVal === null || targetVal === undefined) {
      console.log(`❌ Target page has null ${field}`);
    }
    if (workingVal === null || workingVal === undefined) {
      console.log(`ℹ️ Working page has null ${field}`);
    }
  }
}

comparePages().catch(console.error);
