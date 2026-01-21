#!/usr/bin/env tsx
/**
 * Swap Title Property to Show Document Names
 *
 * This script renames properties to make "Document Title" the title property in all
 * Atlas databases. After running this script, page titles in Notion will display
 * document names instead of document numbers.
 *
 * ⚠️  WARNING: This is an IRREVERSIBLE change. Only run after migration is verified.
 *
 * The script performs these steps in sequence:
 * 1. Rename "Document Title" (rich_text) to "Document Title (deprecated)"
 * 2. Rename the current title property to "Document Title"
 *
 * AFTER RUNNING THIS SCRIPT:
 *   1. Run: npx tsx scripts/populate-standardized-notion-fields.ts
 *      This will populate the renamed title property with document names.
 *   2. Manually hide "Document Title (deprecated)" in each Notion database view
 *
 * Usage:
 *   npx tsx scripts/swap-title-property.ts
 *   npx tsx scripts/swap-title-property.ts --dry-run  # Preview changes without applying
 *
 * Related: docs/action-plans/NOTION_PROPERTY_STANDARDIZATION_ACTION_PLAN.md
 */
import { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import { ATLAS_DATABASE_ID_MAP, ATLAS_DATABASE_NAMES } from '@/app/server/atlas/constants';
import { notion } from '@/app/server/services/notion/notion-client';
import { loadEnv } from './utils/load-env';

// Property names
const STANDARDIZED_DOCUMENT_TITLE = 'Document Title';
const DEPRECATED_DOCUMENT_TITLE = 'Document Title (deprecated)';

// Map of database name to its current title property name
const CURRENT_TITLE_PROPERTIES: Record<AtlasDatabaseName, string> = {
  Scopes: 'Doc No',
  Articles: 'Doc No',
  'Sections & Primary Docs': 'Doc No (or Temp Name)',
  'Agent Scope Database': 'Document Name',
  Annotations: 'Doc No',
  Tenets: 'Doc No (or Temp Name)',
  'Active Data': 'Doc No',
  Scenarios: 'Doc No (or Temp Name)',
  'Scenario Variations': 'Doc No',
  'Needed Research': 'Doc No',
};

interface SwapResult {
  databaseName: AtlasDatabaseName;
  databaseId: string;
  step1Success: boolean; // Rename Document Title → Document Title (deprecated)
  step2Success: boolean; // Rename current title → Document Title
  currentTitleProperty: string;
  error?: string;
  skipped?: string;
}

/**
 * Checks if a property exists in a Notion database
 */
async function getExistingProperties(databaseId: string): Promise<Set<string>> {
  try {
    const database = await notion().databases.retrieve({ database_id: databaseId });
    return new Set(Object.keys(database.properties));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to retrieve database ${databaseId}: ${errorMessage}`);
  }
}

/**
 * Renames a property in a Notion database
 */
async function renameProperty(databaseId: string, oldName: string, newName: string): Promise<void> {
  await notion().databases.update({
    database_id: databaseId,
    properties: {
      [oldName]: {
        name: newName,
      },
    },
  });
}

/**
 * Performs the title property swap for a single database
 */
async function swapTitleProperty(
  databaseName: AtlasDatabaseName,
  databaseId: string,
  dryRun: boolean,
): Promise<SwapResult> {
  const currentTitleProperty = CURRENT_TITLE_PROPERTIES[databaseName];

  const result: SwapResult = {
    databaseName,
    databaseId,
    step1Success: false,
    step2Success: false,
    currentTitleProperty,
  };

  try {
    // Get existing properties
    const existingProperties = await getExistingProperties(databaseId);

    // Pre-flight checks
    if (!existingProperties.has(STANDARDIZED_DOCUMENT_TITLE)) {
      result.skipped = `"${STANDARDIZED_DOCUMENT_TITLE}" property not found - run add-normalized-notion-fields first`;
      return result;
    }

    if (existingProperties.has(DEPRECATED_DOCUMENT_TITLE)) {
      result.skipped = `"${DEPRECATED_DOCUMENT_TITLE}" already exists - swap may have already been performed`;
      return result;
    }

    if (!existingProperties.has(currentTitleProperty)) {
      result.skipped = `Current title property "${currentTitleProperty}" not found`;
      return result;
    }

    if (dryRun) {
      console.log(`   [DRY RUN] Would rename: "${STANDARDIZED_DOCUMENT_TITLE}" → "${DEPRECATED_DOCUMENT_TITLE}"`);
      console.log(`   [DRY RUN] Would rename: "${currentTitleProperty}" → "${STANDARDIZED_DOCUMENT_TITLE}"`);
      result.step1Success = true;
      result.step2Success = true;
      return result;
    }

    // Step 1: Rename "Document Title" → "Document Title (deprecated)"
    console.log(`   Step 1: Renaming "${STANDARDIZED_DOCUMENT_TITLE}" → "${DEPRECATED_DOCUMENT_TITLE}"`);
    await renameProperty(databaseId, STANDARDIZED_DOCUMENT_TITLE, DEPRECATED_DOCUMENT_TITLE);
    result.step1Success = true;

    // Step 2: Rename current title property → "Document Title"
    console.log(`   Step 2: Renaming "${currentTitleProperty}" → "${STANDARDIZED_DOCUMENT_TITLE}"`);
    await renameProperty(databaseId, currentTitleProperty, STANDARDIZED_DOCUMENT_TITLE);
    result.step2Success = true;

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.error = errorMessage;
    return result;
  }
}

/**
 * Main function
 */
async function main() {
  const startTime = Date.now();
  const dryRun = process.argv.includes('--dry-run');

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
  console.log('  Swap Title Property to Show Document Names');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(`  Started at: ${dateTimeString}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Mode: ${dryRun ? '🔍 DRY RUN (no changes will be made)' : '⚡ LIVE (changes will be applied)'}`);
  console.log('');

  if (!dryRun) {
    console.log('  ⚠️  WARNING: This is an IRREVERSIBLE operation!');
    console.log('');
    console.log('  This script will:');
    console.log(`    1. Rename "${STANDARDIZED_DOCUMENT_TITLE}" → "${DEPRECATED_DOCUMENT_TITLE}"`);
    console.log(`    2. Rename current title property → "${STANDARDIZED_DOCUMENT_TITLE}"`);
    console.log('');
    console.log('  After completion, run the populate script to fill title with document names.');
    console.log('');
  }
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('');

  const results: SwapResult[] = [];
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  // Process each database
  for (const databaseName of ATLAS_DATABASE_NAMES) {
    const databaseId = ATLAS_DATABASE_ID_MAP[databaseName];

    console.log(`📦 Processing: ${databaseName}`);
    console.log(`   Database ID: ${databaseId}`);
    console.log(`   Current title property: "${CURRENT_TITLE_PROPERTIES[databaseName]}"`);

    const result = await swapTitleProperty(databaseName, databaseId, dryRun);
    results.push(result);

    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
      errorCount++;
    } else if (result.skipped) {
      console.log(`   ⏭️  Skipped: ${result.skipped}`);
      skippedCount++;
    } else if (result.step1Success && result.step2Success) {
      console.log(`   ✅ Successfully swapped title property`);
      successCount++;
    }

    console.log('');
  }

  // Calculate execution time
  const endTime = Date.now();
  const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);

  // Print summary
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(`  Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  Databases processed: ${results.length}`);
  console.log(`  Successful: ${successCount}`);
  console.log(`  Skipped: ${skippedCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Duration: ${durationSeconds} seconds`);
  console.log('═══════════════════════════════════════════════════════════════════════════════');

  if (!dryRun && successCount > 0) {
    console.log('');
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                                                                               ║');
    console.log('║   ✅ NEXT STEPS                                                              ║');
    console.log('║                                                                               ║');
    console.log('║   1. Run the populate script to fill title with document names:             ║');
    console.log('║      npx tsx scripts/populate-standardized-notion-fields.ts                 ║');
    console.log('║                                                                               ║');
    console.log('║   2. Manually hide "Document Title (deprecated)" in each Notion view        ║');
    console.log('║                                                                               ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');
    console.log('');
  }

  if (dryRun) {
    console.log('');
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
    console.log('║                                                                               ║');
    console.log('║   🔍 DRY RUN COMPLETE                                                        ║');
    console.log('║                                                                               ║');
    console.log('║   No changes were made. To apply changes, run without --dry-run:            ║');
    console.log('║   npx tsx scripts/swap-title-property.ts                                    ║');
    console.log('║                                                                               ║');
    console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');
    console.log('');
  }

  // Exit with error code if there were failures
  if (errorCount > 0) {
    process.exit(1);
  }
}

// Execute main function
main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
