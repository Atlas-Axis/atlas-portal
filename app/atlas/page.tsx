import type { Metadata } from 'next';
import notionTreeNodeToExportTreeNode from '@/app/server/atlas/export/notion-tree-to-export-tree';
import { buildNotionAtlasTree } from '@/app/server/atlas/notion-tree/atlas-tree-system';
import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/services/supabase/load-atlas-from-supabase';
import { loadUuidMappings } from '../server/atlas/load-uuid-mapping';
import AtlasPagePrerendered from './atlas-page-prerendered';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Sky Atlas',
  description: '',
};

console.log('/atlas is being prerendered');

export default async function Page() {
  // Load ALL Atlas pages including agents as flat array
  const allPages = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();

  // Load UUID mappings
  const uuidMappings = await loadUuidMappings();

  // Build the Atlas tree structure with validation
  const atlas = await buildNotionAtlasTree(allPages, {
    uuidMappings,
    reportMissingChildNodes: false,
    reportOrphanedNodes: true,
  });

  // Convert entire scope trees to ExportAtlasTreeDocument, omitting agent subtrees for lazy loading
  const exportScopeTreesWithoutAgents = atlas.scopeTrees.map((node) =>
    notionTreeNodeToExportTreeNode(node, uuidMappings, { omitAgents: true }),
  );

  return (
    <AtlasPagePrerendered exportScopeTreesWithoutAgents={exportScopeTreesWithoutAgents} uuidMappings={uuidMappings} />
  );
}
