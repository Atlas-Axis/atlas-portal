import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/services/atlas/load-atlas-from-supabase';
import ContentTree from './content-tree';

export const dynamic = 'force-static';

export default async function Page() {
  // Load Atlas pages from Supabase, grouped by Atlas database
  const atlasPagesPerDatabase = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();

  return (
    <div className="min-h-screen bg-white p-6">
      <ContentTree atlasPagesPerDatabase={atlasPagesPerDatabase} />
    </div>
  );
}
