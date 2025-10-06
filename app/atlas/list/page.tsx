import { atlasDatabasePagesToHTML } from '@/app/server/atlas/atlas-rich-text-formatter';
import { flattenAtlasScopeTreesToNodesPerDatabase } from '@/app/server/atlas/atlas-tree-flattener';
import { AtlasTreeNode, buildAtlasTree } from '@/app/server/atlas/atlas-tree-system';
import { loadAtlasFromSupabaseWithoutNestingAgentsUnderSection } from '@/app/server/atlas/load-atlas-from-supabase';
import AtlasListPrerendered from './atlas-list-prerendered';

export const dynamic = 'force-static';

console.log('/atlas/list is being prerendered');

export default async function AtlasListPage() {
  // Load Atlas pages from Supabase, excluding Agents for ISR optimization
  const atlasPagesPerDatabase = await loadAtlasFromSupabaseWithoutNestingAgentsUnderSection({ excludeAgents: true });

  // Build the Atlas tree structure with validation
  const { scopeTrees } = buildAtlasTree(atlasPagesPerDatabase, {
    assignDocumentNumbers: true,
    reportMissingChildNodes: false,
    reportOrphanedNodes: true,
  });

  // Flatten the scope trees back into a flat list of NotionDatabasePage objects, per database
  const flatAtlasPagesPerDatabase = flattenAtlasScopeTreesToNodesPerDatabase({ scopeTrees });

  // Render formatted content for each page as a lookup map
  const pageIdToHTML = await atlasDatabasePagesToHTML<AtlasTreeNode>(Object.values(flatAtlasPagesPerDatabase).flat());

  return (
    <AtlasListPrerendered
      initialAtlasNodesPerDatabase={flatAtlasPagesPerDatabase}
      initialPageIdToHTMLMap={pageIdToHTML}
    />
  );
}
