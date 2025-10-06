'use client';

import { useCallback, useState } from 'react';
import { AtlasTreeNode } from '@/app/server/atlas/atlas-tree-types';
import { ATLAS_DATABASES } from '@/app/server/atlas/constants';
import AgentsSection from './agents-section-loader';
import AtlasList from './atlas-list';

interface AtlasListWithAgentsProps {
  initialAtlasNodesPerDatabase: Record<string, AtlasTreeNode[]>;
  initialPageIdToHTMLMap: Record<string, string>;
}

export default function AtlasListPrerendered({
  initialAtlasNodesPerDatabase,
  initialPageIdToHTMLMap,
}: AtlasListWithAgentsProps) {
  const [atlasPagesPerDatabase, setAtlasPagesPerDatabase] = useState(initialAtlasNodesPerDatabase);
  const [pageIdToHTMLMap, setPageIdToHTMLMap] = useState(initialPageIdToHTMLMap);

  const handleAgentsLoaded = useCallback((agentNodes: AtlasTreeNode[], agentPageIdsToHTML: Record<string, string>) => {
    setAtlasPagesPerDatabase((prev) => ({
      ...prev,
      [ATLAS_DATABASES.AGENTS]: agentNodes,
    }));
    setPageIdToHTMLMap((prev) => ({
      ...prev,
      ...agentPageIdsToHTML,
    }));
  }, []);

  return (
    <>
      <AtlasList atlasPagesPerDatabase={atlasPagesPerDatabase} pageIdToHTMLMap={pageIdToHTMLMap} />

      {/*
       The AgentsSection is a client component that loads the agents data from the API after the AtlasList has been rendered.
       This is used to prevent a build error caused by 19 MB limit on the prerendered HTML.
       */}
      <AgentsSection onAgentsLoaded={handleAgentsLoaded} />
    </>
  );
}
