import { loadAtlasFromSupabaseWithoutNestingAgentsUnderSection } from '@/app/server/services/atlas/load-atlas-from-supabase';
import AtlasListPrerendered from './atlas-list-prerendered';

export const dynamic = 'force-static';

console.log('/atlas/list is being prerendered');

export default async function AtlasListPage() {
  // Load Atlas pages from Supabase, excluding Agents for ISR optimization
  const atlasPagesPerDatabase = await loadAtlasFromSupabaseWithoutNestingAgentsUnderSection({ excludeAgents: true });

  return <AtlasListPrerendered initialAtlasPagesPerDatabase={atlasPagesPerDatabase} />;
}
