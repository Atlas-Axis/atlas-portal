import { NextResponse } from 'next/server';
import { flattenAtlasScopeTreesToNotionPages } from '@/app/server/atlas/atlas-tree-flattener';
import { buildAtlasTree } from '@/app/server/atlas/atlas-tree-system';
import { ATLAS_DATABASES } from '@/app/server/atlas/constants';
import { loadAtlasFromSupabaseWithoutNestingAgentsUnderSection } from '@/app/server/atlas/load-atlas-from-supabase';

// Cache for 2 minutes
export const revalidate = 120;

export async function GET() {
  try {
    // Load all Atlas pages from Supabase
    const atlasPagesPerDatabase = await loadAtlasFromSupabaseWithoutNestingAgentsUnderSection({ excludeAgents: false });

    // Build the Atlas tree structure with validation
    const { scopeTrees } = buildAtlasTree(atlasPagesPerDatabase, {
      assignDocumentNumbers: true,
      reportMissingChildNodes: false,
      reportOrphanedNodes: true,
    });

    // Flatten the scope trees back into a flat list of NotionDatabasePage objects, per database
    const flatAtlasPagesPerDatabase = flattenAtlasScopeTreesToNotionPages({ scopeTrees });

    return NextResponse.json({
      // Return ONLY the flattened agent pages
      agentPages: flatAtlasPagesPerDatabase[ATLAS_DATABASES.AGENTS] || [],
    });
  } catch (error) {
    console.error('Error loading agents data:', error);
    return NextResponse.json({ error: 'Failed to load agents data' }, { status: 500 });
  }
}
