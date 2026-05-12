'use client';

import Image from 'next/image';
import { Button, Popover, PopoverContent, PopoverTrigger } from '@heroui/react';
import { Download, Search, Settings } from 'lucide-react';
import DownloadAtlasButton from './download-atlas-button';
import SettingsDropdown from './settings-dropdown';

interface MobileTopBarProps {
  scopeTrees: unknown[]; // Only used to check if we have data
  onSearchOpen: () => void;
}

export default function MobileTopBar({ scopeTrees, onSearchOpen }: MobileTopBarProps) {
  if (scopeTrees.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed top-12 right-0 left-0 z-40 flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 sm:hidden dark:border-zinc-800 dark:bg-zinc-950"
      role="banner"
      aria-label="Mobile navigation"
    >
      {/* Left side: Logo and Title */}
      <div className="flex items-center gap-2">
        <Image src="/images/sky.png" alt="Sky Logo" width={24} height={24} className="object-contain" priority />
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Atlas</h1>
      </div>

      {/* Right side: Icon buttons */}
      <div className="flex items-center gap-1">
        <Button isIconOnly variant="light" onPress={onSearchOpen} aria-label="Search" className="min-h-10 min-w-10">
          <Search size={20} className="text-slate-600 dark:text-slate-300" />
        </Button>

        <Popover backdrop="blur" placement="bottom-end">
          <PopoverTrigger>
            <Button isIconOnly variant="light" aria-label="Download Atlas" className="min-h-10 min-w-10">
              <Download size={20} className="text-slate-600 dark:text-slate-300" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0">
            <DownloadAtlasButton />
          </PopoverContent>
        </Popover>

        <Popover backdrop="blur" placement="bottom-end">
          <PopoverTrigger>
            <Button isIconOnly variant="light" aria-label="Settings" className="min-h-10 min-w-10">
              <Settings size={20} className="text-slate-600 dark:text-slate-300" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0">
            <SettingsDropdown />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
