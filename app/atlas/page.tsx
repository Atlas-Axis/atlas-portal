import { loadAtlasFromSupabase } from '@/app/server/services/atlas/load-atlas-from-supabase';
import ContentTree from './content-tree';

export default async function Page() {
  // Load Atlas pages from Supabase, grouped by Atlas database
  const atlasPagesPerDatabase = await loadAtlasFromSupabase();

  return (
    <div className="p-6">
      <ContentTree atlasPagesPerDatabase={atlasPagesPerDatabase} />
    </div>
  );
}
