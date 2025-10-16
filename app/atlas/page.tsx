import { flattenAtlasScopeTreesToNodesPerDatabase } from '@/app/server/atlas/atlas-tree-flattener';
import { buildAtlasTree } from '@/app/server/atlas/atlas-tree-system';
import { atlasNodeToStandardized } from '@/app/server/atlas/json-export/atlas-node-tree-to-standardized-atlas-node-tree';
import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/atlas/load-atlas-from-supabase';
import { loadUuidMappings } from '../server/atlas/load-uuid-mapping';
import AtlasPagePrerendered from './atlas-page-prerendered';

export const dynamic = 'force-static';
// TODO: Remove this:
export const revalidate = 43200; // 12 hours (60 * 60 * 12)

console.log('/atlas is being prerendered');

export default async function Page() {
  // Load ALL Atlas pages including agents
  const atlasPagesPerDatabase = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();

  // Load UUID mappings
  const uuidMappings = await loadUuidMappings();

  // Build the Atlas tree structure with validation
  const atlas = buildAtlasTree(atlasPagesPerDatabase, {
    assignDocumentNumbers: true,
    reportMissingChildNodes: false,
    reportOrphanedNodes: true,
  });

  // Convert entire scope trees to StandardizedAtlasDocument, omitting agent subtrees for lazy loading
  const standardizedScopeTreesWithoutAgents = atlas.scopeTrees.map((node) =>
    atlasNodeToStandardized(node, uuidMappings, { omitAgents: true }),
  );

  // Extract agent nodes and convert to StandardizedAtlasDocument for embedding/hydration
  const flattened = flattenAtlasScopeTreesToNodesPerDatabase({ scopeTrees: atlas.scopeTrees });
  const agentNodes = flattened['Agent Scope Database'] || [];
  const standardizedAgentDocs = agentNodes.map((node) => atlasNodeToStandardized(node, uuidMappings));

  return (
    <AtlasPagePrerendered
      standardizedScopeTreesWithoutAgents={standardizedScopeTreesWithoutAgents}
      standardizedAgentDocs={standardizedAgentDocs}
      uuidMappings={uuidMappings}
    />
  );
}
