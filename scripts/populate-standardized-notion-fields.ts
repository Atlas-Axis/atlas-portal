#!/usr/bin/env tsx
/**
 * Populate Standardized Notion Fields
 *
 * This script populates the new standardized "Document Number" and "Document Title"
 * fields in all Atlas databases in Notion by writing the dynamically calculated values
 * from the tree building process.
 *
 * This is Phase 1 of the property standardization migration. After running this script:
 * 1. Run the Notion to Supabase import to pull values into Supabase
 * 2. Run the verification script to confirm stored values match calculated values
 * 3. Switch the default from dynamic to stored values
 *
 * Features:
 * - Builds Atlas tree from Supabase data (reuses existing tree building logic)
 * - Extracts calculated document numbers and names from tree nodes
 * - Updates Notion pages via API with new standardized field values
 * - Tracks progress and supports resumption via checkpoint file
 * - Logs all operations with success/failure status
 * - Respects Notion API rate limits
 *
 * Usage:
 *   npx tsx scripts/populate-standardized-notion-fields.ts [--resume] [--dry-run]
 *
 * Options:
 *   --resume    Resume from last checkpoint (if available)
 *   --dry-run   Show what would be updated without making changes
 *
 * Related: docs/action-plans/NOTION_PROPERTY_STANDARDIZATION_ACTION_PLAN.md
 */
import * as fs from 'fs';
import * as path from 'path';
import { STANDARDIZED_DOCUMENT_NUMBER, STANDARDIZED_DOCUMENT_TITLE } from '@/app/server/atlas/constants';
import { loadUuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import { buildNotionAtlasTree } from '@/app/server/atlas/notion-tree/atlas-tree-builder';
import { NotionAtlasTreeNode } from '@/app/server/atlas/notion-tree/atlas-tree-types';
import { notion } from '@/app/server/services/notion/notion-client';
import { loadNotionDatabasePagesFromSupabase } from '@/app/server/services/supabase/load-notion-database-pages-from-supabase';
import { loadEnv } from './utils/load-env';

// Checkpoint file to track progress
const CHECKPOINT_FILE = path.join(__dirname, '.populate-checkpoint.json');

interface Checkpoint {
  lastProcessedPageId: string;
  processedCount: number;
  timestamp: string;
}

interface PopulationResult {
  pageId: string;
  docNumber: string;
  docName: string;
  success: boolean;
  error?: string;
}

interface PopulationStats {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  results: PopulationResult[];
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
 * Saves checkpoint to file
 */
function saveCheckpoint(checkpoint: Checkpoint): void {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

/**
 * Loads checkpoint from file (if exists)
 */
function loadCheckpoint(): Checkpoint | null {
  if (!fs.existsSync(CHECKPOINT_FILE)) {
    return null;
  }
  try {
    const data = fs.readFileSync(CHECKPOINT_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.warn('Failed to load checkpoint file:', error);
    return null;
  }
}

/**
 * Deletes checkpoint file
 */
function deleteCheckpoint(): void {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    fs.unlinkSync(CHECKPOINT_FILE);
  }
}

/**
 * Updates a single Notion page with standardized field values
 */
async function updateNotionPage(
  pageId: string,
  docNumber: string,
  docName: string,
  dryRun: boolean,
): Promise<PopulationResult> {
  const result: PopulationResult = {
    pageId,
    docNumber,
    docName,
    success: false,
  };

  try {
    if (dryRun) {
      // In dry-run mode, just simulate success
      result.success = true;
      return result;
    }

    // Update the page with new standardized fields
    await notion().pages.update({
      page_id: pageId,
      properties: {
        [STANDARDIZED_DOCUMENT_NUMBER]: {
          rich_text: [{ text: { content: docNumber || '' } }],
        },
        [STANDARDIZED_DOCUMENT_TITLE]: {
          rich_text: [{ text: { content: docName || '' } }],
        },
      },
    });

    result.success = true;
  } catch (error) {
    result.success = false;
    result.error = error instanceof Error ? error.message : String(error);
  }

  return result;
}

/**
 * Main function
 */
async function main() {
  const startTime = Date.now();

  // Parse command line arguments
  const args = process.argv.slice(2);
  const shouldResume = args.includes('--resume');
  const dryRun = args.includes('--dry-run');

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
  console.log('  Populate Standardized Notion Fields');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(`  Started at: ${dateTimeString}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  if (dryRun) {
    console.log(`  Mode: DRY RUN (no changes will be made)`);
  }
  console.log('');
  console.log(`  Standardized fields to populate:`);
  console.log(`    - ${STANDARDIZED_DOCUMENT_NUMBER}`);
  console.log(`    - ${STANDARDIZED_DOCUMENT_TITLE}`);
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('');

  // Load checkpoint if resuming
  let checkpoint: Checkpoint | null = null;
  if (shouldResume) {
    checkpoint = loadCheckpoint();
    if (checkpoint) {
      console.log(`📍 Resuming from checkpoint:`);
      console.log(`   Last processed: ${checkpoint.lastProcessedPageId}`);
      console.log(`   Processed count: ${checkpoint.processedCount}`);
      console.log(`   Checkpoint time: ${checkpoint.timestamp}`);
      console.log('');
    } else {
      console.log('⚠️  No checkpoint found, starting from beginning');
      console.log('');
    }
  }

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
  console.log(`   Total nodes to process: ${allNodes.length}`);
  console.log('');

  // Filter nodes if resuming
  let nodesToProcess = allNodes;
  let skippedCount = 0;
  if (checkpoint) {
    const checkpointIndex = allNodes.findIndex((node) => node.notion_page_id === checkpoint.lastProcessedPageId);
    if (checkpointIndex >= 0) {
      nodesToProcess = allNodes.slice(checkpointIndex + 1);
      skippedCount = checkpointIndex + 1;
      console.log(`⏭️  Skipping ${skippedCount} already processed nodes`);
      console.log('');
    }
  }

  // Step 5: Update Notion pages
  console.log('🔄 Step 5: Updating Notion pages with standardized fields...');
  console.log(`   Processing ${nodesToProcess.length} nodes...`);
  console.log('');

  const stats: PopulationStats = {
    total: nodesToProcess.length,
    successful: 0,
    failed: 0,
    skipped: skippedCount,
    results: [],
  };

  let processedCount = skippedCount;

  for (let i = 0; i < nodesToProcess.length; i++) {
    const node = nodesToProcess[i];
    const docNumber = node.generatedDocID || '';
    const docName = node.generatedDocName || '';

    // Skip nodes without calculated values
    if (!docNumber && !docName) {
      console.log(`   ⏭️  [${i + 1}/${nodesToProcess.length}] Skipping ${node.notion_page_id} (no calculated values)`);
      stats.skipped++;
      continue;
    }

    // Update the page
    const result = await updateNotionPage(node.notion_page_id, docNumber, docName, dryRun);
    stats.results.push(result);

    if (result.success) {
      stats.successful++;
      console.log(
        `   ✅ [${i + 1}/${nodesToProcess.length}] ${node.notion_page_id}: "${docNumber}" / "${docName.substring(0, 50)}${docName.length > 50 ? '...' : ''}"`,
      );
    } else {
      stats.failed++;
      console.log(`   ❌ [${i + 1}/${nodesToProcess.length}] ${node.notion_page_id}: ${result.error}`);
    }

    processedCount++;

    // Save checkpoint every 100 pages
    if (processedCount % 100 === 0 && !dryRun) {
      saveCheckpoint({
        lastProcessedPageId: node.notion_page_id,
        processedCount,
        timestamp: new Date().toISOString(),
      });
    }

    // Rate limiting: ~3 requests per second (Notion API limit)
    if (!dryRun && i < nodesToProcess.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }

  console.log('');

  // Calculate execution time
  const endTime = Date.now();
  const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);
  const durationMinutes = (parseFloat(durationSeconds) / 60).toFixed(2);

  // Print summary
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(`  Total nodes: ${allNodes.length}`);
  console.log(`  Processed: ${nodesToProcess.length}`);
  console.log(`  Skipped (checkpoint): ${skippedCount}`);
  console.log(`  Skipped (no values): ${stats.skipped - skippedCount}`);
  console.log(`  Successful: ${stats.successful}`);
  console.log(`  Failed: ${stats.failed}`);
  console.log(`  Duration: ${durationSeconds}s (${durationMinutes} minutes)`);
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('');

  // Print failures if any
  if (stats.failed > 0) {
    console.log('❌ Failed updates:');
    stats.results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`   ${r.pageId}: ${r.error}`);
      });
    console.log('');
  }

  // Delete checkpoint on successful completion
  if (!dryRun && stats.failed === 0) {
    deleteCheckpoint();
    console.log('✅ Population completed successfully! Checkpoint file deleted.');
  } else if (!dryRun && stats.failed > 0) {
    console.log('⚠️  Some updates failed. Run with --resume to retry failed pages.');
  }

  console.log('');
  console.log('Next steps:');
  console.log('  1. Run Notion to Supabase import: npx tsx scripts/import-notion-databases.ts');
  console.log('  2. Run verification script: npx tsx scripts/verify-standardized-fields.ts');
  console.log('');

  // Exit with error code if there were failures
  if (stats.failed > 0) {
    process.exit(1);
  }
}

// Execute main function
main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
