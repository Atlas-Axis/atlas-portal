// #!/usr/bin/env node
import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/services/atlas/load-atlas-from-supabase';
import { buildAtlasTreeWithValidation } from './atlas-json/atlas-tree-system';
import { loadEnv } from './utils/load-env';

async function main() {
  const startTime = Date.now();

  // Load environment variables
  loadEnv();

  try {
    // Load Atlas data
    const atlasData = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();

    // Build tree structure with document numbering and validation
    const result = await buildAtlasTreeWithValidation(atlasData, {
      assignDocumentNumbers: true,
      verbose: true,
      validateIntegrity: true,
      reportMissingChildNodes: false, // Set to true to show missing_child errors
    });

    // Access the results
    console.log(`Built ${result.scopeTrees.length} scope trees`);
    console.log(`Found ${result.orphanedNodes.length} orphaned nodes`);
    console.log(`Generated ${result.documentNumbers.size} document numbers`);

    // Check for validation errors
    if (result.validationSummary.criticalErrors > 0 || result.validationSummary.warnings > 0) {
      const missingChildCount = result.validationSummary.errorTypes.missing_child || 0;
      const silencedMessage = missingChildCount > 0 ? ` (${missingChildCount} missing_child errors silenced)` : '';
      console.log(`Validation summary${silencedMessage}:`, result.validationSummary);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  const endTime = Date.now();
  console.log(`Execution time: ${(endTime - startTime) / 1000} seconds`);
}

/**
 * Usage:
 * npx tsx scripts/atlas-build.ts
 */
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
