'use client';

import { useMemo, useState } from 'react';
import { Accordion, AccordionItem } from '@heroui/accordion';
import { Button, ButtonGroup } from '@heroui/react';
import type { AtlasTreeNode, AtlasTreeResult } from '@/app/server/atlas/atlas-tree-types';
import { AtlasDocumentType } from '@/app/server/atlas/constants';
import { typeColorMap } from '@/app/server/atlas/type-color-map';
import type { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { uuidToNoHyphens } from '@/app/shared/utils/utils';
import { CustomHTML } from '../components/custom-html';
import { atlasDatabasePageToHTML } from '../server/atlas/atlas-rich-text-formatter';
import { UuidMappings } from '../server/atlas/load-uuid-mapping';
import styles from './content-tree.module.css';
import PageExtraData from './page-extra-data';
import TypeChip from './type-chip';

interface RenderTreeNodeProps {
  node: AtlasTreeNode;
  parentTrackingMap: Map<string, string>;
  depth?: number;
  isRootNode?: boolean;
  parentPageId?: string;
  uuidMappings: UuidMappings;
}

function renderSupportingDocumentListInSameType({
  label,
  documentType,
  documents,
  node,
  parentTrackingMap,
  depth,
  uuidMappings,
}: {
  label: string;
  documentType: AtlasDocumentType;
  documents: AtlasTreeNode[];
  node: AtlasTreeNode;
  parentTrackingMap: Map<string, string>;
  depth: number;
  uuidMappings: UuidMappings;
}) {
  const colorStyles = typeColorMap[documentType] || 'bg-gray-100 text-gray-800';

  return (
    <div className="mt-2 ml-0">
      <span className={`${colorStyles} rounded px-2 py-1 text-sm`}>{label}</span>
      <ul className={styles.supportingDocsList}>
        {documents.map((child) =>
          renderTreeNode({
            node: child,
            parentTrackingMap,
            depth: depth + 1,
            isRootNode: false,
            parentPageId: node.notion_page_id,
            uuidMappings,
          }),
        )}
      </ul>
    </div>
  );
}

function renderSupportingDocuments({
  node,
  parentTrackingMap,
  depth,
  uuidMappings,
}: {
  node: AtlasTreeNode;
  parentTrackingMap: Map<string, string>;
  depth: number;
  uuidMappings: UuidMappings;
}) {
  const supportingDocumentPages = [
    ...node.annotations,
    ...node.tenets,
    ...node.scenarios,
    ...node.scenarioVariations,
    ...node.activeData,
    ...node.neededResearch,
  ];

  if (supportingDocumentPages.length === 0) {
    return null;
  }

  const supportingDocumentLabels: { label: string; documentType: AtlasDocumentType; documents: AtlasTreeNode[] }[] = [
    { label: 'Annotations', documentType: 'Annotation' as const, documents: node.annotations },
    { label: 'Tenets', documentType: 'Action Tenet' as const, documents: node.tenets },
    { label: 'Scenarios', documentType: 'Scenario' as const, documents: node.scenarios },
    { label: 'Scenario Variations', documentType: 'Scenario Variation' as const, documents: node.scenarioVariations },
    { label: 'Active Data', documentType: 'Active Data' as const, documents: node.activeData },
    { label: 'Needed Research', documentType: 'Needed Research' as const, documents: node.neededResearch },
  ].filter((entry) => entry.documents.length > 0); // Only include if there are documents

  return (
    <div className={styles.supportingDocsContainer}>
      <span className={styles.supportingDocsLabel}>Supporting Documents</span>

      {supportingDocumentLabels.map(({ label, documentType, documents }) => (
        <div key={`${node.notion_page_id}-${label}`}>
          {renderSupportingDocumentListInSameType({
            label,
            documentType,
            documents,
            node,
            parentTrackingMap,
            depth,
            uuidMappings,
          })}
        </div>
      ))}
    </div>
  );
}

function renderTreeNode({
  node,
  parentTrackingMap,
  depth = 0,
  isRootNode = false,
  parentPageId,
  uuidMappings,
}: RenderTreeNodeProps): React.ReactElement {
  const formattedContent = atlasDatabasePageToHTML(node, uuidMappings);

  // Get children from the tree node structure
  const immutableAndPrimaryDocumentPages = [
    ...node.scopes,
    ...node.articles,
    ...node.sectionsAndPrimaryDocs,
    ...node.agentScopeDocs,
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
      {!isRootNode && (
        <a className={styles.nodeTitle} href={node.generatedDocID ? `#${node.generatedDocID}` : undefined}>
          {node.generatedDocID} - {node.generatedDocName}
          <span className={styles.typeChipSpacing}>
            <TypeChip type={node.atlas_document_type} />
          </span>
        </a>
      )}

      <div className={`${styles.nodeContent} ${isRootNode ? styles.nodeContentRoot : ''}`}>
        <CustomHTML html={formattedContent} />
      </div>

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

        <span className="mx-2">•</span>

        <span>{`Atlas UUID: ${uuidMappings.notionPageIDsToAtlasUUIDs.get(node.notion_page_id)}`}</span>
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
              uuidMappings,
            }),
          )}
        </ul>
      )}

      {renderSupportingDocuments({ node, parentTrackingMap, depth, uuidMappings })}
    </>
  );

  if (isRootNode) {
    return (
      <a className={styles.rootTitle} key={node.notion_page_id} id={node.generatedDocID} href={node.generatedDocID ? `#${node.generatedDocID}` : undefined}>
        {nodeContent}
      </a>
    );
  }

  return (
    <li key={node.notion_page_id} className={styles.listItem} id={node.generatedDocID}>
      {nodeContent}
    </li>
  );
}

export default function ContentTree({ atlas, uuidMappings }: { atlas: AtlasTreeResult; uuidMappings: UuidMappings }) {
  const { scopeTrees, orphanedNodes } = atlas;

  // Memoize scopeKeys to prevent unnecessary re-renders
  const scopeKeys = useMemo(() => scopeTrees.map((scopes) => scopes.notion_page_id), [scopeTrees]);

  // Create a map to track which parent each page is rendered under
  const parentTrackingMap = new Map<string, string>();

  // State to control which accordion items are expanded
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    return new Set(scopeKeys);
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
    setExpandedKeys(new Set(scopeKeys));
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
        className="max-w-full space-y-6 overflow-x-hidden"
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
            aria-label={scopeTree.generatedDocName || `Document ${scopeTree.notion_page_id}`}
            title={
              <div className={`${styles.accordionTitle} text-xl font-semibold text-gray-900`}>
                <span>
                  {scopeTree.generatedDocID} - {scopeTree.generatedDocName}
                </span>
                <TypeChip type={scopeTree.atlas_document_type} />
              </div>
            }
            classNames={{
              heading: 'bg-slate-100 rounded-md p-3 text-indigo-900 cursor-pointer',
              base: 'px-0 shadow-none',
              trigger: 'cursor-pointer',
            }}
          >
            {renderTreeNode({
              node: scopeTree,
              parentTrackingMap,
              depth: 0,
              isRootNode: true,
              uuidMappings,
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
      docId: node.generatedDocID,
      name: node.generatedDocName,
      type: node.atlas_document_type,
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
