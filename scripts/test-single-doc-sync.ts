#!/usr/bin/env -S npx tsx
/**
 * Single Document Sync Test Script
 *
 * Tests the sync flow for a single document by Atlas UUID or document number.
 * This enables fast debugging of UUID mapping issues without running a full sync.
 *
 * Usage:
 *   npx tsx scripts/test-single-doc-sync.ts --uuid <atlas-uuid>
 *   npx tsx scripts/test-single-doc-sync.ts --doc-no <document-number>
 *   npx tsx scripts/test-single-doc-sync.ts --uuid <atlas-uuid> --dry-run
 *
 * Options:
 *   --uuid <uuid>       Filter to sync only the document with this Atlas UUID
 *   --doc-no <number>   Filter to sync only the document with this number (e.g., A.1.2.3)
 *   --dry-run           Show what would be synced without actually syncing
 *   --verbose           Show detailed trace logs
 *
 * @see docs/MARKDOWN_TO_NOTION_SYNC.md
 */
import { AtlasDocumentChange, GroupedAtlasChanges } from '@/app/server/atlas/diff/atlas-diff';
import { diffAtlasScopeTreeLists } from '@/app/server/atlas/diff/markdown-supabase-diff';
import { loadUuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import { verifyUuidMapping } from '@/app/server/services/supabase/uuid-mapping-service';
import { loadEnv } from './utils/load-env';

// Load environment variables first
loadEnv();

/**
 * Flatten all change arrays into a single array.
 */
function flattenChanges(grouped: GroupedAtlasChanges): AtlasDocumentChange[] {
  return [...grouped.added, ...grouped.deleted, ...grouped.changed, ...grouped.parent_changed];
}

/**
 * Get total count of all changes.
 */
function getTotalChangeCount(grouped: GroupedAtlasChanges): number {
  return grouped.added.length + grouped.deleted.length + grouped.changed.length + grouped.parent_changed.length;
}

interface TestOptions {
  uuid?: string;
  docNo?: string;
  dryRun: boolean;
  verbose: boolean;
}

function parseArgs(): TestOptions {
  const args = process.argv.slice(2);
  const options: TestOptions = {
    dryRun: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--uuid' && args[i + 1]) {
      options.uuid = args[i + 1];
      i++;
    } else if (arg === '--doc-no' && args[i + 1]) {
      options.docNo = args[i + 1];
      i++;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    }
  }

  return options;
}

function printUsage(): void {
  console.log(`
Usage:
  npx tsx scripts/test-single-doc-sync.ts --uuid <atlas-uuid>
  npx tsx scripts/test-single-doc-sync.ts --doc-no <document-number>

Options:
  --uuid <uuid>       Filter to sync only the document with this Atlas UUID
  --doc-no <number>   Filter to sync only the document with this number (e.g., A.1.2.3)
  --dry-run           Show what would be synced without actually syncing
  --verbose           Show detailed trace logs

Examples:
  npx tsx scripts/test-single-doc-sync.ts --uuid 305e2bd6-a594-4aec-8713-adbe7bc87120
  npx tsx scripts/test-single-doc-sync.ts --doc-no A.1.2.3 --verbose
  npx tsx scripts/test-single-doc-sync.ts --uuid abc123... --dry-run
`);
}

function findMatchingChanges(changes: AtlasDocumentChange[], options: TestOptions): AtlasDocumentChange[] {
  if (options.uuid) {
    const targetUuid = options.uuid.toLowerCase();
    return changes.filter((c) => c.uuid?.toLowerCase() === targetUuid);
  }

  if (options.docNo) {
    const targetDocNo = options.docNo.toLowerCase();
    return changes.filter((c) => {
      const docNo = c.newValues?.doc_no || c.oldValues?.doc_no;
      return docNo?.toLowerCase() === targetDocNo;
    });
  }

  return [];
}

async function main(): Promise<void> {
  const options = parseArgs();

  if (!options.uuid && !options.docNo) {
    console.error('Error: Must specify either --uuid or --doc-no');
    printUsage();
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('SINGLE DOCUMENT SYNC TEST');
  console.log('='.repeat(60));
  console.log('');
  console.log(`Target: ${options.uuid ? `UUID: ${options.uuid}` : `Doc #: ${options.docNo}`}`);
  console.log(`Mode: ${options.dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log('');

  try {
    // Step 1: Load diff
    console.log('Step 1: Loading diff between Markdown and Supabase...');
    const diffResult = await diffAtlasScopeTreeLists();
    const totalChanges = getTotalChangeCount(diffResult.changes);
    console.log(`  Found ${totalChanges} total changes`);
    console.log(`    - Added: ${diffResult.changes.added.length}`);
    console.log(`    - Deleted: ${diffResult.changes.deleted.length}`);
    console.log(`    - Changed: ${diffResult.changes.changed.length}`);
    console.log(`    - Parent Changed: ${diffResult.changes.parent_changed.length}`);

    // Step 2: Find matching changes
    console.log('\nStep 2: Finding matching document...');
    const allChanges = flattenChanges(diffResult.changes);
    const matchingChanges = findMatchingChanges(allChanges, options);

    if (matchingChanges.length === 0) {
      console.log('  No matching changes found!');
      console.log('');
      console.log('  This could mean:');
      console.log('  - The document is already in sync');
      console.log("  - The UUID/doc number doesn't exist in the diff");
      console.log("  - There's a typo in the UUID/doc number");

      // Try to find the document in the source trees
      const targetUuid = options.uuid?.toLowerCase();

      let foundInNew = false;
      let foundInOld = false;

      if (targetUuid) {
        foundInNew = diffResult.newIdsToDocuments.has(targetUuid);
        foundInOld = diffResult.originalIdsToDocuments.has(targetUuid);
      } else if (options.docNo) {
        // Search by doc_no instead of UUID
        const targetDocNo = options.docNo.toLowerCase();
        for (const doc of diffResult.newIdsToDocuments.values()) {
          if (doc.doc_no.toLowerCase() === targetDocNo) {
            foundInNew = true;
            break;
          }
        }
        for (const doc of diffResult.originalIdsToDocuments.values()) {
          if (doc.doc_no.toLowerCase() === targetDocNo) {
            foundInOld = true;
            break;
          }
        }
      }

      console.log('');
      console.log('  Document search:');
      console.log(`    In Markdown (new): ${foundInNew ? 'YES' : 'NO'}`);
      console.log(`    In Supabase (old): ${foundInOld ? 'YES' : 'NO'}`);

      if (foundInNew && foundInOld) {
        console.log('');
        console.log("  Document exists in both sources - it's in sync.");
      } else if (!foundInNew && !foundInOld) {
        console.log('');
        console.log('  Document not found in either source - check the UUID/doc number.');
      }

      process.exit(0);
    }

    console.log(`  Found ${matchingChanges.length} matching change(s)`);
    console.log('');

    // Step 3: Display change details
    console.log('Step 3: Change details');
    console.log('-'.repeat(60));

    for (const change of matchingChanges) {
      console.log(`  Change Type: ${change.changeType}`);
      console.log(`  UUID: ${change.uuid}`);
      console.log(`  Doc #: ${change.newValues?.doc_no || change.oldValues?.doc_no || 'N/A'}`);
      console.log(`  Name: ${change.newValues?.name || change.oldValues?.name || 'N/A'}`);
      console.log(`  Type: ${change.newValues?.type || change.oldValues?.type || 'N/A'}`);

      if (change.changeType === 'changed' && change.oldValues && change.newValues) {
        // Compute which fields changed
        const changedFields: string[] = [];
        if (change.oldValues.type !== change.newValues.type) changedFields.push('type');
        if (change.oldValues.doc_no !== change.newValues.doc_no) changedFields.push('doc_no');
        if (change.oldValues.name !== change.newValues.name) changedFields.push('name');
        if (change.oldValues.content !== change.newValues.content) changedFields.push('content');
        if (changedFields.length > 0) {
          console.log(`  Changed Fields: ${changedFields.join(', ')}`);
        }
      }

      if (change.changeType === 'parent_changed') {
        console.log(`  Old Ancestry: ${change.oldAncestry?.join(' → ') || 'N/A'}`);
        console.log(`  New Ancestry: ${change.newAncestry?.join(' → ') || 'N/A'}`);
      }

      console.log('');
    }

    // Step 4: Check current UUID mapping state
    console.log('Step 4: Current UUID mapping state');
    console.log('-'.repeat(60));

    const uuidMappings = await loadUuidMappings();

    for (const change of matchingChanges) {
      if (!change.uuid) continue;

      const normalizedUuid = change.uuid.toLowerCase();
      const notionPageId = uuidMappings.atlasUUIDsToNotionPageIds.get(normalizedUuid);

      console.log(`  Atlas UUID: ${change.uuid}`);
      if (notionPageId) {
        console.log(`  → Mapped to Notion page: ${notionPageId}`);

        // Verify in database
        const dbMapping = await verifyUuidMapping(notionPageId);
        if (dbMapping) {
          console.log(`  → DB verification: ${dbMapping.atlas_document_uuid}`);
          if (dbMapping.atlas_document_uuid.toLowerCase() !== normalizedUuid) {
            console.log(`  ❌ MISMATCH! DB has different Atlas UUID!`);
          } else {
            console.log(`  ✓ DB mapping matches`);
          }
        } else {
          console.log(`  ❌ DB verification failed - mapping not found in database!`);
        }
      } else {
        console.log(`  → No Notion page mapping found (document needs to be created)`);
      }
      console.log('');
    }

    // Step 5: Dry run or actual sync
    if (options.dryRun) {
      console.log('Step 5: DRY RUN - Not making any changes');
      console.log('-'.repeat(60));
      console.log('  Would sync the following:');
      for (const change of matchingChanges) {
        console.log(`    - ${change.changeType}: ${change.uuid}`);
      }
    } else {
      console.log('Step 5: Ready to sync');
      console.log('-'.repeat(60));
      console.log('  To actually sync this document, use the /atlas/sync UI');
      console.log('  or implement the sync logic here.');
      console.log('');
      console.log('  For now, this script only shows the diagnostic information.');
      console.log('  Use the --dry-run flag to suppress this message.');
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('TEST COMPLETE');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('Error during test:', error);
    process.exit(1);
  }
}

main();
