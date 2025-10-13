'use client';

import { useCallback, useMemo, useState } from 'react';
import { AtlasTreeNode } from '@/app/server/atlas/atlas-tree-types';
import { ATLAS_DATABASES } from '@/app/server/atlas/constants';
import { UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import AgentsListHydrator from './agents-list-hydrator';
import AtlasList from './atlas-list';

interface AtlasListWithAgentsProps {
  initialAtlasNodesPerDatabase: Record<string, AtlasTreeNode[]>;
  uuidMappings: UuidMappings;
}

export default function AtlasListPrerendered({ initialAtlasNodesPerDatabase, uuidMappings }: AtlasListWithAgentsProps) {
  const [atlasPagesPerDatabase, setAtlasPagesPerDatabase] = useState(initialAtlasNodesPerDatabase);

  // Extract agent nodes for embedding as JSON
  const agentNodes = useMemo(
    () => initialAtlasNodesPerDatabase[ATLAS_DATABASES.AGENTS] || [],
    [initialAtlasNodesPerDatabase],
  );

  const handleAgentsLoaded = useCallback((agentNodes: AtlasTreeNode[]) => {
    setAtlasPagesPerDatabase((prev) => ({
      ...prev,
      [ATLAS_DATABASES.AGENTS]: agentNodes,
    }));
  }, []);

  return (
    <>
      <AtlasList atlasPagesPerDatabase={atlasPagesPerDatabase} uuidMappings={uuidMappings} />

      {/* Embed agent data as JSON in the HTML for client-side hydration */}
      <script
        id="agent-list-data"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(agentNodes) }}
      />

      <AgentsListHydrator onAgentsLoaded={handleAgentsLoaded} />
    </>
  );
}
