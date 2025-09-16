import Link from 'next/link';
import { loadAtlasFromSupabase } from '@/app/server/services/atlas/load-atlas-from-supabase';
import ContentTree from './content-tree';

export default async function Page() {
  // Load Atlas pages from Supabase, grouped by Atlas database
  const atlasPagesPerDatabase = await loadAtlasFromSupabase();

  return (
    <div className="p-6">
      <Link href="/visualize" className="mb-4 inline-block text-indigo-500 hover:underline">
        ← Back to overview
      </Link>
      <ContentTree atlasPagesPerDatabase={atlasPagesPerDatabase} />
    </div>
  );
}
