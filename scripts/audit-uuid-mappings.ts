#!/usr/bin/env -S npx tsx
/**
 * UUID Mapping Audit Script
 *
 * Compares UUID mappings in the Supabase database with UUIDs in the canonical
 * Atlas markdown file to identify data corruption and discrepancies.
 *
 * Reports:
 * - Atlas UUIDs in database that don't exist in markdown (random/orphaned)
 * - Markdown UUIDs that have no mapping (missing)
 * - Statistics and summary
 *
 * Usage:
 *   npx tsx scripts/audit-uuid-mappings.ts
 *   npx tsx scripts/audit-uuid-mappings.ts --verbose
 *   npx tsx scripts/audit-uuid-mappings.ts --fix-orphans  # Delete orphaned mappings
 *
 * @see docs/UUID_MAPPING.md
 */
import { loadAtlasMarkdownForSync } from '@/app/server/atlas/load-atlas-markdown-from-github';
import { supabase } from '@/app/server/services/supabase/supabase-client';
import { loadEnv } from './utils/load-env';

// Load environment variables first
loadEnv();

interface UuidMappingRow {
  notion_page_id: string;
  atlas_document_uuid: string;
}

interface AuditResult {
  totalMappingsInDb: number;
  totalUuidsInMarkdown: number;
  orphanedMappings: UuidMappingRow[]; // Atlas UUIDs in DB but not in markdown
  missingMappings: string[]; // UUIDs in markdown but not in DB
  duplicateNotionPageIds: Map<string, UuidMappingRow[]>; // Same Notion page ID with different Atlas UUIDs
}

/**
 * Load all UUID mappings from Supabase
 */
async function loadAllMappingsFromDb(): Promise<UuidMappingRow[]> {
  const allMappings: UuidMappingRow[] = [];
  let fromIdx = 0;
  const pageSize = 1000;

  console.log('Loading UUID mappings from Supabase...');

  while (true) {
    const { data, error } = await supabase()
      .from('uuid_mapping')
      .select('notion_page_id, atlas_document_uuid')
      .range(fromIdx, fromIdx + pageSize - 1);

    if (error) {
      throw new Error(`Failed to load UUID mappings: ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    allMappings.push(...data);

    if (data.length < pageSize) {
      break;
    }

    fromIdx += pageSize;
  }

  console.log(`  Loaded ${allMappings.length} mappings from database`);
  return allMappings;
}

/**
 * Extract all UUIDs from the Atlas markdown file
 */
async function extractUuidsFromMarkdown(): Promise<Set<string>> {
  console.log('Loading Atlas markdown file...');

  const markdown = await loadAtlasMarkdownForSync();
  const uuids = new Set<string>();

  // Match UUID comments: <!-- UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx -->
  const uuidPattern = /<!-- UUID: ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}) -->/gi;
  let match;

  while ((match = uuidPattern.exec(markdown)) !== null) {
    // Normalize to lowercase for consistent comparison
    uuids.add(match[1].toLowerCase());
  }

  console.log(`  Found ${uuids.size} UUIDs in markdown`);
  return uuids;
}

/**
 * Perform the audit comparison
 */
async function auditMappings(): Promise<AuditResult> {
  const dbMappings = await loadAllMappingsFromDb();
  const markdownUuids = await extractUuidsFromMarkdown();

  // Create sets for efficient lookup
  const dbAtlasUuids = new Set<string>();
  const notionPageIdToMappings = new Map<string, UuidMappingRow[]>();

  for (const mapping of dbMappings) {
    const normalizedAtlasUuid = mapping.atlas_document_uuid.toLowerCase();
    const normalizedNotionId = mapping.notion_page_id.toLowerCase();

    dbAtlasUuids.add(normalizedAtlasUuid);

    // Track potential duplicates by Notion page ID
    const existing = notionPageIdToMappings.get(normalizedNotionId) || [];
    existing.push(mapping);
    notionPageIdToMappings.set(normalizedNotionId, existing);
  }

  // Find orphaned mappings (Atlas UUIDs in DB but not in markdown)
  const orphanedMappings: UuidMappingRow[] = [];
  for (const mapping of dbMappings) {
    const normalizedAtlasUuid = mapping.atlas_document_uuid.toLowerCase();
    if (!markdownUuids.has(normalizedAtlasUuid)) {
      orphanedMappings.push(mapping);
    }
  }

  // Find missing mappings (UUIDs in markdown but not in DB)
  const missingMappings: string[] = [];
  for (const uuid of markdownUuids) {
    if (!dbAtlasUuids.has(uuid)) {
      missingMappings.push(uuid);
    }
  }

  // Find duplicate Notion page IDs (same page mapped to multiple Atlas UUIDs)
  const duplicateNotionPageIds = new Map<string, UuidMappingRow[]>();
  for (const [notionId, mappings] of notionPageIdToMappings) {
    if (mappings.length > 1) {
      duplicateNotionPageIds.set(notionId, mappings);
    }
  }

  return {
    totalMappingsInDb: dbMappings.length,
    totalUuidsInMarkdown: markdownUuids.size,
    orphanedMappings,
    missingMappings,
    duplicateNotionPageIds,
  };
}

/**
 * Delete orphaned mappings from the database
 */
async function deleteOrphanedMappings(orphanedMappings: UuidMappingRow[]): Promise<number> {
  if (orphanedMappings.length === 0) {
    console.log('No orphaned mappings to delete.');
    return 0;
  }

  console.log(`\nDeleting ${orphanedMappings.length} orphaned mappings...`);

  const atlasUuidsToDelete = orphanedMappings.map((m) => m.atlas_document_uuid);

  // Delete in batches of 100
  const batchSize = 100;
  let deletedCount = 0;

  for (let i = 0; i < atlasUuidsToDelete.length; i += batchSize) {
    const batch = atlasUuidsToDelete.slice(i, i + batchSize);
    const { error, count } = await supabase().from('uuid_mapping').delete().in('atlas_document_uuid', batch);

    if (error) {
      console.error(`  Error deleting batch ${i / batchSize + 1}: ${error.message}`);
    } else {
      deletedCount += count || batch.length;
      console.log(
        `  Deleted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(atlasUuidsToDelete.length / batchSize)}`,
      );
    }
  }

  console.log(`  Total deleted: ${deletedCount} mappings`);
  return deletedCount;
}

/**
 * Print the audit report
 */
function printReport(result: AuditResult, verbose: boolean): void {
  console.log('\n' + '='.repeat(60));
  console.log('UUID MAPPING AUDIT REPORT');
  console.log('='.repeat(60));

  console.log('\n📊 SUMMARY:');
  console.log(`  Total mappings in database: ${result.totalMappingsInDb}`);
  console.log(`  Total UUIDs in markdown:    ${result.totalUuidsInMarkdown}`);
  console.log('');
  console.log(`  ❌ Orphaned mappings (random UUIDs): ${result.orphanedMappings.length}`);
  console.log(`  ⚠️  Missing mappings:                 ${result.missingMappings.length}`);
  console.log(`  🔄 Duplicate Notion page IDs:        ${result.duplicateNotionPageIds.size}`);

  if (result.orphanedMappings.length > 0) {
    console.log('\n' + '-'.repeat(60));
    console.log('❌ ORPHANED MAPPINGS (Atlas UUIDs not in markdown):');
    console.log('   These are likely random UUIDs generated by the import bug.');
    console.log('-'.repeat(60));

    const toShow = verbose ? result.orphanedMappings : result.orphanedMappings.slice(0, 20);
    for (const mapping of toShow) {
      console.log(`  Atlas UUID:  ${mapping.atlas_document_uuid}`);
      console.log(`  Notion Page: ${mapping.notion_page_id}`);
      console.log('');
    }

    if (!verbose && result.orphanedMappings.length > 20) {
      console.log(`  ... and ${result.orphanedMappings.length - 20} more (use --verbose to see all)`);
    }
  }

  if (result.missingMappings.length > 0) {
    console.log('\n' + '-'.repeat(60));
    console.log('⚠️  MISSING MAPPINGS (Markdown UUIDs not in database):');
    console.log('   These documents have no Notion page mapping.');
    console.log('-'.repeat(60));

    const toShow = verbose ? result.missingMappings : result.missingMappings.slice(0, 20);
    for (const uuid of toShow) {
      console.log(`  ${uuid}`);
    }

    if (!verbose && result.missingMappings.length > 20) {
      console.log(`  ... and ${result.missingMappings.length - 20} more (use --verbose to see all)`);
    }
  }

  if (result.duplicateNotionPageIds.size > 0) {
    console.log('\n' + '-'.repeat(60));
    console.log('🔄 DUPLICATE NOTION PAGE IDS:');
    console.log('   Same Notion page mapped to multiple Atlas UUIDs.');
    console.log('-'.repeat(60));

    for (const [notionId, mappings] of result.duplicateNotionPageIds) {
      console.log(`  Notion Page: ${notionId}`);
      for (const mapping of mappings) {
        console.log(`    → Atlas UUID: ${mapping.atlas_document_uuid}`);
      }
      console.log('');
    }
  }

  // Health assessment
  console.log('\n' + '='.repeat(60));
  console.log('HEALTH ASSESSMENT:');
  console.log('='.repeat(60));

  const orphanedPercent = (result.orphanedMappings.length / result.totalMappingsInDb) * 100;
  const missingPercent = (result.missingMappings.length / result.totalUuidsInMarkdown) * 100;

  if (result.orphanedMappings.length === 0 && result.missingMappings.length === 0) {
    console.log('✅ UUID mappings are healthy! All mappings match markdown UUIDs.');
  } else {
    if (orphanedPercent > 50) {
      console.log(`🚨 CRITICAL: ${orphanedPercent.toFixed(1)}% of mappings are orphaned (random UUIDs).`);
      console.log('   This indicates severe data corruption from the import bug.');
      console.log('   Consider running with --fix-orphans to delete orphaned mappings,');
      console.log('   then re-run the full sync.');
    } else if (orphanedPercent > 10) {
      console.log(`⚠️  WARNING: ${orphanedPercent.toFixed(1)}% of mappings are orphaned.`);
      console.log('   Run with --fix-orphans to clean up, then re-sync affected pages.');
    }

    if (missingPercent > 10) {
      console.log(`⚠️  WARNING: ${missingPercent.toFixed(1)}% of markdown UUIDs have no mapping.`);
      console.log('   These documents may not have been synced to Notion yet.');
    }
  }

  console.log('');
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose') || args.includes('-v');
  const fixOrphans = args.includes('--fix-orphans');

  try {
    const result = await auditMappings();
    printReport(result, verbose);

    if (fixOrphans) {
      await deleteOrphanedMappings(result.orphanedMappings);
    } else if (result.orphanedMappings.length > 0) {
      console.log('\n💡 TIP: Run with --fix-orphans to delete orphaned mappings.\n');
    }

    // Exit with error code if there are issues
    if (result.orphanedMappings.length > 0 || result.duplicateNotionPageIds.size > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Error during audit:', error);
    process.exit(1);
  }
}

main();
