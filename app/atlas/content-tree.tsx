'use client';

import React, { useMemo, useState } from 'react';
import { Accordion, AccordionItem } from '@heroui/accordion';
import { Button, ButtonGroup } from '@heroui/react';
import { AGENT_ROOT_SECTION_UUID_FOR_NESTING, AtlasDocumentType } from '@/app/server/atlas/constants';
import { StandardizedAtlasDocument, extraFieldsByDocumentType } from '@/app/server/atlas/json-export/types';
import {
  NEEDED_RESEARCH_PROPERTY_MAPPING,
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '@/app/server/atlas/notion-database-properties-and-relationships';
import { typeColorMap } from '@/app/server/atlas/type-color-map';
import { markdownToHTML } from '@/app/server/markdown/markdown-to-html';
import { uuidToNoHyphens } from '@/app/shared/utils/utils';
import { CustomHTML } from '../components/custom-html';
import { UuidMappings } from '../server/atlas/load-uuid-mapping';
import styles from './content-tree.module.css';
import { addExpandScopeListener } from './custom-events';
import TypeChip from './type-chip';

function StandardizedExtraData({
  node,
  className,
}: {
  node: StandardizedAtlasDocument;
  className?: string;
}): React.ReactElement | null {
  const extraKeys = extraFieldsByDocumentType[node.type] || [];
  if (extraKeys.length === 0) {
    return null;
  }

  const record = node as unknown as Record<string, string | number | boolean | string[] | null | undefined>;
  let labelMapping: Record<string, string> = {};
  switch (node.type) {
    case 'Type Specification':
      labelMapping = TYPE_SPECIFICATION_PROPERTY_MAPPING as Record<string, string>;
      break;
    case 'Scenario':
      labelMapping = SCENARIO_PROPERTY_MAPPING as Record<string, string>;
      break;
    case 'Scenario Variation':
      labelMapping = SCENARIO_VARIATION_PROPERTY_MAPPING as Record<string, string>;
      break;
    case 'Needed Research':
      labelMapping = NEEDED_RESEARCH_PROPERTY_MAPPING as Record<string, string>;
      break;
    default:
      labelMapping = {};
  }

  const rows = extraKeys.map((key) => ({ key, label: labelMapping[key] || key, value: record[key] }));

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="mt-2 text-sm text-slate-600">
        {rows.map(({ key, label, value }) => (
          <div key={key} className="mb-1">
            <p className="font-semibold text-slate-700">{label}:</p>{' '}
            <p>{Array.isArray(value) ? value.join(', ') : String(value || '-')}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

interface RenderTreeNodeProps {
  node: StandardizedAtlasDocument;
  parentTrackingMap: Map<string, string>;
  depth?: number;
  isRootNode?: boolean;
  uuidMappings: UuidMappings;
  agentsLoading?: boolean;
  // agentDocs?: StandardizedAtlasDocument[];
  highlightedDocNumber: string | null;
}

function renderSupportingDocumentListInSameType({
  label,
  documentType,
  documents,
  parentTrackingMap,
  depth,
  uuidMappings,
  agentsLoading = false,
  highlightedDocNumber = null,
  // agentDocs,
}: {
  label: string;
  documentType: AtlasDocumentType;
  documents: StandardizedAtlasDocument[];
  parentTrackingMap: Map<string, string>;
  depth: number;
  uuidMappings: UuidMappings;
  agentsLoading?: boolean;
  highlightedDocNumber?: string | null;
  // agentDocs?: StandardizedAtlasDocument[];
}) {
  const colorStyles = typeColorMap[documentType] || 'bg-gray-100 text-gray-800';

  return (
    <div className="mt-2 ml-0">
      <span className={`${colorStyles} rounded px-2 py-1 text-sm`}>{label}</span>
      <ul className={styles.supportingDocsList}>
        {documents.map((child, idx) => {
          const childNotionId = child.uuid ? uuidMappings.atlasUUIDsToNotionPageIds.get(child.uuid) : null;
          const key = childNotionId || `doc-${idx}`;
          return (
            <React.Fragment key={key}>
              {renderTreeNode({
                node: child,
                parentTrackingMap,
                depth: depth + 1,
                isRootNode: false,
                uuidMappings,
                agentsLoading,
                highlightedDocNumber,
                // agentDocs,
              })}
            </React.Fragment>
          );
        })}
      </ul>
    </div>
  );
}

function renderSupportingDocuments({
  node,
  parentTrackingMap,
  depth,
  uuidMappings,
  agentsLoading = false,
  highlightedDocNumber = null,
  // agentDocs,
}: {
  node: StandardizedAtlasDocument;
  parentTrackingMap: Map<string, string>;
  depth: number;
  uuidMappings: UuidMappings;
  agentsLoading?: boolean;
  highlightedDocNumber?: string | null;
  // agentDocs?: StandardizedAtlasDocument[];
}) {
  const nodeId = node.uuid || '';

  // Get supporting documents based on node type
  let supportingDocumentLabels: {
    label: string;
    documentType: AtlasDocumentType;
    documents: StandardizedAtlasDocument[];
  }[] = [];

  // For StandardizedAtlasDocument, get from child collections
  type SupportingDocsContainer = {
    annotations?: StandardizedAtlasDocument[];
    tenets?: StandardizedAtlasDocument[];
    scenarios?: StandardizedAtlasDocument[];
    scenario_variations?: StandardizedAtlasDocument[];
    active_data?: StandardizedAtlasDocument[];
    needed_research?: StandardizedAtlasDocument[];
  };
  const docWithSupporting = node as StandardizedAtlasDocument & SupportingDocsContainer;

  supportingDocumentLabels = [
    { label: 'Annotations', documentType: 'Annotation' as const, documents: docWithSupporting.annotations || [] },
    { label: 'Tenets', documentType: 'Action Tenet' as const, documents: docWithSupporting.tenets || [] },
    { label: 'Scenarios', documentType: 'Scenario' as const, documents: docWithSupporting.scenarios || [] },
    {
      label: 'Scenario Variations',
      documentType: 'Scenario Variation' as const,
      documents: docWithSupporting.scenario_variations || [],
    },
    { label: 'Active Data', documentType: 'Active Data' as const, documents: docWithSupporting.active_data || [] },
    {
      label: 'Needed Research',
      documentType: 'Needed Research' as const,
      documents: docWithSupporting.needed_research || [],
    },
  ].filter((entry) => entry.documents.length > 0);

  if (supportingDocumentLabels.length === 0) {
    return null;
  }

  return (
    <div className={styles.supportingDocsContainer}>
      <span className={styles.supportingDocsLabel}>Supporting Documents</span>

      {supportingDocumentLabels.map(({ label, documentType, documents }) => (
        <div
          key={`${
            (node.uuid && uuidMappings.atlasUUIDsToNotionPageIds.get(node.uuid)) || node.doc_no || nodeId
          }-${label}`}
        >
          {renderSupportingDocumentListInSameType({
            label,
            documentType,
            documents,
            parentTrackingMap,
            depth,
            uuidMappings,
            agentsLoading,
            highlightedDocNumber,
            // agentDocs,
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
  uuidMappings,
  agentsLoading = false,
  highlightedDocNumber = null,
  // agentDocs,
}: RenderTreeNodeProps): React.ReactElement {
  // Get node identifiers and metadata based on type
  const nodeId = node.uuid || '';
  const docNumber = node.doc_no;
  const docName = node.name;
  const docType = node.type;

  // Get Notion page ID for links and root agent section detection
  let notionId: string | null = null;
  if (node.uuid && uuidMappings.atlasUUIDsToNotionPageIds) {
    notionId = uuidMappings.atlasUUIDsToNotionPageIds.get(node.uuid) || null;
  }

  // Format content based on type
  const formattedContent = markdownToHTML(node.content);

  // Check if this is the agent root section
  // For StandardizedAtlasDocument, use the mapped Notion page ID
  const isAgentRootSection = Boolean(notionId && notionId === AGENT_ROOT_SECTION_UUID_FOR_NESTING);
  const shouldShowAgentPlaceholder = isAgentRootSection && agentsLoading;
  // const shouldRenderAgentDocs = isAgentRootSection && !agentsLoading && agentDocs && agentDocs.length > 0;
  const agentDocs: StandardizedAtlasDocument[] = []; // IGNORE
  const shouldRenderAgentDocs = true;

  // Get immutable and primary document children based on node type
  type ImmutableDocsContainer = {
    scopes?: StandardizedAtlasDocument[];
    articles?: StandardizedAtlasDocument[];
    sections_and_primary_docs?: StandardizedAtlasDocument[];
    agent_scope_database?: StandardizedAtlasDocument[];
  };
  const docWithImmutable = node as StandardizedAtlasDocument & ImmutableDocsContainer;

  const immutableAndPrimaryDocumentPages: StandardizedAtlasDocument[] = [
    ...(docWithImmutable.scopes || []),
    ...(docWithImmutable.articles || []),
    ...(docWithImmutable.sections_and_primary_docs || []),
    ...(shouldShowAgentPlaceholder ? [] : docWithImmutable.agent_scope_database || []),
  ];

  if (depth > 50) {
    throw new Error('Maximum tree depth exceeded, possible circular reference');
  }

  // Check if this node should be highlighted
  const isHighlighted = highlightedDocNumber && docNumber === highlightedDocNumber;

  // Node's own content (without children) - this is what gets highlighted
  const nodeOwnContent = (
    <div className={isHighlighted ? styles.highlightedContent : ''}>
      {!isRootNode && (
        <div className={styles.nodeTitle}>
          <a href={docNumber ? `#${docNumber}` : undefined} className={styles.nodeTitle}>
            {docNumber} - {docName}
          </a>
          <span className={styles.typeChipSpacing}>
            <TypeChip type={docType} />
          </span>
        </div>
      )}

      <div className={`${styles.nodeContent} ${isRootNode ? styles.nodeContentRoot : ''}`}>
        <CustomHTML html={formattedContent} />
      </div>

      <StandardizedExtraData node={node} className={styles.nodeContent} />

      <div className={`${styles.notionLink} ${isRootNode ? styles.notionLinkRoot : ''}`}>
        {notionId ? (
          <>
            <a
              href={`https://www.notion.so/${uuidToNoHyphens(notionId)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.notionLinkAnchor}
            >
              {`Notion ID: ${uuidToNoHyphens(notionId)}`}
            </a>
            <span className="mx-2">•</span>
          </>
        ) : (
          <span className="text-gray-400">No Notion ID</span>
        )}
        <span>{`Atlas UUID: ${node.uuid}`}</span>
      </div>
    </div>
  );

  // Children content (rendered separately, not highlighted)
  const childrenContent = (
    <>
      {shouldShowAgentPlaceholder && (
        <div id="agent-section-placeholder" className="mt-4 ml-4 rounded bg-gray-50 px-4 py-3 text-sm text-gray-500">
          Loading agents...
        </div>
      )}

      {shouldRenderAgentDocs && (
        <ul className={styles.immutableDocsList}>
          {agentDocs!.map((agentDoc, idx) => {
            const agentNotionId = agentDoc.uuid ? uuidMappings.atlasUUIDsToNotionPageIds.get(agentDoc.uuid) : null;
            const key = agentNotionId || `agent-${idx}`;
            return (
              <React.Fragment key={key}>
                {renderTreeNode({
                  node: agentDoc,
                  parentTrackingMap,
                  depth: depth + 1,
                  isRootNode: false,
                  uuidMappings,
                  agentsLoading: false,
                  highlightedDocNumber,
                  // agentDocs: [],
                })}
              </React.Fragment>
            );
          })}
        </ul>
      )}

      {immutableAndPrimaryDocumentPages.length > 0 && (
        <ul className={styles.immutableDocsList}>
          {immutableAndPrimaryDocumentPages.map((child, idx) => {
            const childNotionId = child.uuid ? uuidMappings.atlasUUIDsToNotionPageIds.get(child.uuid) : null;
            const key = childNotionId || `child-${idx}`;
            return (
              <React.Fragment key={key}>
                {renderTreeNode({
                  node: child,
                  parentTrackingMap,
                  depth: depth + 1,
                  isRootNode: false,
                  uuidMappings,
                  agentsLoading,
                  highlightedDocNumber,
                  // agentDocs,
                })}
              </React.Fragment>
            );
          })}
        </ul>
      )}

      {/* {renderSupportingDocuments({ node, parentTrackingMap, depth, uuidMappings, agentsLoading, agentDocs })} */}
      {renderSupportingDocuments({ node, parentTrackingMap, depth, uuidMappings, agentsLoading, highlightedDocNumber })}
    </>
  );

  const nodeContent = (
    <>
      {nodeOwnContent}
      {childrenContent}
    </>
  );

  // Prefer Notion page ID for stable React keys; fallback to doc number or UUID-derived string
  const notionKey = (node.uuid && uuidMappings.atlasUUIDsToNotionPageIds.get(node.uuid)) || null;

  if (isRootNode) {
    return (
      <div className={styles.rootTitle} key={notionKey || docNumber || `node-${nodeId || 'unknown'}`}>
        {nodeContent}
      </div>
    );
  }

  return (
    <li
      key={notionKey || docNumber || `node-${nodeId || 'unknown'}`}
      className={styles.listItem}
      id={docNumber || undefined}
    >
      {nodeContent}
    </li>
  );
}

export default function ContentTree({
  scopeTreesWithoutAgents,
  uuidMappings,
  agentsLoading,
  // agentDocs,
}: {
  scopeTreesWithoutAgents: StandardizedAtlasDocument[];
  uuidMappings: UuidMappings;
  agentsLoading?: boolean;
  // agentDocs?: StandardizedAtlasDocument[];
}) {
  // Memoize scopeKeys to prevent unnecessary re-renders
  const scopeKeys = useMemo(
    () => scopeTreesWithoutAgents.map((scopes) => scopes.uuid || ''),
    [scopeTreesWithoutAgents],
  );

  // Create a map to track which parent each page is rendered under
  const parentTrackingMap = new Map<string, string>();

  // State to control which accordion items are expanded
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    // return new Set(scopeKeys);
    return new Set([]);
  });

  // State to track the currently highlighted document from URL hash
  const [highlightedDocNumber, setHighlightedDocNumber] = useState<string | null>(null);

  // Listen for hash changes to highlight the target document and expand containing scope
  React.useEffect(() => {
    const updateHighlight = () => {
      const hash = window.location.hash.slice(1); // Remove the '#' prefix
      setHighlightedDocNumber(hash || null);

      if (hash) {
        // Find which scope contains this document
        const findScopeForDoc = (docNumber: string): StandardizedAtlasDocument | null => {
          for (const scope of scopeTreesWithoutAgents) {
            // Check if the document number starts with the scope's doc_no
            if (docNumber.startsWith(scope.doc_no || '')) {
              return scope;
            }
          }
          return null;
        };

        const containingScope = findScopeForDoc(hash);
        if (containingScope && containingScope.uuid) {
          // Expand the accordion containing this document
          setExpandedKeys((prev) => new Set([...prev, containingScope.uuid || '']));

          // Wait for accordion to expand and then scroll to the highlighted element
          setTimeout(() => {
            const element = document.getElementById(hash);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 150);
        }
      }
    };

    // Set initial highlight
    updateHighlight();

    // Listen for hash changes
    window.addEventListener('hashchange', updateHighlight);
    return () => window.removeEventListener('hashchange', updateHighlight);
  }, [scopeTreesWithoutAgents]);

  // Listen for expandScope custom events from sidebar
  React.useEffect(() => {
    const cleanup = addExpandScopeListener((event) => {
      const { scopeDocID, targetDocID } = event.detail;

      // Find the scope that matches the scopeDocID
      const targetScope = scopeTreesWithoutAgents.find((scope) => scope.doc_no === scopeDocID);
      if (targetScope) {
        const targetScopeUuid = targetScope.uuid || '';

        // Check if the target scope is already expanded
        const isAlreadyExpanded = expandedKeys.has(targetScopeUuid);

        if (isAlreadyExpanded) {
          // If already expanded, just navigate to the target document
          if (targetDocID) {
            window.location.hash = targetDocID;
          }
        } else {
          // Close all other accordions and expand only the target scope
          setExpandedKeys(new Set([targetScopeUuid]));

          // Wait for accordion to expand, then navigate to target document
          if (targetDocID) {
            setTimeout(() => {
              window.location.hash = targetDocID;
            }, 100);
          }
        }
      }
    });

    return cleanup;
  }, [scopeTreesWithoutAgents, expandedKeys]);

  // Calculate total nodes for debugging
  // TODO: Use a page-id map instead for efficiency
  const totalNodes = scopeTreesWithoutAgents.reduce((count, tree) => {
    let nodeCount = 0;
    const countNodes = (
      node: StandardizedAtlasDocument & {
        scopes?: StandardizedAtlasDocument[];
        articles?: StandardizedAtlasDocument[];
        sections_and_primary_docs?: StandardizedAtlasDocument[];
        agent_scope_database?: StandardizedAtlasDocument[];
        annotations?: StandardizedAtlasDocument[];
        tenets?: StandardizedAtlasDocument[];
        scenarios?: StandardizedAtlasDocument[];
        scenario_variations?: StandardizedAtlasDocument[];
        active_data?: StandardizedAtlasDocument[];
        needed_research?: StandardizedAtlasDocument[];
      },
    ): void => {
      nodeCount++;
      [
        ...(node.scopes || []),
        ...(node.articles || []),
        ...(node.sections_and_primary_docs || []),
        ...(node.agent_scope_database || []),
        ...(node.annotations || []),
        ...(node.tenets || []),
        ...(node.scenarios || []),
        ...(node.scenario_variations || []),
        ...(node.active_data || []),
        ...(node.needed_research || []),
      ].forEach(countNodes);
    };
    countNodes(tree as StandardizedAtlasDocument);
    return count + nodeCount;
  }, 0);

  console.log(`🗺️ Rendering Atlas content tree with ${totalNodes} total nodes`);

  // Function to expand all accordions
  const expandAll = () => {
    setExpandedKeys(new Set(scopeKeys));
  };

  // Function to collapse all accordions
  const collapseAll = () => {
    setExpandedKeys(new Set());
  };

  if (scopeTreesWithoutAgents.length === 0) {
    return <div>No Scopes found in Atlas</div>;
  }

  return (
    <div className={styles.containerMain}>
      <div className="flex items-center gap-6">
        {/* Expand/Collapse All Buttons */}
        <div className="mb-2 flex w-full justify-end">
          <div className="flex flex-col items-end gap-2">
            <ButtonGroup>
              <Button onPress={expandAll} variant="flat" size="sm">
                Expand All
              </Button>
              <Button onPress={collapseAll} variant="flat" size="sm">
                Collapse All
              </Button>
            </ButtonGroup>

            <div className="text-xs text-slate-500">Click on a scope to expand/collapse its contents.</div>
          </div>
        </div>
      </div>

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
        {scopeTreesWithoutAgents.map((scopeTree, idx) => (
          <AccordionItem
            key={scopeTree.uuid || `scope-${idx}`}
            id={scopeTree.doc_no || undefined}
            aria-label={scopeTree.name || `Document ${scopeTree.uuid || 'unknown'}`}
            title={
              <div className={`${styles.accordionTitle} text-xl font-semibold text-gray-900`}>
                <span>
                  {scopeTree.doc_no} - {scopeTree.name}
                </span>
                <TypeChip type={scopeTree.type} />
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
              agentsLoading,
              highlightedDocNumber,
              // agentDocs,
            })}
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

// (AtlasTreeNode duplicate logging removed; StandardizedAtlasDocument does not use Notion page IDs here)
