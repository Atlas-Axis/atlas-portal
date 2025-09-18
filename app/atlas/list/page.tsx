import { loadAtlasFromSupabase } from '@/app/server/services/atlas/load-atlas-from-supabase';
import AtlasListClient from './atlas-list-client';

// export const dynamic = 'force-dynamic';

export default async function AtlasListPage() {
  // Load Atlas pages from Supabase, grouped by Atlas database
  const atlasPagesPerDatabase = await loadAtlasFromSupabase();

  return <AtlasListClient atlasPagesPerDatabase={atlasPagesPerDatabase} />;
}
