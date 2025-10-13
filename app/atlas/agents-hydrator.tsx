'use client';

import { useEffect, useRef, useState } from 'react';
import { flattenAtlasScopeTreesToNodesPerDatabase } from '@/app/server/atlas/atlas-tree-flattener';
import { buildAtlasTree } from '@/app/server/atlas/atlas-tree-system';
import type { AtlasTreeNode, AtlasTreeResult } from '@/app/server/atlas/atlas-tree-types';
import { ATLAS_DATABASES } from '@/app/server/atlas/constants';
import type { NotionDatabasePage } from '@/app/server/database/notion-database-page';

interface AgentsHydratorProps {
  initialAtlas: AtlasTreeResult;
  onAgentsLoaded: (updatedAtlas: AtlasTreeResult) => void;
}

export default function AgentsHydrator({ initialAtlas, onAgentsLoaded }: AgentsHydratorProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasHydrated = useRef(false);

  useEffect(() => {
    // Prevent double hydration in React StrictMode
    if (hasHydrated.current) {
      return;
    }
    hasHydrated.current = true;

    const hydrateAgents = () => {
      try {
        // Read agent data from embedded JSON
        const script = document.getElementById('agent-data');
        if (!script?.textContent) {
          throw new Error('Agent data not found in page');
        }

        const agentNodes: AtlasTreeNode[] = JSON.parse(script.textContent);

        // Validate parsed data
        if (!Array.isArray(agentNodes)) {
          throw new Error('Invalid agent data format: expected array');
        }

        // Rebuild tree with agents by flattening initial tree, adding agents, and rebuilding
        const flatInitial = flattenAtlasScopeTreesToNodesPerDatabase({ scopeTrees: initialAtlas.scopeTrees });

        // Cast AtlasTreeNode arrays to NotionDatabasePage arrays for buildAtlasTree
        // This is safe because AtlasTreeNode contains all the required fields from NotionDatabasePage
        // The child_*_ids fields are not used during tree building (only the embedded child arrays are)
        const atlasPagesWithAgents = Object.fromEntries(
          Object.entries({
            ...flatInitial,
            [ATLAS_DATABASES.AGENTS]: agentNodes,
          }).map(([key, value]) => [key, value as unknown as NotionDatabasePage[]]),
        );

        const updatedAtlas = buildAtlasTree(atlasPagesWithAgents, {
          assignDocumentNumbers: true,
          reportMissingChildNodes: false,
          reportOrphanedNodes: true,
        });

        onAgentsLoaded(updatedAtlas);
      } catch (err) {
        console.error('Error hydrating agents:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    // Run hydration after component mounts
    hydrateAgents();
    // Only run once on mount - we use a ref to ensure single execution
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="fixed right-4 bottom-4 rounded bg-white px-3 py-2 text-sm text-gray-400 shadow">
        Loading agents...
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed right-4 bottom-4 rounded bg-white px-3 py-2 text-sm text-red-500 shadow">
        Error loading agents: {error}
      </div>
    );
  }

  return null;
}
