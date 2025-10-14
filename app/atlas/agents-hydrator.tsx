'use client';

import { useEffect, useRef, useState } from 'react';
import { StandardizedAtlasDocument } from '@/app/server/atlas/json-export/types';
import { type SerializedUuidMappings, deserializeUuidMappings } from '@/app/server/atlas/load-uuid-mapping';

interface AgentsHydratorProps {
  onAgentsLoaded: (agentDocs: StandardizedAtlasDocument[]) => void;
}

export default function AgentsHydrator({ onAgentsLoaded }: AgentsHydratorProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasHydrated = useRef(false);

  useEffect(() => {
    // Prevent double hydration in React StrictMode
    if (hasHydrated.current) {
      return;
    }
    hasHydrated.current = true;

    const hydrateAgents = () => {
      try {
        // Read agent data from embedded JSON
        const agentScript = document.getElementById('agent-data');
        if (!agentScript?.textContent) {
          throw new Error('Agent data not found in page');
        }

        const agentDocs: StandardizedAtlasDocument[] = JSON.parse(agentScript.textContent);

        // Validate parsed data
        if (!Array.isArray(agentDocs)) {
          throw new Error('Invalid agent data format: expected array');
        }

        // Read UUID mappings from embedded JSON
        const uuidMappingsScript = document.getElementById('uuid-mappings-data');
        if (!uuidMappingsScript?.textContent) {
          throw new Error('UUID mappings data not found in page');
        }

        const serializedMappings: SerializedUuidMappings = JSON.parse(uuidMappingsScript.textContent);
        const uuidMappings = deserializeUuidMappings(serializedMappings);

        // Store UUID mappings in window for use by rendering components
        (window as typeof window & { __atlasUuidMappings?: typeof uuidMappings }).__atlasUuidMappings = uuidMappings;

        // Pass agent docs directly to parent - no tree rebuilding needed
        // The ContentTree will render them at the appropriate location
        onAgentsLoaded(agentDocs);
      } catch (err) {
        console.error('Error hydrating agents:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    // Run hydration after component mounts
    hydrateAgents();
    // Only run once on mount - we use a ref to ensure single execution
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (isLoading) {
    return (
      <div className="fixed right-4 bottom-4 rounded bg-white px-3 py-2 text-sm text-gray-400 shadow">
        Loading agents...
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed right-4 bottom-4 rounded bg-white px-3 py-2 text-sm text-red-500 shadow">
        Error loading agents: {error}
      </div>
    );
  }

  return null;
}
