import { NextResponse } from 'next/server';
import { ATLAS_DATABASES } from '@/app/server/atlas/constants';
import { loadNotionDatabasePagesFromSupabase } from '@/app/server/services/supabase/load-notion-database-pages-from-supabase';

// Cache for 2 minutes
export const revalidate = 120;

export async function GET() {
  try {
    // Load only Agents data
    const agentPages = await loadNotionDatabasePagesFromSupabase({
      atlasDatabaseName: ATLAS_DATABASES.AGENTS,
    });

    return NextResponse.json({
      agentPages,
    });
  } catch (error) {
    console.error('Error loading agents data:', error);
    return NextResponse.json({ error: 'Failed to load agents data' }, { status: 500 });
  }
}
