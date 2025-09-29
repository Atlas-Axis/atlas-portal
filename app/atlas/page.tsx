import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/services/atlas/load-atlas-from-supabase';
import { buildAtlasTree } from '@/scripts/atlas-json/atlas-tree-system';
import ContentTree from './content-tree';

export const dynamic = 'force-static';

console.log('/atlas is being prerendered');

export default async function Page() {
  // Load Atlas pages from Supabase, grouped by Atlas database
  const atlasPagesPerDatabase = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();

  // Build the Atlas tree structure with validation
  const atlas = buildAtlasTree(atlasPagesPerDatabase, {
    assignDocumentNumbers: true,
    reportMissingChildNodes: false,
    reportOrphanedNodes: false,
  });

  return (
    <div className="min-h-screen bg-white p-6">
      <ContentTree atlas={atlas} />
    </div>
  );
}
