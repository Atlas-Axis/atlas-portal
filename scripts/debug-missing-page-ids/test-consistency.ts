import { supabase } from './app/server/services/supabase/supabase-client';
import { loadEnv } from './scripts/utils/load-env';

loadEnv();

async function testConsistentOrdering() {
  const targetId = '1b3f2ff0-8d73-8058-a715-efb37089f852';

  console.log('🔍 Testing query consistency (non-deterministic ordering issue)...');

  // Run the same query multiple times to see if we get different results
  const results = [];

  for (let i = 1; i <= 3; i++) {
    console.log(`\n🔄 Query ${i}:`);

    const { data, error } = await supabase()
      .from('notion_database_pages')
      .select('notion_page_id')
      .is('date_valid_to', null)
      .eq('archived', false)
      .eq('in_trash', false)
      .eq('atlas_database_name', 'Sections & Primary Docs')
      .order('sort_order')
      .order('canonical_document_title')
      .range(0, 999); // First 1000 results

    if (error) {
      console.error('❌ Error:', error);
      continue;
    }

    const targetFound = data.some((page) => page.notion_page_id === targetId);
    const totalCount = data.length;

    console.log(`  - Total results: ${totalCount}`);
    console.log(`  - Target found: ${targetFound ? '✅ YES' : '❌ NO'}`);

    results.push({ query: i, found: targetFound, count: totalCount });

    // Small delay to potentially see different results
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log('\n📊 Summary:');
  results.forEach((result) => {
    console.log(`  Query ${result.query}: ${result.found ? 'FOUND' : 'NOT FOUND'} (${result.count} results)`);
  });

  const foundCount = results.filter((r) => r.found).length;
  if (foundCount > 0 && foundCount < results.length) {
    console.log('\n🚨 INCONSISTENT RESULTS! This confirms non-deterministic ordering issue.');
    console.log('🔧 The pagination function needs a deterministic sort order (add notion_page_id as tie-breaker).');
  } else if (foundCount === 0) {
    console.log('\n❌ Target never found - may be consistently on page 2+ due to sort order.');
  } else {
    console.log('\n✅ Consistent results across queries.');
  }
}

testConsistentOrdering().catch(console.error);
