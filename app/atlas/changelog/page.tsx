import { loadAtlasFromSupabasePastVersion } from '@/app/server/services/atlas/load-atlas-from-supabase';

// import AtlasListClient from './atlas-list-client';

export default async function AtlasListPage() {
  // Load Atlas pages from Supabase, grouped by Atlas database
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const atlasPagesPerDatabase = await loadAtlasFromSupabasePastVersion(new Date().toISOString());

  return null;

  // return <AtlasListClient atlasPagesPerDatabase={atlasPagesPerDatabase} />;
}

// TODO: Load a list of rows from `notion_database_pages`, descending by `date_valid_to` timestamps from Supabase, limited to 100 rows, and render the data as a change log
