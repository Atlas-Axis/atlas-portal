#!/usr/bin/env tsx
/**
 * Verify Standardized Notion Fields
 *
 * This script verifies that the stored values in Supabase (atlas_document_number, plain_text_name)
 * match the dynamically calculated values from the tree building process.
 *
 * This is the verification step after:
 * 1. Running populate-standardized-notion-fields.ts to populate Notion
 * 2. Running the Notion to Supabase import to pull values into Supabase
 *
 * The script compares:
 * - Stored document numbers (atlas_document_number) vs calculated (generatedDocID)
 * - Stored document names (plain_text_name) vs calculated (generatedDocName)
 *
 * If all values match, it's safe to switch the default from dynamic to stored values.
 *
 * Usage:
 *   npx tsx scripts/verify-standardized-fields.ts [--verbose]
 *
 * Options:
 *   --verbose   Show all comparisons (not just mismatches)
 *
 * Exit codes:
 *   0 - All values match (verification passed)
 *   1 - Some values don't match (verification failed)
 *   2 - Fatal error occurred
 *
 * Related: docs/action-plans/NOTION_PROPERTY_STANDARDIZATION_ACTION_PLAN.md
 */
import { loadUuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import { buildNotionAtlasTree } from '@/app/server/atlas/notion-tree/atlas-tree-builder';
import { NotionAtlasTreeNode } from '@/app/server/atlas/notion-tree/atlas-tree-types';
import { loadNotionDatabasePagesFromSupabase } from '@/app/server/services/supabase/load-notion-database-pages-from-supabase';
import { loadEnv } from './utils/load-env';

interface VerificationResult {
  pageId: string;
  docNumberMatch: boolean;
  docNameMatch: boolean;
  storedDocNumber: string;
  calculatedDocNumber: string;
  storedDocName: string;
  calculatedDocName: string;
}

interface VerificationStats {
  total: number;
  docNumberMatches: number;
  docNumberMismatches: number;
  docNameMatches: number;
  docNameMismatches: number;
  mismatches: VerificationResult[];
}

/**
 * Flattens scope trees into a single array of all nodes
 */
function flattenScopeTrees(scopeTrees: NotionAtlasTreeNode[]): NotionAtlasTreeNode[] {
  const allNodes: NotionAtlasTreeNode[] = [];

  function traverse(node: NotionAtlasTreeNode) {
    allNodes.push(node);

    // Traverse all child arrays
    node.scopes.forEach(traverse);
    node.articles.forEach(traverse);
    node.sectionsAndPrimaryDocs.forEach(traverse);
    node.annotations.forEach(traverse);
    node.tenets.forEach(traverse);
    node.scenarios.forEach(traverse);
    node.scenarioVariations.forEach(traverse);
    node.activeData.forEach(traverse);
    node.agentScopeDocs.forEach(traverse);
    node.neededResearch.forEach(traverse);
  }

  scopeTrees.forEach(traverse);
  return allNodes;
}

/**
 * Normalizes a string for comparison (trims whitespace, handles null/undefined)
 */
function normalizeForComparison(value: string | null | undefined): string {
  return (value || '').trim();
}

/**
 * Main function
 */
async function main() {
  const startTime = Date.now();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');

  // Initialize environment
  loadEnv();

  // Format timestamp for logging
  const now = new Date();
  const dateTimeString = now.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  Verify Standardized Notion Fields');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(`  Started at: ${dateTimeString}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  if (verbose) {
    console.log(`  Mode: VERBOSE (showing all comparisons)`);
  }
  console.log('');
  console.log(`  Comparing:`);
  console.log(`    - Stored document numbers (atlas_document_number) vs calculated (generatedDocID)`);
  console.log(`    - Stored document names (plain_text_name) vs calculated (generatedDocName)`);
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('');

  // Step 1: Load data from Supabase
  console.log('📦 Step 1: Loading Atlas data from Supabase...');
  const allPages = await loadNotionDatabasePagesFromSupabase();
  console.log(`   Loaded ${allPages.length} pages`);
  console.log('');

  // Step 2: Load UUID mappings
  console.log('🔗 Step 2: Loading UUID mappings...');
  const uuidMappings = await loadUuidMappings();
  console.log(`   Loaded ${uuidMappings.notionPageIDsToAtlasUUIDs.size} UUID mappings`);
  console.log('');

  // Step 3: Build Atlas tree (this calculates document numbers and names)
  console.log('🌳 Step 3: Building Atlas tree and calculating document numbers...');
  const { scopeTrees, orphanedNodesAsTreeNodes } = await buildNotionAtlasTree(allPages, {
    uuidMappings,
    verbose: false,
  });
  console.log(`   Built ${scopeTrees.length} scope trees`);
  if (orphanedNodesAsTreeNodes.length > 0) {
    console.log(`   ⚠️  Found ${orphanedNodesAsTreeNodes.length} orphaned nodes`);
  }
  console.log('');

  // Step 4: Flatten tree to get all nodes
  console.log('📋 Step 4: Flattening tree structure...');
  const allNodes = [...flattenScopeTrees(scopeTrees), ...orphanedNodesAsTreeNodes];
  console.log(`   Total nodes to verify: ${allNodes.length}`);
  console.log('');

  // Step 5: Create lookup map for stored values by page ID
  console.log('🗂️  Step 5: Creating lookup map for stored values...');
  const storedValuesMap = new Map(allPages.map((page) => [page.notion_page_id, page]));
  console.log(`   Created lookup map with ${storedValuesMap.size} entries`);
  console.log('');

  // Step 6: Compare stored vs calculated values
  console.log('🔍 Step 6: Comparing stored vs calculated values...');
  console.log('');

  const stats: VerificationStats = {
    total: allNodes.length,
    docNumberMatches: 0,
    docNumberMismatches: 0,
    docNameMatches: 0,
    docNameMismatches: 0,
    mismatches: [],
  };

  for (const node of allNodes) {
    const storedPage = storedValuesMap.get(node.notion_page_id);
    if (!storedPage) {
      console.warn(`   ⚠️  Page not found in stored values: ${node.notion_page_id}`);
      continue;
    }

    const storedDocNumber = normalizeForComparison(storedPage.atlas_document_number);
    const calculatedDocNumber = normalizeForComparison(node.generatedDocID);
    const storedDocName = normalizeForComparison(storedPage.plain_text_name);
    const calculatedDocName = normalizeForComparison(node.generatedDocName);

    const docNumberMatch = storedDocNumber === calculatedDocNumber;
    const docNameMatch = storedDocName === calculatedDocName;

    if (docNumberMatch) {
      stats.docNumberMatches++;
    } else {
      stats.docNumberMismatches++;
    }

    if (docNameMatch) {
      stats.docNameMatches++;
    } else {
      stats.docNameMismatches++;
    }

    const result: VerificationResult = {
      pageId: node.notion_page_id,
      docNumberMatch,
      docNameMatch,
      storedDocNumber,
      calculatedDocNumber,
      storedDocName,
      calculatedDocName,
    };

    // Track mismatches
    if (!docNumberMatch || !docNameMatch) {
      stats.mismatches.push(result);
    }

    // Log based on verbosity
    if (verbose || !docNumberMatch || !docNameMatch) {
      const icon = docNumberMatch && docNameMatch ? '✅' : '❌';
      console.log(`   ${icon} ${node.notion_page_id}`);

      if (!docNumberMatch) {
        console.log(`      Doc Number: "${storedDocNumber}" (stored) vs "${calculatedDocNumber}" (calculated)`);
      } else if (verbose) {
        console.log(`      Doc Number: "${storedDocNumber}" ✓`);
      }

      if (!docNameMatch) {
        console.log(
          `      Doc Name: "${storedDocName.substring(0, 50)}${storedDocName.length > 50 ? '...' : ''}" (stored) vs "${calculatedDocName.substring(0, 50)}${calculatedDocName.length > 50 ? '...' : ''}" (calculated)`,
        );
      } else if (verbose) {
        console.log(`      Doc Name: "${storedDocName.substring(0, 50)}${storedDocName.length > 50 ? '...' : ''}" ✓`);
      }
    }
  }

  console.log('');

  // Calculate execution time
  const endTime = Date.now();
  const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);

  // Calculate match percentages
  const docNumberMatchPercent = ((stats.docNumberMatches / stats.total) * 100).toFixed(2);
  const docNameMatchPercent = ((stats.docNameMatches / stats.total) * 100).toFixed(2);

  // Print summary
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(`  Total documents: ${stats.total}`);
  console.log('');
  console.log(`  Document Number:`);
  console.log(`    - Matches: ${stats.docNumberMatches} (${docNumberMatchPercent}%)`);
  console.log(`    - Mismatches: ${stats.docNumberMismatches}`);
  console.log('');
  console.log(`  Document Name:`);
  console.log(`    - Matches: ${stats.docNameMatches} (${docNameMatchPercent}%)`);
  console.log(`    - Mismatches: ${stats.docNameMismatches}`);
  console.log('');
  console.log(`  Duration: ${durationSeconds}s`);
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('');

  // Print detailed mismatches if not verbose (verbose already printed them)
  if (!verbose && stats.mismatches.length > 0) {
    console.log('❌ Mismatches found:');
    console.log('');
    stats.mismatches.forEach((mismatch) => {
      console.log(`   Page: ${mismatch.pageId}`);
      if (!mismatch.docNumberMatch) {
        console.log(`     Doc Number: "${mismatch.storedDocNumber}" vs "${mismatch.calculatedDocNumber}"`);
      }
      if (!mismatch.docNameMatch) {
        console.log(
          `     Doc Name: "${mismatch.storedDocName.substring(0, 50)}${mismatch.storedDocName.length > 50 ? '...' : ''}" vs "${mismatch.calculatedDocName.substring(0, 50)}${mismatch.calculatedDocName.length > 50 ? '...' : ''}"`,
        );
      }
      console.log('');
    });
  }

  // Final verdict
  const allMatch = stats.docNumberMismatches === 0 && stats.docNameMismatches === 0;

  if (allMatch) {
    console.log('✅ VERIFICATION PASSED: All stored values match calculated values!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Switch default from dynamic to stored values in code');
    console.log('  2. Remove migration mode toggle from sync UI');
    console.log('  3. Deploy to production');
    console.log('');
  } else {
    console.log('❌ VERIFICATION FAILED: Some values do not match!');
    console.log('');
    console.log('Possible causes:');
    console.log('  - Population script did not complete successfully');
    console.log('  - Notion import did not run after population');
    console.log('  - Data was modified in Notion after population');
    console.log('');
    console.log('Recommended actions:');
    console.log('  1. Re-run population script: npx tsx scripts/populate-standardized-notion-fields.ts');
    console.log('  2. Re-run Notion import: npx tsx scripts/import-notion-databases.ts');
    console.log('  3. Re-run this verification: npx tsx scripts/verify-standardized-fields.ts');
    console.log('');
  }

  // Exit with appropriate code
  process.exit(allMatch ? 0 : 1);
}

// Execute main function
main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(2);
});
