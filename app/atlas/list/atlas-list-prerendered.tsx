'use client';

import { useCallback, useState } from 'react';
import { AtlasTreeNode } from '@/app/server/atlas/atlas-tree-types';
import { ATLAS_DATABASES } from '@/app/server/atlas/constants';
import AgentsSection from './agents-section-loader';
import AtlasList from './atlas-list';

interface AtlasListWithAgentsProps {
  initialAtlasNodesPerDatabase: Record<string, AtlasTreeNode[]>;
}

export default function AtlasListPrerendered({ initialAtlasNodesPerDatabase }: AtlasListWithAgentsProps) {
  const [atlasPagesPerDatabase, setAtlasPagesPerDatabase] = useState(initialAtlasNodesPerDatabase);

  const handleAgentsLoaded = useCallback((agentNodes: AtlasTreeNode[]) => {
    setAtlasPagesPerDatabase((prev) => ({
      ...prev,
      [ATLAS_DATABASES.AGENTS]: agentNodes,
    }));
  }, []);

  return (
    <>
      <AtlasList atlasPagesPerDatabase={atlasPagesPerDatabase} />

      {/*
       The AgentsSection is a client component that loads the agents data from the API after the AtlasList has been rendered.
       This is used to prevent a build error caused by 19 MB limit on the prerendered HTML.
       */}
      <AgentsSection onAgentsLoaded={handleAgentsLoaded} />
    </>
  );
}
