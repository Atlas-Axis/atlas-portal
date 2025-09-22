'use client';

import { useCallback, useState } from 'react';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { ATLAS_DATABASES } from '@/app/server/services/atlas/constants';
import AgentsSection from './agents-section';
import AtlasList from './atlas-list';

interface AtlasListWithAgentsProps {
  initialAtlasPagesPerDatabase: Record<string, NotionDatabasePage[]>;
}

export default function AtlasListPrerendered({ initialAtlasPagesPerDatabase }: AtlasListWithAgentsProps) {
  const [atlasPagesPerDatabase, setAtlasPagesPerDatabase] = useState(initialAtlasPagesPerDatabase);

  const handleAgentsLoaded = useCallback((agentPages: NotionDatabasePage[]) => {
    setAtlasPagesPerDatabase((prev) => ({
      ...prev,
      [ATLAS_DATABASES.AGENTS]: agentPages,
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
