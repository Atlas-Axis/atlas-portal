'use client';

import { Accordion, AccordionItem } from '@heroui/accordion';
import type { AtlasTreeNode, AtlasTreeResult } from '@/app/server/atlas/atlas-tree-types';
import { compareDocNumbers } from '../server/atlas/atlas-utils';

interface SidebarProps {
  atlas: AtlasTreeResult;
}

interface RenderSidebarNodeProps {
  node: AtlasTreeNode;
  depth?: number;
}

function renderSidebarNode({ node, depth = 0 }: RenderSidebarNodeProps): React.ReactElement | null {
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

  // If node has no children, render as a simple clickable item
  if (sortedChildren.length === 0) {
    return (
      <a
        key={node.notion_page_id}
        className="block rounded px-2 py-1 text-sm transition-colors hover:bg-slate-100"
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
      //   disableAnimation={true}
    >
      <AccordionItem
        aria-label={`${node.generatedDocID} - ${node.generatedDocName || 'Untitled'}`}
        title={
          <div
            className="cursor-pointer text-sm transition-colors hover:text-blue-600"
            onClick={(e) => {
              // Prevent accordion toggle when clicking the title; navigate to hash
              e.stopPropagation();
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
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Atlas</h2>
        <div className="space-y-1">
          {scopeTrees.map((scopeTree) =>
            renderSidebarNode({
              node: scopeTree,
              depth: 0,
            }),
          )}
        </div>
      </div>
    </div>
  );
}
