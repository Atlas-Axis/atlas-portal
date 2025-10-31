'use client';

import { Input } from '@heroui/input';
import { Search } from 'lucide-react';

interface SearchTriggerProps {
  onOpen: () => void;
  isMac: boolean;
}

export default function SearchTrigger({ onOpen, isMac }: SearchTriggerProps) {
  return (
    <div onClick={onOpen} className="cursor-pointer">
      <Input
        placeholder="Search Atlas..."
        readOnly
        startContent={<Search className="h-4 w-4 text-slate-400" />}
        endContent={
          <kbd className="hidden rounded bg-slate-100 px-2 py-1 text-xs text-slate-500 sm:inline-block">
            {isMac ? '⌘' : 'Ctrl+'}F
          </kbd>
        }
        classNames={{
          inputWrapper:
            'cursor-pointer transition-all duration-200 border border-slate-200 hover:border-blue-400 bg-white hover:bg-blue-100',
        }}
        aria-label="Open search dialog (CMD+F or Ctrl+F)"
      />
    </div>
  );
}
