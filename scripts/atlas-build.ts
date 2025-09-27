#!/usr/bin/env node
import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/services/atlas/load-atlas-from-supabase';
import { buildAtlasTreeWithValidation } from './atlas-json/atlas-tree-system';
import type { TreeConstructionOptions } from './atlas-json/atlas-tree-types';
import { loadEnv } from './utils/load-env';

async function main() {
  const startTime = Date.now();

  // Load environment variables
  loadEnv();

  try {
    // Load Atlas data
    const atlasData = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();

    // Configure options
    const options: TreeConstructionOptions = {
      reportMissingChildNodes: false,
      reportOrphanedNodes: false,
    };

    // Build tree structure with document numbering and validation
    const result = await buildAtlasTreeWithValidation(atlasData, options);

    // Access the results
    console.log(`Built ${result.scopeTrees.length} scope trees`);

    // Only show orphaned nodes count if reporting is enabled
    if (options.reportOrphanedNodes) {
      console.log(`Found ${result.orphanedNodes.length} orphaned nodes`);
    }

    console.log(`Generated ${result.documentNumbers.size} document numbers`);

    // Check for validation errors
    if (result.validationSummary.criticalErrors > 0 || result.validationSummary.warnings > 0) {
      const missingChildCount = result.validationSummary.errorTypes.missing_child || 0;
      const orphanedNodeCount = result.validationSummary.errorTypes.orphaned_node || 0;

      const silencedMessages: string[] = [];
      if (missingChildCount > 0) {
        silencedMessages.push(`${missingChildCount} missing_child errors silenced`);
      }
      if (orphanedNodeCount > 0) {
        silencedMessages.push(`${orphanedNodeCount} orphaned_node errors silenced`);
      }

      const silencedMessage = silencedMessages.length > 0 ? ` (${silencedMessages.join(', ')})` : '';
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
