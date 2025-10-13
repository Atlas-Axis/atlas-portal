'use client';

import { useCallback, useState } from 'react';
import type { AtlasTreeResult } from '@/app/server/atlas/atlas-tree-types';
import type { UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import AgentsScopeLoader from './agents-scope-loader';
import ContentTree from './content-tree';
import Sidebar from './sidebar';

interface AtlasPagePrerenderedProps {
  initialAtlas: AtlasTreeResult;
  uuidMappings: UuidMappings;
}

export default function AtlasPagePrerendered({ initialAtlas, uuidMappings }: AtlasPagePrerenderedProps) {
  const [atlas, setAtlas] = useState(initialAtlas);
  const [agentsLoaded, setAgentsLoaded] = useState(false);

  const handleAgentsLoaded = useCallback((updatedAtlas: AtlasTreeResult) => {
    setAtlas(updatedAtlas);
    setAgentsLoaded(true);
  }, []);

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-white">
      <Sidebar atlas={atlas} />
      <div className="min-w-0 flex-1 p-6">
        <ContentTree atlas={atlas} uuidMappings={uuidMappings} agentsLoaded={agentsLoaded} />
      </div>

      <AgentsScopeLoader initialAtlas={initialAtlas} onAgentsLoaded={handleAgentsLoaded} />
    </div>
  );
}

