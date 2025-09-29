import { supabase } from './app/server/services/supabase/supabase-client';
import { loadEnv } from './scripts/utils/load-env';

loadEnv();

async function checkSupabasePage() {
  const targetId = '1b3f2ff0-8d73-8058-a715-efb37089f852';

  const { data, error } = await supabase()
    .from('notion_database_pages')
    .select('*')
    .eq('notion_page_id', targetId)
    .is('date_valid_to', null);

  if (error) {
    console.error('❌ Error querying Supabase:', error);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    console.log('❌ Page not found in Supabase');
    process.exit(1);
  }

  const page = data[0];
  console.log('📋 Page found in Supabase:');
  console.log('  - Database:', page.atlas_database_name);
  console.log('  - Document type:', page.atlas_document_type);
  console.log('  - Document number:', page.atlas_document_number);
  console.log('  - Title:', page.plain_text_name);
  console.log('  - Archived:', page.archived);
  console.log('  - In trash:', page.in_trash);
  console.log('  - Created:', new Date(page.created_at).toISOString());
  console.log('  - Updated:', new Date(page.updated_at).toISOString());
}

checkSupabasePage().catch(console.error);
