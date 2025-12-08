import notionTreeNodeToExportTreeNode, {
  type ExportTreeOptions,
} from '@/app/server/atlas/export/notion-tree-to-export-tree';
import { ExportAtlasTreeScopeTrees } from '@/app/server/atlas/export/types';
import { buildNotionAtlasTree } from '@/app/server/atlas/notion-tree/atlas-tree-system';
import type { NotionAtlasTreeConstructionOptions } from '@/app/server/atlas/notion-tree/atlas-tree-system';
import { loadAtlasFromSupabase } from '@/app/server/services/supabase/load-atlas-from-supabase';
import { loadUuidMappings } from '../load-uuid-mapping';

/**
 * Options for building the export Atlas tree JSON
 */
export interface BuildExportAtlasTreeOptions extends ExportTreeOptions {}

export async function buildExportAtlasTreeJSON(exportOptions?: BuildExportAtlasTreeOptions) {
  // Load Atlas data as flat array
  const allPages = await loadAtlasFromSupabase();

  // Load UUID mappings
  const uuidMappings = await loadUuidMappings();

  // Configure options
  const options: NotionAtlasTreeConstructionOptions = {
    uuidMappings,
    reportMissingChildNodes: false,
    reportOrphanedNodes: true,
  };

  // Build tree structure with document numbering and validation
  const result = await buildNotionAtlasTree(allPages, options);
  const scopeTrees = result.scopeTrees;
  console.log(`Built ${result.scopeTrees.length} scope trees`);

  // Convert Scope trees to Export Atlas Tree JSON format
  const exportTrees: ExportAtlasTreeScopeTrees = scopeTrees.map((scopeNode) =>
    notionTreeNodeToExportTreeNode(scopeNode, uuidMappings, exportOptions),
  );

  return exportTrees;
}
