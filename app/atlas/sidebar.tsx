'use client';

import { useEffect, useState } from 'react';
import { Accordion, AccordionItem } from '@heroui/accordion';
import type { StandardizedAtlasDocument } from '@/app/server/atlas/json-export/types';
import { compareDocNumbers } from '../server/atlas/atlas-utils';
import { UuidMappings } from '../server/atlas/load-uuid-mapping';

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

function renderSidebarNode({
  node,
  depth = 0,
  activeHash,
  uuidMappings,
}: RenderSidebarNodeProps): React.ReactElement | null {
  // Collect only immutable and primary document children (exclude supporting documents)
  const scopes = (node as StandardizedAtlasDocument & { scopes?: StandardizedAtlasDocument[] }).scopes || [];
  const articles = (node as StandardizedAtlasDocument & { articles?: StandardizedAtlasDocument[] }).articles || [];
  const sectionsAndPrimaryDocs =
    (
      node as StandardizedAtlasDocument & {
        sections_and_primary_docs?: StandardizedAtlasDocument[];
      }
    ).sections_and_primary_docs || [];
  const agentScopeDocs =
    (
      node as StandardizedAtlasDocument & {
        agent_scope_database?: StandardizedAtlasDocument[];
      }
    ).agent_scope_database || [];

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
            // Extract root scope from document ID (e.g., A.2.9 -> A.2)
            const rootScopeDocID = node.doc_no.split('.').slice(0, 2).join('.');
            // Trigger expansion of the target scope
            const event = new CustomEvent('expandScope', {
              detail: { rootScopeDocID },
            });
            window.dispatchEvent(event);
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
              // Prevent accordion toggle when clicking the title; navigate to hash
              if (node.doc_no) {
                // Extract root scope from document ID (e.g., A.2.9 -> A.2)
                const rootScopeDocID = node.doc_no.split('.').slice(0, 2).join('.');
                // Trigger expansion of the target scope
                const event = new CustomEvent('expandScope', {
                  detail: { scopeId: rootScopeDocID },
                });
                window.dispatchEvent(event);
                window.location.hash = node.doc_no;
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

  if (scopeTrees.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 hidden h-screen w-80 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50 md:block"
      role="navigation"
      aria-label="Atlas navigation"
    >
      <div className="p-4">
        <div className="mb-4 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://makerdao-forum-backup.s3.dualstack.us-east-1.amazonaws.com/original/3X/1/9/19cc0c65340a5e0c48cd777583fa119c4a4dad84.png"
            alt="Sky Logo"
            className="h-6 w-6 object-contain"
          />
          <h2 className="text-3xl font-semibold text-slate-900">Atlas</h2>
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
    </div>
  );
}
