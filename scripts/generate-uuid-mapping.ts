#!/usr/bin/env npx tsx
import { v4 as uuidv4 } from 'uuid';
import { TablesInsert } from '@/app/server/services/supabase/database.types';
import { supabase } from '@/app/server/services/supabase/supabase-client';
import { loadEnv } from './utils/load-env';

/**
 * Run: npx tsx scripts/generate-uuid-mapping.ts
 *
 * CLI script: Generate UUID mappings for all current Notion database pages.
 * - Reads all notion_page_id values from `notion_database_pages_current`
 * - Generates a new UUID (v4) for each notion_page_id that doesn't already have a mapping
 * - Inserts into `uuid_mapping` (unique constraints protect against duplicates)
 */
async function main() {
  loadEnv();

  console.log('Generating UUID mappings for current Notion database pages...');

  // Load existing mappings to avoid re-generating (paginate to bypass default 1k limit)
  const existingSet = new Set<string>();
  {
    let fromIdx = 0;
    const page = 1000;
    while (true) {
      const { data: mapPage, error: mapErr } = await supabase()
        .from('uuid_mapping')
        .select('notion_page_id')
        .range(fromIdx, fromIdx + page - 1);

      if (mapErr) {
        console.error('Failed loading existing uuid_mapping rows:', mapErr.message);
        process.exit(1);
      }

      for (const row of mapPage ?? []) {
        if (row.notion_page_id) existingSet.add(row.notion_page_id);
      }

      if (!mapPage || mapPage.length < page) break;
      fromIdx += page;
    }
  }

  // Stream or page through current pages to be safe with large datasets
  let allPageIds: string[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase()
      .from('notion_database_pages_current')
      .select('notion_page_id')
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('Error loading notion_database_pages_current:', error.message);
      process.exit(1);
    }

    const pageIds = (data ?? []).map((row) => row.notion_page_id).filter((id): id is string => !!id);

    allPageIds = allPageIds.concat(pageIds);

    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`Found ${allPageIds.length} current pages.`);

  const missing = allPageIds.filter((id) => !existingSet.has(id));
  console.log(`Missing mappings: ${missing.length}`);

  if (missing.length === 0) {
    console.log('No new mappings needed. Done.');
    return;
  }

  // Insert in batches to uuid_mapping
  const batchSize = 1000;
  for (let i = 0; i < missing.length; i += batchSize) {
    const batchIds = missing.slice(i, i + batchSize);
    const payload: TablesInsert<'uuid_mapping'>[] = batchIds.map((notion_page_id) => ({
      notion_page_id,
      atlas_document_uuid: uuidv4(),
    }));

    console.log(
      `Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(missing.length / batchSize)} (${payload.length} rows)...`,
    );

    const upsertOptions = { onConflict: 'notion_page_id', ignoreDuplicates: true } as unknown as object;
    const { error: insertErr } = await supabase().from('uuid_mapping').upsert(payload, upsertOptions).throwOnError();

    if (insertErr) {
      console.error('Failed inserting uuid_mapping batch:', insertErr);
      process.exit(1);
    }
  }

  console.log('UUID mappings generation completed successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
