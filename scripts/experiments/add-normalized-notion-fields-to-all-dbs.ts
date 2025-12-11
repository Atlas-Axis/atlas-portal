#!/usr/bin/env tsx
/**
 * Add Normalized Notion Fields to All Atlas Databases
 *
 * This script adds new standardized properties to all Atlas databases in Notion:
 * - Document Number (rich_text) - Standardized field for document numbers like "A.1.3.4.12"
 * - Document Title (rich_text) - Standardized field for document names
 *
 * These new fields will eventually replace the inconsistent property names across databases
 * (e.g., "Doc No", "Doc No (or Temp Name)", "Formal Doc ID" for document numbers).
 *
 * The script is safe to run multiple times - it checks if properties already exist
 * before attempting to add them.
 *
 * Usage:
 *   npx tsx scripts/experiments/add-normalized-notion-fields-to-all-dbs.ts
 *
 * NOTE: The manual rename of "Doc Type" to "Type" in Agent Scope Database has been DEFERRED
 * to minimize breaking changes during migration. See the action plan for details.
 *
 * Related: docs/action-plans/NOTION_PROPERTY_STANDARDIZATION_ACTION_PLAN.md
 */
import { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import { ATLAS_DATABASE_ID_MAP, ATLAS_DATABASE_NAMES } from '@/app/server/atlas/constants';
import { notion } from '@/app/server/services/notion/notion-client';
import { loadEnv } from '../utils/load-env';

// New standardized property names
const STANDARDIZED_DOCUMENT_NUMBER = 'Document Number';
const STANDARDIZED_DOCUMENT_TITLE = 'Document Title';

interface PropertyAddResult {
  databaseName: AtlasDatabaseName;
  databaseId: string;
  documentNumberAdded: boolean;
  documentTitleAdded: boolean;
  documentNumberAlreadyExists: boolean;
  documentTitleAlreadyExists: boolean;
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
 * Adds new properties to a Notion database if they don't already exist
 */
async function addPropertiesToDatabase(
  databaseName: AtlasDatabaseName,
  databaseId: string,
): Promise<PropertyAddResult> {
  const result: PropertyAddResult = {
    databaseName,
    databaseId,
    documentNumberAdded: false,
    documentTitleAdded: false,
    documentNumberAlreadyExists: false,
    documentTitleAlreadyExists: false,
  };

  try {
    // Get existing properties
    const existingProperties = await getExistingProperties(databaseId);

    // Check which properties need to be added
    const propertiesToAdd: Record<string, { rich_text: Record<string, never> }> = {};

    if (existingProperties.has(STANDARDIZED_DOCUMENT_NUMBER)) {
      result.documentNumberAlreadyExists = true;
    } else {
      propertiesToAdd[STANDARDIZED_DOCUMENT_NUMBER] = { rich_text: {} };
    }

    if (existingProperties.has(STANDARDIZED_DOCUMENT_TITLE)) {
      result.documentTitleAlreadyExists = true;
    } else {
      propertiesToAdd[STANDARDIZED_DOCUMENT_TITLE] = { rich_text: {} };
    }

    // If there are properties to add, update the database
    if (Object.keys(propertiesToAdd).length > 0) {
      await notion().databases.update({
        database_id: databaseId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        properties: propertiesToAdd as any,
      });

      result.documentNumberAdded = STANDARDIZED_DOCUMENT_NUMBER in propertiesToAdd;
      result.documentTitleAdded = STANDARDIZED_DOCUMENT_TITLE in propertiesToAdd;
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.error = errorMessage;
    return result;
  }
}

/**
 * Main function to add normalized fields to all Atlas databases
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
  console.log('  Add Normalized Notion Fields to All Atlas Databases');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(`  Started at: ${dateTimeString}`);
  console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('');
  console.log(`  New properties to add:`);
  console.log(`    - ${STANDARDIZED_DOCUMENT_NUMBER} (rich_text)`);
  console.log(`    - ${STANDARDIZED_DOCUMENT_TITLE} (rich_text)`);
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

    const result = await addPropertiesToDatabase(databaseName, databaseId);
    results.push(result);

    if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
      errorCount++;
    } else {
      // Document Number status
      if (result.documentNumberAdded) {
        console.log(`   ✅ Added: ${STANDARDIZED_DOCUMENT_NUMBER}`);
      } else if (result.documentNumberAlreadyExists) {
        console.log(`   ⏭️  Already exists: ${STANDARDIZED_DOCUMENT_NUMBER}`);
      }

      // Document Title status
      if (result.documentTitleAdded) {
        console.log(`   ✅ Added: ${STANDARDIZED_DOCUMENT_TITLE}`);
      } else if (result.documentTitleAlreadyExists) {
        console.log(`   ⏭️  Already exists: ${STANDARDIZED_DOCUMENT_TITLE}`);
      }

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

  // Count additions
  const documentNumbersAdded = results.filter((r) => r.documentNumberAdded).length;
  const documentTitlesAdded = results.filter((r) => r.documentTitleAdded).length;
  const documentNumbersExisted = results.filter((r) => r.documentNumberAlreadyExists).length;
  const documentTitlesExisted = results.filter((r) => r.documentTitleAlreadyExists).length;

  console.log(`  ${STANDARDIZED_DOCUMENT_NUMBER}:`);
  console.log(`    - Added: ${documentNumbersAdded}`);
  console.log(`    - Already existed: ${documentNumbersExisted}`);
  console.log('');
  console.log(`  ${STANDARDIZED_DOCUMENT_TITLE}:`);
  console.log(`    - Added: ${documentTitlesAdded}`);
  console.log(`    - Already existed: ${documentTitlesExisted}`);
  console.log('═══════════════════════════════════════════════════════════════════════════════');

  // Print note about deferred Doc Type rename
  console.log('');
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                               ║');
  console.log('║   ℹ️  NOTE: "Doc Type" → "Type" Rename DEFERRED                                ║');
  console.log('║                                                                               ║');
  console.log('║   The manual rename of "Doc Type" to "Type" in Agent Scope Database          ║');
  console.log('║   has been deferred to minimize breaking changes during migration.           ║');
  console.log('║                                                                               ║');
  console.log('║   See: docs/action-plans/NOTION_PROPERTY_STANDARDIZATION_ACTION_PLAN.md ║');
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
