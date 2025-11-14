'use client';

import Image from 'next/image';
import { useEffect } from 'react';
import { Button, Popover, PopoverContent, PopoverTrigger, useDisclosure } from '@heroui/react';
import { Download, Search, Settings } from 'lucide-react';
import type { ExportAtlasTreeDocument } from '@/app/server/atlas/export/types';
import { UuidMappings } from '../server/atlas/load-uuid-mapping';
import DownloadAtlasButton from './download-atlas-button';
import SearchModal from './search-modal';
import SettingsDropdown from './settings-dropdown';

interface MobileTopBarProps {
  scopeTrees: ExportAtlasTreeDocument[];
  uuidMappings: UuidMappings;
}

export default function MobileTopBar({ scopeTrees, uuidMappings }: MobileTopBarProps) {
  const { isOpen: isSearchOpen, onOpen: onSearchOpen, onClose: onSearchClose } = useDisclosure();

  // Handle CMD+F / Ctrl+F keyboard shortcut to open search
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
    <>
      <div
        className="fixed top-0 right-0 left-0 z-50 flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 sm:hidden"
        role="banner"
        aria-label="Mobile navigation"
      >
        {/* Left side: Logo and Title */}
        <div className="flex items-center gap-2">
          <Image src="/images/sky.png" alt="Sky Logo" width={24} height={24} className="object-contain" priority />
          <h1 className="text-xl font-semibold text-slate-900">Atlas</h1>
        </div>

        {/* Right side: Icon buttons */}
        <div className="flex items-center gap-1">
          <Button isIconOnly variant="light" onPress={onSearchOpen} aria-label="Search" className="min-h-10 min-w-10">
            <Search size={20} className="text-slate-600" />
          </Button>

          <Popover backdrop="blur" placement="bottom-end">
            <PopoverTrigger>
              <Button isIconOnly variant="light" aria-label="Download Atlas" className="min-h-10 min-w-10">
                <Download size={20} className="text-slate-600" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0">
              <DownloadAtlasButton />
            </PopoverContent>
          </Popover>

          <Popover backdrop="blur" placement="bottom-end">
            <PopoverTrigger>
              <Button isIconOnly variant="light" aria-label="Settings" className="min-h-10 min-w-10">
                <Settings size={20} className="text-slate-600" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0">
              <SettingsDropdown />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Search Modal */}
      <SearchModal scopeTrees={scopeTrees} uuidMappings={uuidMappings} isOpen={isSearchOpen} onClose={onSearchClose} />
    </>
  );
}
