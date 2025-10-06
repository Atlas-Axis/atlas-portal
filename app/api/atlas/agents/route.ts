import { NextResponse } from 'next/server';
import { flattenAtlasScopeTreesToNodesPerDatabase } from '@/app/server/atlas/atlas-tree-flattener';
import { buildAtlasTree } from '@/app/server/atlas/atlas-tree-system';
import { ATLAS_DATABASES } from '@/app/server/atlas/constants';
import { loadAtlasFromSupabaseWithoutNestingAgentsUnderSection } from '@/app/server/atlas/load-atlas-from-supabase';

// Cache for 1 minute
export const revalidate = 60;

// This route is used on the `/atlas` page to load the agents data after the initial ISR page is loaded.
// This is used to prevent a build error caused by 19 MB limit on the prerendered HTML, so some data loading is deferred to the client.
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
    const flatAtlasNodesPerDatabase = flattenAtlasScopeTreesToNodesPerDatabase({ scopeTrees });

    return NextResponse.json({
      // Return ONLY the flattened agent pages
      agentNodes: flatAtlasNodesPerDatabase[ATLAS_DATABASES.AGENTS] || [],
    });
  } catch (error) {
    console.error('Error loading agents data:', error);
    return NextResponse.json({ error: 'Failed to load agents data' }, { status: 500 });
  }
}
