import { buildAtlasTree } from '@/app/server/atlas/atlas-tree-system';
import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/atlas/load-atlas-from-supabase';
import { loadUuidMappings } from '../server/atlas/load-uuid-mapping';
import AtlasPagePrerendered from './atlas-page-prerendered';

export const dynamic = 'force-static';

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

  return <AtlasPagePrerendered initialAtlas={atlas} uuidMappings={uuidMappings} />;
}
