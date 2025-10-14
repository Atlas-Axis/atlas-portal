'use client';

import { useCallback, useMemo, useState } from 'react';
import { AtlasTreeNode } from '@/app/server/atlas/atlas-tree-types';
import { ATLAS_DATABASES } from '@/app/server/atlas/constants';
import { atlasNodeToStandardized } from '@/app/server/atlas/json-export/atlas-node-tree-to-standardized-atlas-node-tree';
import { flattenStandardizedAtlasDocuments } from '@/app/server/atlas/json-export/flatten-standardized-atlas-documents';
import { StandardizedAtlasDocument } from '@/app/server/atlas/json-export/types';
import { UuidMappings, serializeUuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import AgentsListHydrator from './agents-list-hydrator';
import AtlasList from './atlas-list';

interface AtlasListWithAgentsProps {
  initialAtlasNodesPerDatabase: Record<string, AtlasTreeNode[]>;
  uuidMappings: UuidMappings;
}

export default function AtlasListPrerendered({ initialAtlasNodesPerDatabase, uuidMappings }: AtlasListWithAgentsProps) {
  const [atlasPagesPerDatabase, setAtlasPagesPerDatabase] =
    useState<Record<string, (AtlasTreeNode | StandardizedAtlasDocument)[]>>(initialAtlasNodesPerDatabase);

  // Extract and convert agent nodes to StandardizedAtlasDocument for embedding
  const { standardizedAgentDocs, serializedUuidMappings } = useMemo(() => {
    const agentNodes = initialAtlasNodesPerDatabase[ATLAS_DATABASES.AGENTS] || [];

    // Convert agent nodes to StandardizedAtlasDocument[]
    const standardizedAgentDocs = agentNodes.map((node) => atlasNodeToStandardized(node, uuidMappings));

    // Flatten to get flat array grouped by database
    const flattenedAgents = flattenStandardizedAtlasDocuments(standardizedAgentDocs);

    // Get just the Agent Scope Database documents
    const agentScopeDocs = flattenedAgents[ATLAS_DATABASES.AGENTS] || [];

    // Serialize UUID mappings for embedding
    const serializedUuidMappings = serializeUuidMappings(uuidMappings);

    return { standardizedAgentDocs: agentScopeDocs, serializedUuidMappings };
  }, [initialAtlasNodesPerDatabase, uuidMappings]);

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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(standardizedAgentDocs) }}
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
