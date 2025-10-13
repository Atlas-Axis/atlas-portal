'use client';

import { useEffect, useState } from 'react';
import { Accordion, AccordionItem } from '@heroui/accordion';
import type { AtlasTreeNode, AtlasTreeResult } from '@/app/server/atlas/atlas-tree-types';
import { compareDocNumbers } from '../server/atlas/atlas-utils';

interface SidebarProps {
  atlas: AtlasTreeResult;
}

interface RenderSidebarNodeProps {
  node: AtlasTreeNode;
  depth?: number;
  activeHash: string;
}

function renderSidebarNode({ node, depth = 0, activeHash }: RenderSidebarNodeProps): React.ReactElement | null {
  // Collect only immutable and primary document children (exclude supporting documents)
  const allChildren: AtlasTreeNode[] = [
    ...node.scopes,
    ...node.articles,
    ...node.sectionsAndPrimaryDocs,
    ...node.agentScopeDocs,
  ];

  // Sort children by generatedDocID using compareDocNumbers
  const sortedChildren = allChildren.sort((a, b) => {
    const aId = a.generatedDocID || '';
    const bId = b.generatedDocID || '';
    return compareDocNumbers(aId, bId);
  });

  // Prevent infinite recursion
  if (depth > 50) {
    console.error('Maximum sidebar depth exceeded for node:', node.generatedDocID);
    return null;
  }

  // Check if this node is active
  const isActive = activeHash === node.generatedDocID;

  // If node has no children, render as a simple clickable item
  if (sortedChildren.length === 0) {
    return (
      <a
        key={node.notion_page_id}
        className={`block rounded px-2 py-1 text-sm transition-all duration-300 ease-in-out hover:bg-slate-100 ${
          isActive ? 'text-blue-600' : ''
        }`}
        href={node.generatedDocID ? `#${node.generatedDocID}` : undefined}
      >
        {node.generatedDocID} - {node.generatedDocName || 'Untitled'}
      </a>
    );
  }

  // If node has children, render as an accordion
  return (
    <Accordion
      key={node.notion_page_id}
      selectionMode="multiple"
      variant="light"
      className="px-0"
      disableAnimation={true}
    >
      <AccordionItem
        aria-label={`${node.generatedDocID} - ${node.generatedDocName || 'Untitled'}`}
        title={
          <div
            className={`cursor-pointer text-sm transition-all duration-300 ease-in-out hover:text-blue-600 ${
              isActive ? 'text-blue-600' : ''
            }`}
            onClick={() => {
              // Prevent accordion toggle when clicking the title; navigate to hash
              if (node.generatedDocID) {
                window.location.hash = node.generatedDocID;
              }
            }}
          >
            {node.generatedDocID} - {node.generatedDocName || 'Untitled'}
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
            <div key={child.notion_page_id}>
              {renderSidebarNode({
                node: child,
                depth: depth + 1,
                activeHash,
              })}
            </div>
          ))}
        </div>
      </AccordionItem>
    </Accordion>
  );
}

export default function Sidebar({ atlas }: SidebarProps) {
  const { scopeTrees } = atlas;
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
            }),
          )}
        </div>
      </div>
    </div>
  );
}
