import { flattenAtlasScopeTreesToNodesPerDatabase } from '@/app/server/atlas/atlas-tree-flattener';
import { buildAtlasTree } from '@/app/server/atlas/atlas-tree-system';
import { atlasNodeToStandardized } from '@/app/server/atlas/export/atlas-node-tree-to-standardized-atlas-node-tree';
import { flattenStandardizedAtlasDocuments } from '@/app/server/atlas/export/flatten-standardized-atlas-documents';
import { loadAtlasFromSupabaseWithoutNestingAgentsUnderSection } from '@/app/server/atlas/load-atlas-from-supabase';
import { loadUuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import AtlasListPrerendered from './atlas-list-prerendered';

export const dynamic = 'force-static';

console.log('/atlas/list is being prerendered');

export default async function AtlasListPage() {
  // Load ALL Atlas pages from Supabase including agents
  const atlasPagesPerDatabase = await loadAtlasFromSupabaseWithoutNestingAgentsUnderSection();

  // Load UUID mappings
  const uuidMappings = await loadUuidMappings();

  // Build the Atlas tree structure with validation
  const { scopeTrees } = await buildAtlasTree(atlasPagesPerDatabase, {
    uuidMappings,
    reportMissingChildNodes: false,
    reportOrphanedNodes: true,
  });

  // Convert entire scope trees to StandardizedAtlasDocument (omit agents for ISR size)
  const standardizedScopeTreesWithoutAgents = scopeTrees.map((node) =>
    atlasNodeToStandardized(node, uuidMappings, { omitAgents: true }),
  );

  // Flatten standardized trees into per-database standardized arrays (no agents)
  const flatStandardizedPerDatabase = flattenStandardizedAtlasDocuments(standardizedScopeTreesWithoutAgents);

  // Extract agent nodes from original Atlas tree, convert to Standardized (tree), then flatten to Agent Scope docs
  const flattenedOriginal = flattenAtlasScopeTreesToNodesPerDatabase({ scopeTrees });
  const agentNodes = flattenedOriginal['Agent Scope Database'] || [];
  const standardizedAgentRoots = agentNodes.map((n) => atlasNodeToStandardized(n, uuidMappings));
  const flattenedAgents = flattenStandardizedAtlasDocuments(standardizedAgentRoots);
  const standardizedAgentDocs = flattenedAgents['Agent Scope Database'] || [];

  return (
    <AtlasListPrerendered
      initialAtlasNodesPerDatabase={flatStandardizedPerDatabase}
      standardizedAgentDocs={standardizedAgentDocs}
      uuidMappings={uuidMappings}
    />
  );
}
