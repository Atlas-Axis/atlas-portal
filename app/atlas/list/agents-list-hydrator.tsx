'use client';

import { useEffect, useRef, useState } from 'react';
import type { AtlasTreeNode } from '@/app/server/atlas/atlas-tree-types';

interface AgentsListHydratorProps {
  onAgentsLoaded: (agentNodes: AtlasTreeNode[]) => void;
}

export default function AgentsListHydrator({ onAgentsLoaded }: AgentsListHydratorProps) {
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
        const script = document.getElementById('agent-list-data');
        if (!script?.textContent) {
          throw new Error('Agent data not found in page');
        }

        const agentNodes: AtlasTreeNode[] = JSON.parse(script.textContent);

        // Validate parsed data
        if (!Array.isArray(agentNodes)) {
          throw new Error('Invalid agent data format: expected array');
        }

        onAgentsLoaded(agentNodes);
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
