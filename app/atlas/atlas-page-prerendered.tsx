'use client';

import { useCallback, useMemo, useState } from 'react';
import { StandardizedAtlasDocument } from '@/app/server/atlas/json-export/types';
import { type UuidMappings, serializeUuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import AgentsHydrator from './agents-hydrator';
import ContentTree from './content-tree';
import Sidebar from './sidebar';

interface AtlasPagePrerenderedProps {
  standardizedScopeTreesWithoutAgents: StandardizedAtlasDocument[];
  standardizedAgentDocs: StandardizedAtlasDocument[];
  uuidMappings: UuidMappings;
}

export default function AtlasPagePrerendered({
  standardizedScopeTreesWithoutAgents,
  standardizedAgentDocs,
  uuidMappings,
}: AtlasPagePrerenderedProps) {
  const [scopeTreesWithoutAgents] = useState(standardizedScopeTreesWithoutAgents);
  const [agentDocs, setAgentDocs] = useState<StandardizedAtlasDocument[]>(standardizedAgentDocs);
  const [agentsLoaded, setAgentsLoaded] = useState(false);

  const serializedUuidMappings = useMemo(() => serializeUuidMappings(uuidMappings), [uuidMappings]);

  const handleAgentsLoaded = useCallback((loadedAgentDocs: StandardizedAtlasDocument[]) => {
    setAgentDocs(loadedAgentDocs);
    setAgentsLoaded(true);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-white">
      <Sidebar scopeTrees={scopeTreesWithoutAgents} uuidMappings={uuidMappings} />
      <div className="min-w-0 p-6 md:ml-80">
        <ContentTree
          scopeTreesWithoutAgents={scopeTreesWithoutAgents}
          uuidMappings={uuidMappings}
          agentsLoading={!agentsLoaded}
          agentDocs={agentDocs}
        />
      </div>

      {/* Embed agent data as JSON in the HTML for client-side hydration */}
      <script
        id="agent-data"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(standardizedAgentDocs) }}
      />

      {/* Embed UUID mappings for client-side rendering */}
      <script
        id="uuid-mappings-data"
        type="application/json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serializedUuidMappings) }}
      />

      <AgentsHydrator onAgentsLoaded={handleAgentsLoaded} />
    </div>
  );
}
