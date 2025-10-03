import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { Database } from '@/app/server/services/supabase/database.types';
import { supabase } from '@/app/server/services/supabase/supabase-client';

/**
 * Insert Notion pages into Supabase in batches to handle large datasets efficiently
 * TODO: Support temporal table - use upsert to invalidate old rows instead of direct upsert (inserts new row, marks old as invalid). Insertions should always be new rows.
 */
export async function insertPagesInBatches(pages: NotionDatabasePage[], batchSize: number = 1000): Promise<void> {
  const totalPages = pages.length;

  for (let i = 0; i < totalPages; i += batchSize) {
    const batch = pages.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(totalPages / batchSize);

    console.log(`  🔄 Versioned upsert batch ${batchNumber}/${totalBatches} (${batch.length} pages)...`);

    // Call RPC to perform atomic invalidate-and-insert (temporal versioning)
    const payload = batch.map((p) => ({
      notion_page_id: p.notion_page_id,
      canonical_document_title: p.canonical_document_title ?? null,
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
    const insertedPageIds = batch.map((p) => p.notion_page_id);
    console.log(`  ✓ Upserted page IDs: ${insertedPageIds.join(', ')}`);

    console.log(`  ✓ Batch ${batchNumber}/${totalBatches} completed successfully`);
  }
}
