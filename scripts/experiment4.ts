/**
 * Dual Relationship Discrepancy Checker (Supabase Version)
 *
 * This script checks for discrepancies in the dual parent-child relationships
 * stored in the notion_database_pages_current view in Supabase.
 *
 * Specifically, it finds pages where:
 * - Both `child_section_and_primary_doc_ids` AND `child_agent_scope_ids` are empty (no children recorded)
 * - BUT another page references it via `parent_notion_page_id` (claims to be a child)
 *
 * This indicates a faulty dual relationship where the parent-child link is
 * not properly synchronized in both directions.
 *
 * Output:
 * - Lists each page with broken relationships
 * - Shows which pages claim to be children but aren't recorded as such
 * - Reports total count of discrepancies found
 *
 * Usage:
 *   npx tsx scripts/experiment4.ts
 */
import type { AtlasDocumentType } from '@/app/server/atlas/atlas-types';
import { supabase } from '@/app/server/services/supabase/supabase-client';
import { loadEnv } from './utils/load-env';

interface NotionDatabasePage {
  notion_page_id: string;
  plain_text_name: string | null;
  atlas_document_type: AtlasDocumentType;
  atlas_document_number: string;
  atlas_database_name: string;
  parent_notion_page_id: string | null;
  child_section_and_primary_doc_ids: string[];
  child_agent_scope_ids: string[];
  child_scope_ids: string[];
  child_article_ids: string[];
  child_annotation_ids: string[];
  child_tenet_ids: string[];
  child_scenario_ids: string[];
  child_scenario_variation_ids: string[];
  child_active_data_ids: string[];
  child_needed_research_ids: string[];
}

interface Discrepancy {
  parentPageId: string;
  parentName: string;
  parentType: AtlasDocumentType;
  parentDocNumber: string;
  parentDatabase: string;
  childrenClaimingParenthood: Array<{
    pageId: string;
    name: string;
    type: AtlasDocumentType;
    docNumber: string;
    database: string;
  }>;
}

async function main() {
  // Load environment variables
  loadEnv();

  const startTime = Date.now();

  try {
    console.log('🚀 Checking dual relationship discrepancies in notion_database_pages_current...\n');

    // Fetch all pages from the current view
    const { data: pages, error } = await supabase()
      .from('notion_database_pages_current')
      .select(
        `
        notion_page_id,
        plain_text_name,
        atlas_document_type,
        atlas_document_number,
        atlas_database_name,
        parent_notion_page_id,
        child_section_and_primary_doc_ids,
        child_agent_scope_ids,
        child_scope_ids,
        child_article_ids,
        child_annotation_ids,
        child_tenet_ids,
        child_scenario_ids,
        child_scenario_variation_ids,
        child_active_data_ids,
        child_needed_research_ids
      `,
      )
      .returns<NotionDatabasePage[]>();

    if (error) {
      throw new Error(`Failed to fetch pages: ${error.message}`);
    }

    if (!pages || pages.length === 0) {
      console.log('⚠️  No pages found in notion_database_pages_current view');
      return;
    }

    console.log(`✅ Fetched ${pages.length} pages from the database\n`);

    // Build a map of page ID -> page data for quick lookups
    const pageMap = new Map<string, NotionDatabasePage>();
    for (const page of pages) {
      pageMap.set(page.notion_page_id, page);
    }

    // Find discrepancies
    const discrepancies: Discrepancy[] = [];

    for (const page of pages) {
      // Check if this page has no children in section_and_primary_doc or agent_scope arrays
      const hasSectionChildren = page.child_section_and_primary_doc_ids?.length > 0;
      const hasAgentScopeChildren = page.child_agent_scope_ids?.length > 0;

      // Skip if either array has children
      if (hasSectionChildren || hasAgentScopeChildren) {
        continue;
      }

      // Now check if any other pages claim this page as their parent
      const childrenClaimingParenthood = pages.filter(
        (otherPage) => otherPage.parent_notion_page_id === page.notion_page_id,
      );

      if (childrenClaimingParenthood.length > 0) {
        discrepancies.push({
          parentPageId: page.notion_page_id,
          parentName: page.plain_text_name || 'Untitled',
          parentType: page.atlas_document_type,
          parentDocNumber: page.atlas_document_number,
          parentDatabase: page.atlas_database_name,
          childrenClaimingParenthood: childrenClaimingParenthood.map((child) => ({
            pageId: child.notion_page_id,
            name: child.plain_text_name || 'Untitled',
            type: child.atlas_document_type,
            docNumber: child.atlas_document_number,
            database: child.atlas_database_name,
          })),
        });
      }
    }

    // Report results
    if (discrepancies.length === 0) {
      console.log('✅ No dual relationship discrepancies found!');
    } else {
      console.log(`⚠️  Found ${discrepancies.length} page(s) with dual relationship discrepancies:\n`);
      console.log('='.repeat(80));

      for (const disc of discrepancies) {
        console.log(`\n📄 PARENT PAGE (has no recorded children but is referenced by others):`);
        console.log(`  Name: ${disc.parentName}`);
        console.log(`  Type: ${disc.parentType}`);
        console.log(`  Document Number: ${disc.parentDocNumber}`);
        console.log(`  Database: ${disc.parentDatabase}`);
        console.log(`  Page ID: ${disc.parentPageId}`);
        console.log(`  Notion URL: https://notion.so/${disc.parentPageId.replace(/-/g, '')}`);
        console.log(`  ❌ child_section_and_primary_doc_ids: []`);
        console.log(`  ❌ child_agent_scope_ids: []`);

        console.log(`\n  ⚠️  But ${disc.childrenClaimingParenthood.length} page(s) claim this as their parent:`);

        for (const child of disc.childrenClaimingParenthood) {
          console.log(`\n    👶 CHILD PAGE:`);
          console.log(`      Name: ${child.name}`);
          console.log(`      Type: ${child.type}`);
          console.log(`      Document Number: ${child.docNumber}`);
          console.log(`      Database: ${child.database}`);
          console.log(`      Page ID: ${child.pageId}`);
          console.log(`      Notion URL: https://notion.so/${child.pageId.replace(/-/g, '')}`);
          console.log(`      parent_notion_page_id: ${child.pageId} (points to parent above)`);
        }

        console.log('\n' + '-'.repeat(80));
      }

      console.log('\n' + '='.repeat(80));
      console.log('📊 SUMMARY');
      console.log('='.repeat(80));
      console.log(`Total parent pages with broken relationships: ${discrepancies.length}`);
      const totalChildren = discrepancies.reduce((sum, disc) => sum + disc.childrenClaimingParenthood.length, 0);
      console.log(`Total children claiming non-existent parent relationships: ${totalChildren}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n⏱️  Completed in ${duration}s`);
  } catch (error) {
    console.error('\n❌ Error checking relationships:', error);
    process.exit(1);
  }
}

/**
 * Usage:
 * npx tsx scripts/experiment4.ts
 */
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
