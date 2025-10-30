'use client';

import { useMemo } from 'react';
import { ATLAS_DATABASES } from '@/app/server/atlas/constants';
import { StandardizedAtlasDocument } from '@/app/server/atlas/json-export/types';
import { UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import AtlasList from './atlas-list';

interface AtlasListWithAgentsProps {
  initialAtlasNodesPerDatabase: Record<string, StandardizedAtlasDocument[]>;
  uuidMappings: UuidMappings;
  standardizedAgentDocs?: StandardizedAtlasDocument[];
}

export default function AtlasListPrerendered({
  initialAtlasNodesPerDatabase,
  uuidMappings,
  standardizedAgentDocs,
}: AtlasListWithAgentsProps) {
  // Merge agent docs with the initial data if provided
  const atlasPagesPerDatabase = useMemo(() => {
    if (standardizedAgentDocs) {
      return {
        ...initialAtlasNodesPerDatabase,
        [ATLAS_DATABASES.AGENTS]: standardizedAgentDocs,
      };
    }
    return initialAtlasNodesPerDatabase;
  }, [initialAtlasNodesPerDatabase, standardizedAgentDocs]);

  return <AtlasList atlasPagesPerDatabase={atlasPagesPerDatabase} uuidMappings={uuidMappings} />;
}
