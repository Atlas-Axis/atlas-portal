'use client';

import { useState } from 'react';
import { InputGroup } from '@heroui/react';
import { Search } from 'lucide-react';

interface SearchTriggerProps {
  onOpen: () => void;
}

export default function SearchTrigger({ onOpen }: SearchTriggerProps) {
  // Detect platform for keyboard shortcut display (lazy initialization)
  const [isMac] = useState(() => {
    if (typeof window === 'undefined') return false;
    return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  });

  return (
    <div onClick={onOpen} className="cursor-pointer">
      <InputGroup className="cursor-pointer border border-slate-200 bg-white transition-all duration-200 hover:border-blue-400 hover:bg-blue-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800">
        <InputGroup.Prefix>
          <Search className="h-4 w-4 text-slate-400" />
        </InputGroup.Prefix>
        <InputGroup.Input
          placeholder="Search Atlas..."
          readOnly
          className="cursor-pointer"
          aria-label="Open search dialog (CMD+F or Ctrl+F)"
        />
        <InputGroup.Suffix>
          <kbd
            className="hidden rounded bg-slate-100 px-2 py-1 text-xs text-slate-500 sm:inline-block dark:bg-zinc-800 dark:text-slate-300"
            suppressHydrationWarning
          >
            {isMac ? '⌘' : 'Ctrl+'}F
          </kbd>
        </InputGroup.Suffix>
      </InputGroup>
    </div>
  );
}
