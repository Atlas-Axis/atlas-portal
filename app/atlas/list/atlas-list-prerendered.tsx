'use client';

import { useCallback, useMemo, useState } from 'react';
import { ATLAS_DATABASES } from '@/app/server/atlas/constants';
import { flattenStandardizedAtlasDocuments } from '@/app/server/atlas/json-export/flatten-standardized-atlas-documents';
import { StandardizedAtlasDocument } from '@/app/server/atlas/json-export/types';
import { UuidMappings, serializeUuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import AgentsListHydrator from './agents-list-hydrator';
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
  const [atlasPagesPerDatabase, setAtlasPagesPerDatabase] =
    useState<Record<string, StandardizedAtlasDocument[]>>(initialAtlasNodesPerDatabase);

  // Prepare agent docs for embedding (use provided standardizedAgentDocs if present)
  const { agentDocsForEmbed, serializedUuidMappings } = useMemo(() => {
    let agentDocsForEmbed = standardizedAgentDocs;
    if (!agentDocsForEmbed) {
      const agentNodes = initialAtlasNodesPerDatabase[ATLAS_DATABASES.AGENTS] || [];
      const flattenedAgents = flattenStandardizedAtlasDocuments(agentNodes);
      agentDocsForEmbed = flattenedAgents[ATLAS_DATABASES.AGENTS] || [];
    }
    const serializedUuidMappings = serializeUuidMappings(uuidMappings);
    return { agentDocsForEmbed, serializedUuidMappings };
  }, [initialAtlasNodesPerDatabase, uuidMappings, standardizedAgentDocs]);

  const handleAgentsLoaded = useCallback((agentDocs: StandardizedAtlasDocument[]) => {
    setAtlasPagesPerDatabase((prev) => ({
      ...prev,
      [ATLAS_DATABASES.AGENTS]: agentDocs,
    }));
  }, []);

  return (
    <>
      <AtlasList atlasPagesPerDatabase={atlasPagesPerDatabase} uuidMappings={uuidMappings} />

      {/* Embed agent data as JSON in the HTML for client-side hydration */}
      <script
        id="agent-list-data"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(agentDocsForEmbed) }}
      />

      {/* Embed UUID mappings for client-side rendering */}
      <script
        id="uuid-mappings-data"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serializedUuidMappings) }}
      />

      <AgentsListHydrator onAgentsLoaded={handleAgentsLoaded} />
    </>
  );
}
