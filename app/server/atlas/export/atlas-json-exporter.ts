import notionTreeNodeToExportTreeNode from '@/app/server/atlas/export/notion-tree-to-export-tree';
import { ExportAtlasTreeScopeTrees } from '@/app/server/atlas/export/types';
import { buildNotionAtlasTree } from '@/app/server/atlas/notion-tree/atlas-tree-system';
import type { NotionAtlasTreeConstructionOptions } from '@/app/server/atlas/notion-tree/atlas-tree-system';
import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/services/supabase/load-atlas-from-supabase';
import { loadUuidMappings } from '../load-uuid-mapping';

export async function buildExportAtlasTreeJSON() {
  // Load Atlas data as flat array
  const allPages = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();

  // Load UUID mappings
  const uuidMappings = await loadUuidMappings();

  // Configure options
  const options: NotionAtlasTreeConstructionOptions = {
    uuidMappings,
    reportMissingChildNodes: true,
    reportOrphanedNodes: true,
  };

  // Build tree structure with document numbering and validation
  const result = await buildNotionAtlasTree(allPages, options);
  const scopeTrees = result.scopeTrees;
  console.log(`Built ${result.scopeTrees.length} scope trees`);

  // Convert Scope trees to Export Atlas Tree JSON format
  const exportTrees: ExportAtlasTreeScopeTrees = scopeTrees.map((scopeNode) =>
    notionTreeNodeToExportTreeNode(scopeNode, uuidMappings),
  );

  return exportTrees;
}
