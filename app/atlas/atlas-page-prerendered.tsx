'use client';

import { useState } from 'react';
import { StandardizedAtlasDocument } from '@/app/server/atlas/json-export/types';
import { type UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import ContentTree from './content-tree';
import Sidebar from './sidebar';

interface AtlasPagePrerenderedProps {
  standardizedScopeTreesWithoutAgents: StandardizedAtlasDocument[];
  uuidMappings: UuidMappings;
}

export default function AtlasPagePrerendered({
  standardizedScopeTreesWithoutAgents,
  uuidMappings,
}: AtlasPagePrerenderedProps) {
  const [scopeTreesWithoutAgents] = useState(standardizedScopeTreesWithoutAgents);

  return (
    <div className="min-h-screen overflow-x-hidden bg-white">
      <Sidebar scopeTrees={scopeTreesWithoutAgents} uuidMappings={uuidMappings} />
      <div className="min-w-0 p-6 md:ml-80">
        <ContentTree
          scopeTreesWithoutAgents={scopeTreesWithoutAgents}
          uuidMappings={uuidMappings}
          agentsLoading={false}
        />
      </div>
    </div>
  );
}
