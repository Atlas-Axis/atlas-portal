'use client';

import { useEffect, useState } from 'react';
import { useDisclosure } from '@heroui/react';
import { ExportAtlasTreeDocument } from '@/app/server/atlas/export/types';
import { type UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import ContentTree from './content-tree';
import MobileTopBar from './mobile-top-bar';
import SearchModal from './search-modal';
import Sidebar from './sidebar';

interface AtlasPagePrerenderedProps {
  exportScopeTreesWithoutAgents: ExportAtlasTreeDocument[];
  uuidMappings: UuidMappings;
}

export default function AtlasPagePrerendered({
  exportScopeTreesWithoutAgents,
  uuidMappings,
}: AtlasPagePrerenderedProps) {
  const [scopeTreesWithoutAgents] = useState(exportScopeTreesWithoutAgents);
  const { isOpen: isSearchOpen, onOpen: onSearchOpen, onClose: onSearchClose } = useDisclosure();

  // Handle CMD+F / Ctrl+F keyboard shortcut to open search (single handler for entire page)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for CMD+F (Mac) or Ctrl+F (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
        event.preventDefault(); // Prevent browser's default find
        onSearchOpen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSearchOpen]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-white">
      <MobileTopBar scopeTrees={scopeTreesWithoutAgents} onSearchOpen={onSearchOpen} />
      <Sidebar scopeTrees={scopeTreesWithoutAgents} uuidMappings={uuidMappings} onSearchOpen={onSearchOpen} />
      <div className="min-w-0 pt-24 pb-24 sm:ml-80 sm:p-6 sm:pt-6 sm:pb-24">
        <ContentTree scopeTreesWithoutAgents={scopeTreesWithoutAgents} uuidMappings={uuidMappings} />
      </div>

      {/* Single SearchModal instance for the entire page */}
      <SearchModal
        scopeTrees={scopeTreesWithoutAgents}
        uuidMappings={uuidMappings}
        isOpen={isSearchOpen}
        onClose={onSearchClose}
      />
    </div>
  );
}
