'use client';

import { useCallback, useMemo, useState } from 'react';
import { flattenAtlasScopeTreesToNodesPerDatabase } from '@/app/server/atlas/atlas-tree-flattener';
import type { AtlasTreeResult } from '@/app/server/atlas/atlas-tree-types';
import { ATLAS_DATABASES } from '@/app/server/atlas/constants';
import type { UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import AgentsHydrator from './agents-hydrator';
import ContentTree from './content-tree';
import Sidebar from './sidebar';

interface AtlasPagePrerenderedProps {
  initialAtlas: AtlasTreeResult;
  uuidMappings: UuidMappings;
}

export default function AtlasPagePrerendered({ initialAtlas, uuidMappings }: AtlasPagePrerenderedProps) {
  const [atlas, setAtlas] = useState(initialAtlas);
  const [agentsLoaded, setAgentsLoaded] = useState(false);

  // Extract agent nodes from the initial tree for embedding as JSON
  const agentNodes = useMemo(() => {
    const flattened = flattenAtlasScopeTreesToNodesPerDatabase({ scopeTrees: initialAtlas.scopeTrees });
    return flattened[ATLAS_DATABASES.AGENTS] || [];
  }, [initialAtlas.scopeTrees]);

  const handleAgentsLoaded = useCallback((updatedAtlas: AtlasTreeResult) => {
    setAtlas(updatedAtlas);
    setAgentsLoaded(true);
  }, []);

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-white">
      <Sidebar atlas={atlas} />
      <div className="min-w-0 flex-1 p-6">
        <ContentTree atlas={atlas} uuidMappings={uuidMappings} agentsLoading={!agentsLoaded} />
      </div>

      {/* Embed agent data as JSON in the HTML for client-side hydration */}
      <script
        id="agent-data"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(agentNodes) }}
      />

      <AgentsHydrator initialAtlas={initialAtlas} onAgentsLoaded={handleAgentsLoaded} />
    </div>
  );
}
