'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { Accordion, AccordionItem } from '@heroui/accordion';
import { Input } from '@heroui/input';
import { Button, Checkbox, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger, useDisclosure } from '@heroui/react';
import { Download, Search, Settings } from 'lucide-react';
import type { StandardizedAtlasDocument } from '@/app/server/atlas/json-export/types';
import { compareDocNumbers } from '../server/atlas/atlas-utils';
import { UuidMappings } from '../server/atlas/load-uuid-mapping';
import { LOCAL_STORAGE_CHANGED_EVENT, SHOW_UUIDS_STORAGE_KEY } from './constants';
import { dispatchExpandScopeEvent } from './custom-events';
import SearchModal from './search-modal';

interface SidebarProps {
  scopeTrees: StandardizedAtlasDocument[];
  uuidMappings: UuidMappings;
}

interface RenderSidebarNodeProps {
  node: StandardizedAtlasDocument;
  depth?: number;
  activeHash: string;
  uuidMappings: UuidMappings;
}

/**
 * Type-safe helper to get child collection from a document
 */
function getChildCollection(node: StandardizedAtlasDocument, key: string): StandardizedAtlasDocument[] {
  const value = (node as unknown as Record<string, unknown>)[key];
  return Array.isArray(value) ? value : [];
}

function renderSidebarNode({
  node,
  depth = 0,
  activeHash,
  uuidMappings,
}: RenderSidebarNodeProps): React.ReactElement | null {
  // Collect only immutable and primary document children (exclude supporting documents)
  const scopes = getChildCollection(node, 'scopes');
  const articles = getChildCollection(node, 'articles');
  const sectionsAndPrimaryDocs = getChildCollection(node, 'sections_and_primary_docs');
  const agentScopeDocs = getChildCollection(node, 'agent_scope_database');

  const allChildren: StandardizedAtlasDocument[] = [
    ...scopes,
    ...articles,
    ...sectionsAndPrimaryDocs,
    ...agentScopeDocs,
  ];

  // Sort children by generatedDocID using compareDocNumbers
  const sortedChildren = allChildren.sort((a, b) => compareDocNumbers(a.doc_no || '', b.doc_no || ''));

  // Prevent infinite recursion
  if (depth > 50) {
    console.error('Maximum sidebar depth exceeded for node:', node.doc_no);
    return null;
  }

  // Check if this node is active
  const isActive = activeHash === (node.doc_no || '');

  // If node has no children, render as a simple clickable item
  if (sortedChildren.length === 0) {
    const nodeNotionId = node.uuid ? uuidMappings.atlasUUIDsToNotionPageIds.get(node.uuid) : null;
    return (
      <a
        key={nodeNotionId || node.doc_no || `node-${node.uuid || 'unknown'}`}
        className={`block rounded px-2 py-1 text-sm transition-all duration-300 ease-in-out hover:bg-slate-100 ${
          isActive ? 'text-blue-600' : ''
        }`}
        href={node.doc_no ? `#${node.doc_no}` : undefined}
        onClick={() => {
          if (node.doc_no) {
            // Trigger expansion and navigation to the target document
            dispatchExpandScopeEvent({
              targetDocID: node.doc_no,
            });
          }
        }}
      >
        {node.doc_no} - {node.name || 'Untitled'}
      </a>
    );
  }

  // If node has children, render as an accordion
  const nodeNotionId = node.uuid ? uuidMappings.atlasUUIDsToNotionPageIds.get(node.uuid) : null;
  return (
    <Accordion
      key={nodeNotionId || node.doc_no || `node-${node.uuid || 'unknown'}`}
      selectionMode="multiple"
      variant="light"
      className="px-0"
      disableAnimation={true}
    >
      <AccordionItem
        aria-label={`${node.doc_no} - ${node.name || 'Untitled'}`}
        title={
          <div
            className={`cursor-pointer text-sm transition-all duration-300 ease-in-out hover:text-blue-600 ${
              isActive ? 'text-blue-600' : ''
            }`}
            onClick={() => {
              // When clicking the title, navigate to hash
              if (node.doc_no) {
                // Trigger expansion and navigation to the target document
                dispatchExpandScopeEvent({
                  targetDocID: node.doc_no,
                });
              }
            }}
          >
            {node.doc_no} - {node.name || 'Untitled'}
          </div>
        }
        classNames={{
          base: 'px-0',
          trigger: 'px-2 py-1',
          content: 'px-0 pt-0 pb-1',
          indicator: 'hover:text-blue-600 hover:bg-slate-100 rounded-full p-2 cursor-pointer',
        }}
      >
        <div className="ml-3 border-l border-slate-200 pl-2">
          {sortedChildren.map((child) => (
            <div
              key={
                (child.uuid && uuidMappings.atlasUUIDsToNotionPageIds.get(child.uuid)) ||
                child.doc_no ||
                `node-${child.uuid || 'unknown'}`
              }
            >
              {renderSidebarNode({
                node: child,
                depth: depth + 1,
                activeHash,
                uuidMappings,
              })}
            </div>
          ))}
        </div>
      </AccordionItem>
    </Accordion>
  );
}

export default function Sidebar({ scopeTrees, uuidMappings }: SidebarProps) {
  const [activeHash, setActiveHash] = useState('');
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Detect platform for keyboard shortcut display (lazy initialization)
  const [isMac] = useState(() => {
    if (typeof window === 'undefined') return false;
    return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  });

  useEffect(() => {
    // Set initial hash (remove the '#' prefix)
    const updateHash = () => {
      setActiveHash(window.location.hash.slice(1));
    };

    updateHash();

    // Listen for hash changes
    window.addEventListener('hashchange', updateHash);
    return () => window.removeEventListener('hashchange', updateHash);
  }, []);

  // Handle CMD+F / Ctrl+F keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for CMD+F (Mac) or Ctrl+F (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
        event.preventDefault(); // Prevent browser's default find
        onOpen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpen]);

  // Handle initial hash on page load
  useEffect(() => {
    const initialHash = window.location.hash.slice(1);
    if (initialHash) {
      // Trigger expansion and navigation to the target document (content tree has debouncing)
      dispatchExpandScopeEvent({
        targetDocID: initialHash,
      });
    }
  }, []);

  if (scopeTrees.length === 0) {
    return null;
  }

  return (
    <>
      <div
        className="fixed top-0 left-0 hidden h-screen w-80 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-slate-50 md:flex"
        role="navigation"
        aria-label="Atlas navigation"
      >
        <div className="grow p-4">
          <div className="mb-6 flex items-center gap-3">
            <Image src="/images/sky.png" alt="Sky Logo" width={24} height={24} className="object-contain" />
            <h2 className="text-3xl font-semibold text-slate-900">Atlas</h2>
          </div>

          {/* Search Input Trigger */}
          <div className="mb-4">
            <Input
              placeholder="Search Atlas..."
              readOnly
              startContent={<Search className="h-4 w-4 text-slate-400" />}
              endContent={
                <kbd className="hidden rounded bg-slate-100 px-2 py-1 text-xs text-slate-500 sm:inline-block">
                  {isMac ? '⌘' : 'Ctrl+'}F
                </kbd>
              }
              onClick={onOpen}
              classNames={{
                inputWrapper:
                  'cursor-pointer transition-all duration-200 border border-slate-200 hover:border-blue-400 bg-white hover:bg-blue-100',
              }}
              aria-label="Open search dialog (CMD+F or Ctrl+F)"
            />
          </div>

          <div className="space-y-1">
            {scopeTrees.map((scopeTree) =>
              renderSidebarNode({
                node: scopeTree,
                depth: 0,
                activeHash,
                uuidMappings,
              }),
            )}
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 p-4">
          <DownloadAtlasButton />
          <SettingsDropdown />
        </div>
      </div>

      {/* Search Modal */}
      <SearchModal scopeTrees={scopeTrees} uuidMappings={uuidMappings} isOpen={isOpen} onClose={onClose} />
    </>
  );
}

function DownloadAtlasButton() {
  return (
    <Dropdown backdrop="blur">
      <DropdownTrigger>
        <Button
          variant="bordered"
          className="w-full"
          startContent={<Download className="text-default-500" size={16} />}
        >
          Download Atlas
        </Button>
      </DropdownTrigger>
      <DropdownMenu aria-label="Static Actions" className="w-full">
        <DropdownItem key="download-markdown" className="w-full">
          <Button
            variant="light"
            as="a"
            href="/api/atlas.md"
            target="_blank"
            startContent={<Download className="text-default-500" size={16} />}
          >
            Download as Markdown
          </Button>
        </DropdownItem>
        <DropdownItem key="download-json" className="w-full">
          <Button
            variant="light"
            as="a"
            href="/api/atlas.json"
            target="_blank"
            startContent={<Download className="text-default-500" size={16} />}
          >
            Download as JSON
          </Button>
        </DropdownItem>
        <DropdownItem key="download-yaml" className="w-full">
          <Button
            variant="light"
            as="a"
            href="/api/atlas.yaml"
            target="_blank"
            startContent={<Download className="text-default-500" size={16} />}
          >
            Download as YAML
          </Button>
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
}

function SettingsDropdown() {
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
      </DropdownMenu>
    </Dropdown>
  );
}
