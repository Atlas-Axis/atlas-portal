import { loadNotionDatabasePagesFromSupabase } from '../supabase/load-notion-database-pages-from-supabase';
import { ATLAS_DATABASES } from './constants';

export async function loadAtlasFromSupabase() {
  // Load Atlas pages from Supabase
  const atlasPagesPerDatabase = {
    [ATLAS_DATABASES.SCOPES]: await loadNotionDatabasePagesFromSupabase({ atlasDatabaseName: ATLAS_DATABASES.SCOPES }),
    [ATLAS_DATABASES.ARTICLES]: await loadNotionDatabasePagesFromSupabase({
      atlasDatabaseName: ATLAS_DATABASES.ARTICLES,
    }),
    [ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS]: await loadNotionDatabasePagesFromSupabase({
      atlasDatabaseName: ATLAS_DATABASES.SECTIONS_AND_PRIMARY_DOCS,
    }),
    [ATLAS_DATABASES.AGENTS]: await loadNotionDatabasePagesFromSupabase({ atlasDatabaseName: ATLAS_DATABASES.AGENTS }),
    [ATLAS_DATABASES.ANNOTATIONS]: await loadNotionDatabasePagesFromSupabase({
      atlasDatabaseName: ATLAS_DATABASES.ANNOTATIONS,
    }),
    [ATLAS_DATABASES.TENETS]: await loadNotionDatabasePagesFromSupabase({ atlasDatabaseName: ATLAS_DATABASES.TENETS }),
    [ATLAS_DATABASES.ACTIVE_DATA]: await loadNotionDatabasePagesFromSupabase({
      atlasDatabaseName: ATLAS_DATABASES.ACTIVE_DATA,
    }),
    // [ATLAS_DATABASES.SCENARIOS]: await loadNotionDatabasePagesFromSupabase({
    //   atlasDatabaseName: ATLAS_DATABASES.SCENARIOS,
    // }),
    // [ATLAS_DATABASES.SCENARIO_VARIATIONS]: await loadNotionDatabasePagesFromSupabase({
    //   atlasDatabaseName: ATLAS_DATABASES.SCENARIO_VARIATIONS,
    // }),
    // [ATLAS_DATABASES.NEEDED_RESEARCH]: await loadNotionDatabasePagesFromSupabase({
    //   atlasDatabaseName: ATLAS_DATABASES.NEEDED_RESEARCH,
    // }),
  };

  return atlasPagesPerDatabase;
}
