import { buildAtlasTree } from '@/app/server/atlas/atlas-tree-system';
import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/atlas/load-atlas-from-supabase';
import { loadUuidMappings } from '../server/atlas/load-uuid-mapping';
import ContentTree from './content-tree';
import Sidebar from './sidebar';

export const dynamic = 'force-static';

console.log('/atlas is being prerendered');

export default async function Page() {
  // Load Atlas pages from Supabase, grouped by Atlas database
  const atlasPagesPerDatabase = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();

  // Load UUID mappings
  const uuidMappings = await loadUuidMappings();

  // Build the Atlas tree structure with validation
  const atlas = buildAtlasTree(atlasPagesPerDatabase, {
    assignDocumentNumbers: true,
    reportMissingChildNodes: false,
    reportOrphanedNodes: true,
  });

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-white">
      <Sidebar atlas={atlas} />
      <div className="min-w-0 flex-1 p-6">
        <ContentTree atlas={atlas} uuidMappings={uuidMappings} />
      </div>
    </div>
  );
}
