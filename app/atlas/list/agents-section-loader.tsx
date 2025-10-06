'use client';

import { useEffect, useState } from 'react';
import { AtlasTreeNode } from '@/app/server/atlas/atlas-tree-types';

interface AgentsSectionProps {
  onAgentsLoaded: (agentNodes: AtlasTreeNode[]) => void;
}

export default function AgentsSection({ onAgentsLoaded }: AgentsSectionProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAgents = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch('/api/atlas/agents');
        if (!response.ok) {
          throw new Error('Failed to load agents data');
        }

        const data = await response.json();
        onAgentsLoaded(data.agentNodes);
      } catch (err) {
        console.error('Error loading agents:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    loadAgents();
  }, [onAgentsLoaded]);

  if (isLoading) {
    return <div className="mb-4 text-sm text-gray-400">Loading agents data...</div>;
  }

  if (error) {
    return <div className="mb-4 text-sm text-red-500">Error loading agents: {error}</div>;
  }

  return null; // The actual agents content is handled by the parent component
}
