/**
 * Reusable function to display import summary for Atlas database changes
 */
import { ImportResult } from './import-database-to-supabase';

/**
 * Displays a formatted summary of Atlas database import results
 * @param results Array of import results from all databases
 * @param options Optional formatting options
 */
export function displayImportSummary(
  results: ImportResult[],
  options: {
    showSeparator?: boolean;
    title?: string;
  } = {},
) {
  const { showSeparator = true, title = 'IMPORT SUMMARY' } = options;

  if (showSeparator) {
    console.log(`\n================================================================================`);
    console.log(`📋 ${title}`);
    console.log(`================================================================================`);
  } else {
    console.log(`\n📋 ${title}:`);
  }

  const changedDatabases = results.filter((result) => result.hasChanges);

  if (changedDatabases.length === 0) {
    console.log(`✅ No changes detected across any Atlas databases - all data is up to date`);
  } else {
    console.log(`🔥 Changes detected in ${changedDatabases.length} out of ${results.length} Atlas databases:`);
    console.log(``);

    for (const result of changedDatabases) {
      const { atlasDatabaseName, summary } = result;
      console.log(`📊 ${atlasDatabaseName}:`);
      if (summary.newPages > 0) console.log(`  🆕 New pages: ${summary.newPages}`);
      if (summary.deletedPages > 0) console.log(`  🗑️ Deleted pages: ${summary.deletedPages}`);
      if (summary.changedProperties > 0) console.log(`  📝 Property changes: ${summary.changedProperties}`);
      if (summary.changedRelationships > 0) console.log(`  🔗 Relationship changes: ${summary.changedRelationships}`);
      console.log(``);
    }
  }
}
