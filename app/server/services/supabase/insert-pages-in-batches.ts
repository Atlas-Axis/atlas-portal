import { v4 as uuidv4 } from 'uuid';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { Database } from '@/app/server/services/supabase/database.types';
import { supabase } from '@/app/server/services/supabase/supabase-client';

/**
 * Insert Notion pages into Supabase in batches to handle large datasets efficiently
 */
export async function upsertPagesInBatches(
  pages: NotionDatabasePage[],
  changeType: 'insert' | 'update',
  batchSize: number = 500,
): Promise<void> {
  const totalPages = pages.length;

  for (let i = 0; i < totalPages; i += batchSize) {
    const batch = pages.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(totalPages / batchSize);

    console.log(`  🔄 Versioned upsert batch ${batchNumber}/${totalBatches} (${batch.length} pages)...`);

    // Call RPC to perform atomic invalidate-and-insert (temporal versioning)
    const payload = batch.map((p) => ({
      notion_page_id: p.notion_page_id,
      atlas_document_type: p.atlas_document_type,
      atlas_document_number: p.atlas_document_number,
      atlas_database_name: p.atlas_database_name,
      has_children: p.has_children,
      archived: p.archived,
      in_trash: p.in_trash,
      plain_text_content: p.plain_text_content ?? null,
      json_content: p.json_content,
      plain_text_name: p.plain_text_name ?? null,
      json_name: p.json_name,
      parent_notion_page_id: p.parent_notion_page_id ?? null,
      child_scope_ids: p.child_scope_ids,
      child_article_ids: p.child_article_ids,
      child_section_and_primary_doc_ids: p.child_section_and_primary_doc_ids,
      child_annotation_ids: p.child_annotation_ids,
      child_tenet_ids: p.child_tenet_ids,
      child_scenario_ids: p.child_scenario_ids,
      child_scenario_variation_ids: p.child_scenario_variation_ids,
      child_active_data_ids: p.child_active_data_ids,
      child_agent_scope_ids: p.child_agent_scope_ids,
      child_needed_research_ids: p.child_needed_research_ids,
      extra_fields: p.extra_fields,
      sort_order: p.sort_order,
      updated_at: p.updated_at ?? null,
      last_edited_by_user_id: p.last_edited_by_user_id ?? null,
    }));

    await supabase()
      .rpc('versioned_upsert_notion_database_pages', {
        // TODO: Add a type alias for the long type below
        p_rows: payload as Database['public']['Functions']['versioned_upsert_notion_database_pages']['Args']['p_rows'],
      })
      .throwOnError();

    // Log all page IDs that were upserted as a list
    const upsertedPageIds = batch.map((p) => p.notion_page_id);
    console.log(`  ✓ Upserted page IDs: ${upsertedPageIds.join(', ')}`);

    console.log(`  ✓ Batch ${batchNumber}/${totalBatches} completed successfully`);
  }

  // Create UUID mappings for new pages after inserting Atlas documents
  if (changeType === 'insert') {
    console.log(`  🔄 Creating UUID mappings for ${totalPages} pages...`);
    await insertUuidMappingsForBatch(pages);
    console.log(`  ✓ UUID mappings completed successfully`);
  }
}

/**
 * Insert UUID mappings into Supabase in batches for each Notion page
 * Generates a new random UUID (v4) for each page and creates mapping entries
 * Uses internal batching with 500 items per iteration
 *
 * Skips pages that already have UUID mappings (e.g., created by Markdown→Notion sync)
 * to ensure both workflows are compatible.
 */
async function insertUuidMappingsForBatch(pages: NotionDatabasePage[]): Promise<void> {
  const totalPages = pages.length;
  // Use smaller batch size for queries (URI length limit) vs inserts
  const queryBatchSize = 100; // ~3600 chars for UUIDs, safe for URI
  const insertBatchSize = 500;

  // Get all Notion page IDs from the pages
  const notionPageIds = pages.map((p) => p.notion_page_id);

  // Query existing mappings in batches to avoid URI too long errors
  const existingPageIds = new Set<string>();
  const queryBatches = Math.ceil(notionPageIds.length / queryBatchSize);

  for (let i = 0; i < notionPageIds.length; i += queryBatchSize) {
    const batchIds = notionPageIds.slice(i, i + queryBatchSize);
    const batchNumber = Math.floor(i / queryBatchSize) + 1;

    console.log(`  🔍 Checking existing mappings batch ${batchNumber}/${queryBatches} (${batchIds.length} IDs)...`);

    const { data: existingMappings, error: queryError } = await supabase()
      .from('uuid_mapping')
      .select('notion_page_id')
      .in('notion_page_id', batchIds);

    if (queryError) {
      throw new Error(`Failed to query existing UUID mappings: ${queryError.message}`);
    }

    // Add found IDs to the set
    existingMappings?.forEach((m) => existingPageIds.add(m.notion_page_id));
  }

  // Filter to only pages that need new mappings
  const pagesToMap = pages.filter((p) => !existingPageIds.has(p.notion_page_id));

  if (existingPageIds.size > 0) {
    console.log(`  ℹ️ Skipping ${existingPageIds.size} pages with existing UUID mappings`);
  }

  if (pagesToMap.length === 0) {
    console.log(`  ✓ All ${totalPages} pages already have UUID mappings, nothing to create`);
    return;
  }

  // Continue with batched insert for remaining pages
  const totalPagesToMap = pagesToMap.length;

  for (let i = 0; i < totalPagesToMap; i += insertBatchSize) {
    const batch = pagesToMap.slice(i, i + insertBatchSize);
    const batchNumber = Math.floor(i / insertBatchSize) + 1;
    const totalBatches = Math.ceil(totalPagesToMap / insertBatchSize);

    console.log(`  🔄 UUID mapping batch ${batchNumber}/${totalBatches} (${batch.length} pages)...`);

    // Generate UUID mappings for the batch
    const uuidMappings = batch.map((page) => ({
      atlas_document_uuid: uuidv4(),
      notion_page_id: page.notion_page_id,
    }));

    // Insert the UUID mappings
    await supabase().from('uuid_mapping').insert(uuidMappings).throwOnError();

    // Log all page IDs that were mapped as a list
    const mappedPageIds = batch.map((p) => p.notion_page_id);
    console.log(`  ✓ Mapped page IDs: ${mappedPageIds.join(', ')}`);

    console.log(`  ✓ UUID mapping batch ${batchNumber}/${totalBatches} completed successfully`);
  }
}
