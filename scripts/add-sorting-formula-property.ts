#!/usr/bin/env tsx
/**
 * Add Sorting Formula Property to All Atlas Databases
 *
 * This script adds a "Document Number (Sortable)" formula property to all Atlas databases
 * in Notion. The formula pads single-digit numbers to enable correct lexicographic sorting
 * (e.g., "A.1.2" → "A.01.02").
 *
 * The script is safe to run multiple times - it checks if the property already exists
 * before attempting to add it.
 *
 * Usage:
 *   npx tsx scripts/add-sorting-formula-property.ts
 *
 * MANUAL FOLLOW-UP REQUIRED:
 *   After running this script, you must manually:
 *   1. Hide the "Document Number (Sortable)" property in each Notion database view
 *   2. Set the database view sorting to use this formula property (ascending)
 *
 * Related: docs/action-plans/NOTION_PROPERTY_STANDARDIZATION_ACTION_PLAN.md
 */
import { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import { ATLAS_DATABASE_ID_MAP, ATLAS_DATABASE_NAMES } from '@/app/server/atlas/constants';
import { notion } from '@/app/server/services/notion/notion-client';
import { loadEnv } from './utils/load-env';

// Property name for the sorting formula
const SORTING_FORMULA_PROPERTY = 'Document Number (Sortable)';

// Formula that pads single-digit numbers for natural sorting
// e.g., "A.1.2" → "A.01.02", "A.1.12" → "A.01.12", "A.10.3" → "A.10.03"
const SORTING_FORMULA = `replaceAll(replaceAll(join(format(prop("Document Number")), ""), "\\\\.([0-9])\\\\b", ".0$1"), "\\\\.([0-9])\\\\.", ".0$1.")`;

interface PropertyAddResult {
  databaseName: AtlasDatabaseName;
  databaseId: string;
  propertyAdded: boolean;
  propertyAlreadyExists: boolean;
  error?: string;
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
 * Adds the sorting formula property to a Notion database if it doesn't already exist
 */
async function addFormulaToDatabase(databaseName: AtlasDatabaseName, databaseId: string): Promise<PropertyAddResult> {
  const result: PropertyAddResult = {
    databaseName,
    databaseId,
    propertyAdded: false,
    propertyAlreadyExists: false,
  };

  try {
    // Get existing properties
    const existingProperties = await getExistingProperties(databaseId);

    if (existingProperties.has(SORTING_FORMULA_PROPERTY)) {
      result.propertyAlreadyExists = true;
      return result;
    }

    // Add the formula property
    await notion().databases.update({
      database_id: databaseId,
      properties: {
        [SORTING_FORMULA_PROPERTY]: {
          formula: {
            expression: SORTING_FORMULA,
          },
        },
      },
    });

    result.propertyAdded = true;
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.error = errorMessage;
    return result;
  }
}

/**
 * Main function to add sorting formula to all Atlas databases
 */
async function main() {
  const startTime = Date.now();

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
  console.log('  Add Sorting Formula Property to All Atlas Databases');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(`  Started at: ${dateTimeString}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('');
  console.log(`  Property to add: ${SORTING_FORMULA_PROPERTY} (formula)`);
  console.log('');
  console.log('  Formula pads single-digit numbers for natural sorting:');
  console.log('    A.1.2   → A.01.02');
  console.log('    A.1.12  → A.01.12');
  console.log('    A.10.3  → A.10.03');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('');

  const results: PropertyAddResult[] = [];
  let successCount = 0;
  let errorCount = 0;

  // Process each database
  for (const databaseName of ATLAS_DATABASE_NAMES) {
    const databaseId = ATLAS_DATABASE_ID_MAP[databaseName];

    console.log(`📦 Processing: ${databaseName}`);
    console.log(`   Database ID: ${databaseId}`);

    const result = await addFormulaToDatabase(databaseName, databaseId);
    results.push(result);

    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
      errorCount++;
    } else if (result.propertyAdded) {
      console.log(`   ✅ Added: ${SORTING_FORMULA_PROPERTY}`);
      successCount++;
    } else if (result.propertyAlreadyExists) {
      console.log(`   ⏭️  Already exists: ${SORTING_FORMULA_PROPERTY}`);
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
  console.log(`  Databases processed: ${results.length}`);
  console.log(`  Successful: ${successCount}`);
  console.log(`  Errors: ${errorCount}`);
  console.log(`  Duration: ${durationSeconds} seconds`);
  console.log('');

  const propertiesAdded = results.filter((r) => r.propertyAdded).length;
  const propertiesExisted = results.filter((r) => r.propertyAlreadyExists).length;

  console.log(`  ${SORTING_FORMULA_PROPERTY}:`);
  console.log(`    - Added: ${propertiesAdded}`);
  console.log(`    - Already existed: ${propertiesExisted}`);
  console.log('═══════════════════════════════════════════════════════════════════════════════');

  // Print manual follow-up reminder
  console.log('');
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                               ║');
  console.log('║   ⚠️  MANUAL FOLLOW-UP REQUIRED                                               ║');
  console.log('║                                                                               ║');
  console.log('║   After running this script, you must manually:                              ║');
  console.log('║                                                                               ║');
  console.log('║   1. Hide the "Document Number (Sortable)" property in each database view    ║');
  console.log('║   2. Set the database view sorting to use this formula property (ascending)  ║');
  console.log('║                                                                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');
  console.log('');

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
