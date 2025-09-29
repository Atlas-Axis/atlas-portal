#!/usr/bin/env node
import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/services/atlas/load-atlas-from-supabase';
import { detectMissingChildren } from './scripts/atlas-json/atlas-tree-errors';
import { loadEnv } from './scripts/utils/load-env';

/**
 * Debug script to understand why detectMissingChildren is reporting false positives
 */
async function main() {
  // Load environment variables
  loadEnv();

  console.log('🔍 Debugging detectMissingChildren false positives...\n');

  // Load Atlas data
  const atlasData = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();

  // Count pages by database
  console.log('📊 Loaded pages by database:');
  let totalPages = 0;
  for (const [dbName, pages] of Object.entries(atlasData)) {
    console.log(`  ${dbName}: ${pages.length} pages`);
    totalPages += pages.length;
  }
  console.log(`  Total: ${totalPages} pages\n`);

  // Create a set of all existing page IDs (same logic as detectMissingChildren)
  const existingIds = new Set<string>();
  const allPageIds: string[] = [];

  for (const [dbName, pages] of Object.entries(atlasData)) {
    if (pages) {
      console.log(`  Processing ${dbName} with ${pages.length} pages`);
      for (const page of pages) {
        existingIds.add(page.notion_page_id);
        allPageIds.push(page.notion_page_id);
      }
    }
  }

  console.log(`🆔 Total pages processed: ${allPageIds.length}`);
  console.log(`🆔 Total unique page IDs in existingIds set: ${existingIds.size}`);

  // Find duplicates
  const duplicates = allPageIds.filter((id, index) => allPageIds.indexOf(id) !== index);
  if (duplicates.length > 0) {
    console.log(`🚨 Found ${duplicates.length} duplicate page IDs:`);
    const uniqueDuplicates = [...new Set(duplicates)];
    uniqueDuplicates.slice(0, 5).forEach((id) => {
      const count = allPageIds.filter((pageId) => pageId === id).length;
      console.log(`  ${id} appears ${count} times`);
    });
    if (uniqueDuplicates.length > 5) {
      console.log(`  ... and ${uniqueDuplicates.length - 5} more duplicates`);
    }
  }

  // Check our specific example
  const exampleId = '1b3f2ff0-8d73-8058-a715-efb37089f852';
  const isInExistingIds = existingIds.has(exampleId);

  // Show which databases contain our target UUID
  console.log('\n🎯 Target UUID presence by database:');
  for (const [dbName, pages] of Object.entries(atlasData)) {
    if (pages) {
      const containsTarget = pages.some((p) => p.notion_page_id === exampleId);
      console.log(`  ${dbName}: ${containsTarget ? '✅ FOUND' : '❌ NOT FOUND'}`);
      if (containsTarget) {
        const targetPage = pages.find((p) => p.notion_page_id === exampleId);
        console.log(`    Name: ${targetPage?.plain_text_name}`);
        console.log(`    Type: ${targetPage?.atlas_document_type}`);
      }
    }
  }
  console.log(`📍 Example UUID ${exampleId} in existingIds: ${isInExistingIds}`);

  if (isInExistingIds) {
    // Find which page/database it belongs to
    for (const [dbName, pages] of Object.entries(atlasData)) {
      if (pages) {
        const page = pages.find((p) => p.notion_page_id === exampleId);
        if (page) {
          console.log(`   Found in database: ${dbName}`);
          console.log(`   Page name: ${page.plain_text_name}`);
          console.log(`   Document number: ${page.atlas_document_number}`);
          console.log(`   Document type: ${page.atlas_document_type}`);
          break;
        }
      }
    }
  }

  // Check which pages reference our example ID
  console.log('\n🔗 Pages referencing the example UUID:');
  let referencingCount = 0;
  for (const [dbName, pages] of Object.entries(atlasData)) {
    if (pages) {
      for (const page of pages) {
        const childArrays = [
          { array: page.child_scope_ids, type: 'child_scope_ids' },
          { array: page.child_article_ids, type: 'child_article_ids' },
          { array: page.child_section_and_primary_doc_ids, type: 'child_section_and_primary_doc_ids' },
          { array: page.child_annotation_ids, type: 'child_annotation_ids' },
          { array: page.child_tenet_ids, type: 'child_tenet_ids' },
          { array: page.child_scenario_ids, type: 'child_scenario_ids' },
          { array: page.child_scenario_variation_ids, type: 'child_scenario_variation_ids' },
          { array: page.child_active_data_ids, type: 'child_active_data_ids' },
          { array: page.child_agent_scope_ids, type: 'child_agent_scope_ids' },
          { array: page.child_needed_research_ids, type: 'child_needed_research_ids' },
        ];

        for (const { array, type } of childArrays) {
          if (Array.isArray(array) && array.includes(exampleId)) {
            referencingCount++;
            console.log(`   ${page.notion_page_id} (${page.plain_text_name}) in ${dbName} -> ${type}`);
          }
        }
      }
    }
  }
  console.log(`   Total referencing pages: ${referencingCount}`);

  // Now run detectMissingChildren and see what happens
  console.log('\n🚨 Running detectMissingChildren...');
  const missingChildrenErrors = detectMissingChildren(atlasData);

  const exampleErrors = missingChildrenErrors.filter((error) => {
    const ctx = error.context;
    return (
      ctx &&
      typeof ctx === 'object' &&
      'missingChildId' in ctx &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ctx as any).missingChildId === exampleId
    );
  });

  console.log(`   Total missing children errors: ${missingChildrenErrors.length}`);
  console.log(`   Errors for example UUID: ${exampleErrors.length}`);

  if (exampleErrors.length > 0) {
    console.log('   Example error details:');
    exampleErrors.forEach((error, i) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const context = error.context as any;
      console.log(`     ${i + 1}. Parent: ${error.pageId} (${context?.parentPageName})`);
      console.log(`        Relationship: ${context?.relationshipType}`);
      console.log(`        Message: ${error.message}`);
    });
  }

  process.exit(0);
}

/**
 * Usage:
 * npx tsx debug-missing-children.ts
 */
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
