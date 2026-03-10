import { ExportAtlasTreeScopeTrees } from '@/app/server/atlas/export/types';
import { fetchAtlasMarkdownContent } from '../load-atlas-markdown-from-github';
import { parseAtlasMarkdown } from './atlas-markdown-importer';

/**
 * Build Export Atlas Tree JSON by parsing the canonical GitHub markdown.
 *
 * This replaces the old pipeline that went through Supabase:
 *   loadAtlasFromSupabase() → buildNotionAtlasTree() → notionTreeToExportTree()
 *
 * The markdown parser produces ExportAtlasTreeScopeTrees directly.
 */
export async function buildExportAtlasTreeJSON(): Promise<ExportAtlasTreeScopeTrees> {
  const markdown = await fetchAtlasMarkdownContent();
  const exportTrees = parseAtlasMarkdown(markdown);
  console.log(`Built ${exportTrees.length} scope trees from GitHub markdown`);
  return exportTrees;
}
