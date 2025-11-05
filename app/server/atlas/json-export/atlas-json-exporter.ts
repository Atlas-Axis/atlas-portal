import { buildAtlasTree } from '@/app/server/atlas/atlas-tree-system';
import type { TreeConstructionOptions } from '@/app/server/atlas/atlas-tree-types';
import atlasNodeToStandardized from '@/app/server/atlas/json-export/atlas-node-tree-to-standardized-atlas-node-tree';
import { StandardizedAtlasScopeTrees } from '@/app/server/atlas/json-export/types';
import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/atlas/load-atlas-from-supabase';
import { loadUuidMappings } from '../load-uuid-mapping';

export async function buildAtlasJSON() {
  // Load Atlas data
  const atlasData = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();

  // Load UUID mappings
  const uuidMappings = await loadUuidMappings();

  // Configure options
  const options: TreeConstructionOptions = {
    uuidMappings,
    reportMissingChildNodes: false,
    reportOrphanedNodes: true,
  };

  // Build tree structure with document numbering and validation
  const result = await buildAtlasTree(atlasData, options);
  const scopeTrees = result.scopeTrees;
  console.log(`Built ${result.scopeTrees.length} scope trees`);

  // Convert Scope trees to standardized JSON format
  const standardizedTrees: StandardizedAtlasScopeTrees = scopeTrees.map((scopeNode) =>
    atlasNodeToStandardized(scopeNode, uuidMappings),
  );

  return standardizedTrees;
}
