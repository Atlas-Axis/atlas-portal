'use client';

import { useState } from 'react';
import { Accordion, AccordionItem } from '@heroui/accordion';
import { Button, ButtonGroup } from '@heroui/react';
import type { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { uuidToNoHyphens } from '@/app/shared/utils/utils';
import type { AtlasTreeNode, AtlasTreeResult } from '@/scripts/atlas-json/atlas-tree-types';
import styles from './content-tree.module.css';
import PageExtraData from './page-extra-data';
import TypeChip from './type-chip';

interface RenderTreeNodeProps {
  node: AtlasTreeNode;
  parentTrackingMap: Map<string, string>;
  depth?: number;
  isRootNode?: boolean;
  parentPageId?: string;
}

function renderTreeNodeHeader(node: AtlasTreeNode) {
  const documentType = node?.atlas_document_type;
  const isCategory = documentType === 'Category';

  if (isCategory) {
    return (
      <h3 className={`inline-block rounded-lg bg-stone-200 px-4 py-2 text-lg font-bold text-stone-900`}>
        {node.generatedDocName}
      </h3>
    );
  }

  return (
    <h3 className={styles.nodeTitle}>
      {node.generatedDocID} - {node.generatedDocName}
      <span className={styles.typeChipSpacing}>
        <TypeChip type={node.atlas_document_type} />
      </span>
    </h3>
  );
}

function renderTreeNode({
  node,
  parentTrackingMap,
  depth = 0,
  isRootNode = false,
  parentPageId,
}: RenderTreeNodeProps): React.ReactElement {
  const content = node?.plain_text_content || ``;

  // Get children from the tree node structure
  const immutableAndPrimaryDocumentPages = [
    ...node.scopes,
    ...node.articles,
    ...node.sectionsAndPrimaryDocs,
    ...node.agentScopeDocs,
  ];

  const supportingDocumentPages = [
    ...node.annotations,
    ...node.tenets,
    ...node.scenarios,
    ...node.scenarioVariations,
    ...node.activeData,
    ...node.neededResearch,
  ];

  if (depth > 50) {
    throw new Error('Maximum tree depth exceeded, possible circular reference');
  }

  // Track parent relationships and detect duplicates
  if (!isRootNode && parentPageId) {
    logIfDuplicatedDocument(node, parentPageId, parentTrackingMap);
  }

  const nodeContent = (
    <>
      {!isRootNode && renderTreeNodeHeader(node)}

      <div className={`${styles.nodeContent} ${isRootNode ? styles.nodeContentRoot : ''}`}>{content}</div>

      <PageExtraData page={node as unknown as NotionDatabasePage} className={styles.nodeContent} />

      <div className={`${styles.notionLink} ${isRootNode ? styles.notionLinkRoot : ''}`}>
        <a
          href={`https://www.notion.so/${uuidToNoHyphens(node.notion_page_id)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.notionLinkAnchor}
        >
          {`Notion ID: ${uuidToNoHyphens(node.notion_page_id)}`}
        </a>
      </div>

      {immutableAndPrimaryDocumentPages.length > 0 && (
        <ul className={styles.immutableDocsList}>
          {immutableAndPrimaryDocumentPages.map((child) =>
            renderTreeNode({
              node: child,
              parentTrackingMap,
              depth: depth + 1,
              isRootNode: false,
              parentPageId: node.notion_page_id,
            }),
          )}
        </ul>
      )}

      {supportingDocumentPages.length > 0 && (
        <div className={styles.supportingDocsContainer}>
          <span className={styles.supportingDocsLabel}>Supporting Documents:</span>
          <ul className={styles.supportingDocsList}>
            {supportingDocumentPages.map((child) =>
              renderTreeNode({
                node: child,
                parentTrackingMap,
                depth: depth + 1,
                isRootNode: false,
                parentPageId: node.notion_page_id,
              }),
            )}
          </ul>
        </div>
      )}
    </>
  );

  if (isRootNode) {
    return (
      <h3 className={styles.rootTitle} key={node.notion_page_id}>
        {nodeContent}
      </h3>
    );
  }

  return (
    <li key={node.notion_page_id} className={styles.listItem}>
      {nodeContent}
    </li>
  );
}

export default function ContentTree({ atlas }: { atlas: AtlasTreeResult }) {
  const { scopeTrees, orphanedNodes } = atlas;

  // Create a map to track which parent each page is rendered under
  const parentTrackingMap = new Map<string, string>();

  // State to control which accordion items are expanded
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    const firstPageId = scopeTrees?.[0]?.notion_page_id;
    return new Set(firstPageId ? [firstPageId] : []);
  });

  // Calculate total nodes for debugging
  // TODO: Use a page-id map instead for efficiency
  const totalNodes = scopeTrees.reduce((count, tree) => {
    let nodeCount = 0;
    const countNodes = (node: AtlasTreeNode): void => {
      nodeCount++;
      [
        ...node.scopes,
        ...node.articles,
        ...node.sectionsAndPrimaryDocs,
        ...node.agentScopeDocs,
        ...node.annotations,
        ...node.tenets,
        ...node.scenarios,
        ...node.scenarioVariations,
        ...node.activeData,
        ...node.neededResearch,
      ].forEach(countNodes);
    };
    countNodes(tree);
    return count + nodeCount;
  }, 0);

  console.log(`🗺️ Rendering Atlas content tree with ${totalNodes} total nodes`);
  console.log(`🌳 Found ${scopeTrees.length} scope trees, ${orphanedNodes.length} orphaned nodes`);

  // Function to expand all accordions
  const expandAll = () => {
    const allKeys = scopeTrees.map((tree) => tree.notion_page_id);
    setExpandedKeys(new Set(allKeys));
  };

  // Function to collapse all accordions
  const collapseAll = () => {
    setExpandedKeys(new Set());
  };

  if (scopeTrees.length === 0) {
    return <div>No Scopes found in Atlas</div>;
  }

  return (
    <div className={styles.containerMain}>
      <div className="flex items-center gap-6">
        <h3 className={styles.headerTitle}>Atlas</h3>
        {/* Expand/Collapse All Buttons */}
        <div>
          <ButtonGroup>
            <Button onPress={expandAll} variant="flat" size="sm">
              Expand All
            </Button>
            <Button onPress={collapseAll} variant="flat" size="sm">
              Collapse All
            </Button>
          </ButtonGroup>
        </div>
      </div>

      <div className="my-6 text-slate-300">Click on a scope to expand/collapse its contents.</div>

      <Accordion
        disableAnimation={true}
        selectionMode="multiple"
        variant="splitted"
        className="space-y-6"
        selectedKeys={expandedKeys}
        onSelectionChange={(keys) => {
          if (typeof keys === 'string') {
            setExpandedKeys(new Set([keys]));
          } else {
            setExpandedKeys(new Set(Array.from(keys).map((key) => String(key))));
          }
        }}
      >
        {scopeTrees.map((scopeTree) => (
          <AccordionItem
            key={scopeTree.notion_page_id}
            aria-label={scopeTree.canonical_document_title || `Document ${scopeTree.notion_page_id}`}
            title={
              <div className={`${styles.accordionTitle} text-xl font-semibold text-gray-900`}>
                <span>
                  {scopeTree.generatedDocID} - {scopeTree.generatedDocName}
                </span>
                <TypeChip type={scopeTree.atlas_document_type} />
              </div>
            }
            classNames={{ heading: 'bg-slate-100 rounded-md p-3 text-indigo-900', base: 'px-0 shadow-none' }}
          >
            {renderTreeNode({
              node: scopeTree,
              parentTrackingMap,
              depth: 0,
              isRootNode: true,
            })}
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

// Helper function to log if a document is duplicated under different parents
function logIfDuplicatedDocument(
  node: AtlasTreeNode,
  parentPageId: string,
  parentTrackingMap: Map<string, string>,
): void {
  const currentPageId = node.notion_page_id;
  const existingParentId = parentTrackingMap.get(currentPageId);

  if (existingParentId && existingParentId !== parentPageId) {
    console.warn(`‼️ This Atlas document has already been rendered under a different parent:`, {
      pageId: currentPageId,
      canonicalTitle: node.canonical_document_title,
      existingParent: {
        id: existingParentId,
        title: 'Unknown (would need lookup)', // TODO
      },
      newParent: {
        id: parentPageId,
        title: 'Unknown (would need lookup)', // TODO
      },
    });
  } else {
    parentTrackingMap.set(currentPageId, parentPageId);
  }
}
