'use client';

import { useEffect, useState } from 'react';
import type { AtlasTreeNode, AtlasTreeResult } from '@/app/server/atlas/atlas-tree-types';
import { flattenAtlasScopeTreesToNodesPerDatabase } from '@/app/server/atlas/atlas-tree-flattener';
import { buildAtlasTree } from '@/app/server/atlas/atlas-tree-system';
import { ATLAS_DATABASES } from '@/app/server/atlas/constants';
import type { NotionDatabasePage } from '@/app/server/database/notion-database-page';

interface AgentsScopeLoaderProps {
  initialAtlas: AtlasTreeResult;
  onAgentsLoaded: (updatedAtlas: AtlasTreeResult) => void;
}

export default function AgentsScopeLoader({ initialAtlas, onAgentsLoaded }: AgentsScopeLoaderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAgents = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/atlas/agents');
        if (!response.ok) {
          throw new Error('Failed to load agents data');
        }

        const data = await response.json();
        const agentNodes: AtlasTreeNode[] = data.agentNodes;

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
        console.error('Error loading agents:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    loadAgents();
  }, [initialAtlas, onAgentsLoaded]);

  if (isLoading) {
    return (
      <div className="fixed bottom-4 right-4 rounded bg-white px-3 py-2 text-sm text-gray-400 shadow">
        Loading agents...
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed bottom-4 right-4 rounded bg-white px-3 py-2 text-sm text-red-500 shadow">
        Error loading agents: {error}
      </div>
    );
  }

  return null;
}

