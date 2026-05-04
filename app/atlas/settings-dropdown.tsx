'use client';

import { useEffect, useState } from 'react';
import { Button, Checkbox, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@heroui/react';
import { Settings } from 'lucide-react';
import { LOCAL_STORAGE_CHANGED_EVENT, SHOW_UUIDS_STORAGE_KEY } from './constants';
import ThemeToggle from './theme-toggle';

export default function SettingsDropdown() {
  // Initialize state from localStorage
  const [showUUIDs, setShowUUIDs] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = localStorage.getItem(SHOW_UUIDS_STORAGE_KEY);
      return stored === 'true';
    } catch {
      return false;
    }
  });

  // Save to localStorage whenever showUUIDs changes
  useEffect(() => {
    try {
      localStorage.setItem(SHOW_UUIDS_STORAGE_KEY, String(showUUIDs));
      // Dispatch custom event to notify other components in same window
      window.dispatchEvent(new Event(LOCAL_STORAGE_CHANGED_EVENT));
    } catch (error) {
      // Handle localStorage errors (e.g., quota exceeded, private browsing)
      console.error('Failed to save showUUIDs setting to localStorage:', error);
    }
  }, [showUUIDs]);

  return (
    <Dropdown backdrop="blur">
      <DropdownTrigger>
        <Button variant="light" className="w-full" startContent={<Settings className="text-default-500" size={16} />}>
          Settings
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label="Settings Menu" className="w-full">
        <DropdownItem key="show-uuids" className="w-full" textValue="Show UUIDs">
          <Checkbox
            isSelected={showUUIDs}
            onValueChange={setShowUUIDs}
            classNames={{
              base: 'w-full max-w-full ',
            }}
          >
            <span className="text-sm">Show UUIDs</span>
          </Checkbox>
        </DropdownItem>
        <DropdownItem key="theme-toggle" className="w-full" textValue="Toggle theme">
          <ThemeToggle />
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}
