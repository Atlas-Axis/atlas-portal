'use client';

import { useState } from 'react';
import { StandardizedAtlasDocument } from '@/app/server/atlas/json-export/types';
import { type UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import ContentTree from './content-tree';
import MobileTopBar from './mobile-top-bar';
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
      <MobileTopBar scopeTrees={scopeTreesWithoutAgents} uuidMappings={uuidMappings} />
      <Sidebar scopeTrees={scopeTreesWithoutAgents} uuidMappings={uuidMappings} />
      <div className="min-w-0 pt-24 pb-24 sm:ml-80 sm:p-6 sm:pt-6 sm:pb-24">
        <ContentTree scopeTreesWithoutAgents={scopeTreesWithoutAgents} uuidMappings={uuidMappings} />
      </div>
    </div>
  );
}
