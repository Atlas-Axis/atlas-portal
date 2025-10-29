'use client';

import React, { useState } from 'react';
import { Accordion, AccordionItem } from '@heroui/accordion';
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
import { LOCAL_STORAGE_CHANGED_EVENT, SHOW_UUIDS_STORAGE_KEY } from './constants';
import styles from './content-tree.module.css';
import { addExpandScopeListener } from './custom-events';
import TypeChip from './type-chip';

/**
 * Type-safe helper to get child collection from a document
 */
function getChildCollection(node: StandardizedAtlasDocument, key: string): StandardizedAtlasDocument[] {
  const value = (node as unknown as Record<string, unknown>)[key];
  return Array.isArray(value) ? value : [];
}

/**
 * Recursive helper to find the path of UUIDs from root to a target document.
 * Returns an array of UUIDs representing the path through collapsible nodes (Scope, Article, Section).
 *
 * @param targetDocNumber - The document number to search for (e.g., "A.2.3.21")
 * @param node - The current node being examined
 * @param currentPath - Accumulated path of UUIDs from root to current node
 * @returns Array of UUIDs forming the path to the target, or null if not found
 */
function findPathInTree(
  targetDocNumber: string,
  node: StandardizedAtlasDocument,
  currentPath: string[],
): string[] | null {
  // Add current node's UUID to path if it's a collapsible type (Scope, Article, Section)
  const isCollapsible = node.type === 'Scope' || node.type === 'Article' || node.type === 'Section';
  const newPath = isCollapsible && node.uuid ? [...currentPath, node.uuid] : currentPath;

  // Check if this is the target
  if (node.doc_no === targetDocNumber) {
    return newPath;
  }

  // Search in children
  const children: StandardizedAtlasDocument[] = [
    ...getChildCollection(node, 'scopes'),
    ...getChildCollection(node, 'articles'),
    ...getChildCollection(node, 'sections_and_primary_docs'),
    ...getChildCollection(node, 'agent_scope_database'),
    ...getChildCollection(node, 'annotations'),
    ...getChildCollection(node, 'tenets'),
    ...getChildCollection(node, 'scenarios'),
    ...getChildCollection(node, 'scenario_variations'),
    ...getChildCollection(node, 'active_data'),
    ...getChildCollection(node, 'needed_research'),
  ];

  for (const child of children) {
    const result = findPathInTree(targetDocNumber, child, newPath);
    if (result) {
      return result;
    }
  }

  return null;
}

/**
 * Finds the path of collapsible node UUIDs from root to a target document.
 *
 * @param targetDocNumber - The document number to find (e.g., "A.2.3.21")
 * @param trees - Array of root scope trees to search
 * @returns Array of UUIDs forming the path to expand, or null if not found
 */
function findPathToDocument(targetDocNumber: string, trees: StandardizedAtlasDocument[]): string[] | null {
  for (const tree of trees) {
    const result = findPathInTree(targetDocNumber, tree, []);
    if (result) {
      return result;
    }
  }
  return null;
}

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
  expandedKeys: Set<string>;
  onToggleExpanded: (uuid: string) => void;
  showUUIDs: boolean;
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
  expandedKeys,
  onToggleExpanded,
  showUUIDs,
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
  expandedKeys: Set<string>;
  onToggleExpanded: (uuid: string) => void;
  showUUIDs: boolean;
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
                expandedKeys,
                onToggleExpanded,
                showUUIDs,
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
  expandedKeys,
  onToggleExpanded,
  showUUIDs,
  // agentDocs,
}: {
  node: StandardizedAtlasDocument;
  parentTrackingMap: Map<string, string>;
  depth: number;
  uuidMappings: UuidMappings;
  agentsLoading?: boolean;
  highlightedDocNumber?: string | null;
  expandedKeys: Set<string>;
  onToggleExpanded: (uuid: string) => void;
  showUUIDs: boolean;
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
            expandedKeys,
            onToggleExpanded,
            showUUIDs,
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
  expandedKeys,
  onToggleExpanded,
  showUUIDs,
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
  // Note: Agent docs are currently disabled - this logic is prepared for future use
  const agentDocs: StandardizedAtlasDocument[] = [];
  const shouldRenderAgentDocs = false;

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

  // Check if this node type should be collapsible (Article or Section with children)
  const isCollapsibleType =
    (docType === 'Article' || docType === 'Section') && immutableAndPrimaryDocumentPages.length > 0;
  const isExpanded = nodeId && expandedKeys.has(nodeId);

  // Node's content (the body, not the title) - used inside accordion or standalone
  const nodeBodyContent = (
    <>
      <div className={`${styles.nodeContent} ${isRootNode ? styles.nodeContentRoot : ''}`}>
        <CustomHTML html={formattedContent} />
      </div>

      <StandardizedExtraData node={node} className={styles.nodeContent} />

      {showUUIDs && (
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
      )}
    </>
  );

  // For non-collapsible types, render title + body together
  const nodeOwnContent = (
    <div className={isHighlighted ? styles.highlightedContent : ''} id={docNumber || undefined}>
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
      {nodeBodyContent}
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
          {agentDocs.map((agentDoc, idx) => {
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
                  expandedKeys,
                  onToggleExpanded,
                  showUUIDs,
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
                  expandedKeys,
                  onToggleExpanded,
                  showUUIDs,
                  // agentDocs,
                })}
              </React.Fragment>
            );
          })}
        </ul>
      )}

      {/* {renderSupportingDocuments({ node, parentTrackingMap, depth, uuidMappings, agentsLoading, agentDocs })} */}
      {renderSupportingDocuments({
        node,
        parentTrackingMap,
        depth,
        uuidMappings,
        agentsLoading,
        highlightedDocNumber,
        expandedKeys,
        onToggleExpanded,
        showUUIDs,
      })}
    </>
  );

  // For collapsible types (Article/Section with children), wrap in an Accordion
  const nodeContent = isCollapsibleType ? (
    <div id={docNumber || undefined}>
      <Accordion
        disableAnimation={true}
        selectionMode="multiple"
        variant="light"
        className="px-0"
        selectedKeys={isExpanded ? [nodeId] : []}
        onSelectionChange={(_keys) => {
          if (nodeId) {
            // Toggle expansion
            onToggleExpanded(nodeId);
          }
        }}
      >
        <AccordionItem
          key={nodeId}
          aria-label={`${docNumber} - ${docName}`}
          title={
            <div className={`${styles.nodeTitle}`}>
              <a
                href={docNumber ? `#${docNumber}` : undefined}
                className={styles.nodeTitle}
                onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  // Prevent accordion toggle when clicking the link
                  e.stopPropagation();
                }}
              >
                {docNumber} - {docName}
              </a>
              <span className={styles.typeChipSpacing}>
                <TypeChip type={docType} />
              </span>
            </div>
          }
          classNames={{
            base: 'px-0 mb-3',
            trigger: `px-2 py-2 cursor-pointer bg-slate-100 rounded-md ${isHighlighted ? styles.highlightedContent : ''}`,
            content: 'px-0 pt-2 pb-0',
            indicator: 'text-slate-600',
            title: 'w-full',
          }}
        >
          {/* Node's body content (inside accordion) */}
          {nodeBodyContent}
          {/* Children */}
          {childrenContent}
        </AccordionItem>
      </Accordion>
    </div>
  ) : (
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
    <li key={notionKey || docNumber || `node-${nodeId || 'unknown'}`} className={styles.listItem}>
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
  // Create a map to track which parent each page is rendered under
  const parentTrackingMap = new Map<string, string>();

  // State to control which accordion items are expanded
  // Keys are UUIDs for Scope/Article/Section documents
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    return new Set([]);
  });

  // State to track the currently highlighted document from URL hash
  const [highlightedDocNumber, setHighlightedDocNumber] = useState<string | null>(null);

  // State to control whether UUIDs are shown (read from localStorage)
  const [showUUIDs, setShowUUIDs] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = localStorage.getItem(SHOW_UUIDS_STORAGE_KEY);
      return stored === 'true';
    } catch {
      return false;
    }
  });

  // Listen for localStorage changes to update showUUIDs without page reload
  React.useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SHOW_UUIDS_STORAGE_KEY) {
        setShowUUIDs(e.newValue === 'true');
      }
    };

    // Listen for storage events (fired when localStorage changes in other tabs/windows)
    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom-emitted events for same-window updates
    const handleCustomStorageChange = () => {
      try {
        const stored = localStorage.getItem(SHOW_UUIDS_STORAGE_KEY);
        setShowUUIDs(stored === 'true');
      } catch {
        // Ignore errors
      }
    };

    // Listen for custom event fired when localStorage changes in same window
    window.addEventListener(LOCAL_STORAGE_CHANGED_EVENT, handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(LOCAL_STORAGE_CHANGED_EVENT, handleCustomStorageChange);
    };
  }, []);

  // Listen for hash changes to highlight the target document and expand the path to it
  React.useEffect(() => {
    const updateHighlight = () => {
      const hash = window.location.hash.slice(1); // Remove the '#' prefix
      setHighlightedDocNumber(hash || null);

      if (hash) {
        // Find the full path to the target document
        const path = findPathToDocument(hash, scopeTreesWithoutAgents);
        if (path && path.length > 0) {
          // Expand all nodes in the path (merge with existing expanded keys to preserve user interactions)
          setExpandedKeys((prev) => {
            const newSet = new Set(prev);
            path.forEach((uuid) => newSet.add(uuid));
            return newSet;
          });

          // Wait for accordions to expand and then scroll to the highlighted element
          setTimeout(() => {
            const element = document.getElementById(hash);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

      if (targetDocID) {
        // Find the full path to the target document
        const path = findPathToDocument(targetDocID, scopeTreesWithoutAgents);
        if (path && path.length > 0) {
          // Replace expanded keys with only the path to the target (focused navigation)
          setExpandedKeys(new Set(path));

          // Wait for accordions to expand, then navigate to target document
          setTimeout(() => {
            window.location.hash = targetDocID;
          }, 100);
        }
      } else if (scopeDocID) {
        // If only scopeDocID is provided, find and expand that scope
        const path = findPathToDocument(scopeDocID, scopeTreesWithoutAgents);
        if (path && path.length > 0) {
          setExpandedKeys(new Set(path));
        }
      }
    });

    return cleanup;
  }, [scopeTreesWithoutAgents]);

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

  // Handler to toggle expansion of Article/Section nodes
  const handleToggleExpanded = (uuid: string) => {
    setExpandedKeys((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(uuid)) {
        newSet.delete(uuid);
      } else {
        newSet.add(uuid);
      }
      return newSet;
    });
  };

  if (scopeTreesWithoutAgents.length === 0) {
    return <div>No Scopes found in Atlas</div>;
  }

  return (
    <div className={styles.containerMain}>
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
              expandedKeys,
              onToggleExpanded: handleToggleExpanded,
              showUUIDs,
              // agentDocs,
            })}
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

// (AtlasTreeNode duplicate logging removed; StandardizedAtlasDocument does not use Notion page IDs here)
