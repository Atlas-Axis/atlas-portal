'use client';

import React, { useState } from 'react';
import { Accordion, AccordionItem } from '@heroui/accordion';
import { useClipboard } from '@heroui/use-clipboard';
import { Link2 } from 'lucide-react';
import { AtlasDocumentType } from '@/app/server/atlas/constants';
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
 * Builds a lookup map from document number to the path of collapsible UUIDs needed to reach it.
 * This is built once and cached for O(1) lookups instead of O(n) tree traversals.
 *
 * @param node - The current node being examined
 * @param currentPath - Accumulated path of UUIDs from root to current node
 * @param map - The map being built (doc_no -> path of UUIDs)
 */
function buildPathLookupMap(node: StandardizedAtlasDocument, currentPath: string[], map: Map<string, string[]>): void {
  // Add current node's UUID to path (all document types are collapsible)
  const newPath = node.uuid ? [...currentPath, node.uuid] : currentPath;

  // Store the path for this document
  if (node.doc_no) {
    map.set(node.doc_no, newPath);
  }

  // Recursively process all children
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
    buildPathLookupMap(child, newPath, map);
  }
}

/**
 * Creates a lookup map for all documents in the trees.
 *
 * @param trees - Array of root scope trees
 * @returns Map from document number to path of collapsible UUIDs
 */
function createPathLookupMap(trees: StandardizedAtlasDocument[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const tree of trees) {
    buildPathLookupMap(tree, [], map);
  }
  return map;
}

/**
 * Recursively builds a lookup map from UUID to document number.
 * This is used for converting internal links from UUIDs to document numbers.
 *
 * @param node - The current node being examined
 * @param map - The map being built (uuid -> doc_no)
 */
function buildUuidToDocNoMap(node: StandardizedAtlasDocument, map: Map<string, string>): void {
  // Store UUID -> doc_no mapping if both exist
  if (node.uuid && node.doc_no) {
    map.set(node.uuid, node.doc_no);
  }

  // Recursively process all children
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
    buildUuidToDocNoMap(child, map);
  }
}

/**
 * Creates a UUID to document number lookup map for all documents in the trees.
 * Used for converting internal links from UUIDs to document number anchors.
 *
 * @param trees - Array of root scope trees
 * @returns Map from UUID to document number
 */
function createUuidToDocNoMap(trees: StandardizedAtlasDocument[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const tree of trees) {
    buildUuidToDocNoMap(tree, map);
  }
  return map;
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
  depth?: number;
  isRootNode?: boolean;
  uuidMappings: UuidMappings;
  uuidToDocNoMap: Map<string, string>;
  isHighlighted: boolean;
  getIsHighlighted: (docNumber: string) => boolean;
  isExpanded: boolean;
  getIsExpanded: (uuid: string) => boolean;
  onToggleExpanded: (uuid: string) => void;
  showUUIDs: boolean;
}

function renderSupportingDocumentListInSameType({
  label,
  documentType,
  documents,
  depth,
  uuidMappings,
  uuidToDocNoMap,
  getIsHighlighted,
  getIsExpanded,
  onToggleExpanded,
  showUUIDs,
}: {
  label: string;
  documentType: AtlasDocumentType;
  documents: StandardizedAtlasDocument[];
  depth: number;
  uuidMappings: UuidMappings;
  uuidToDocNoMap: Map<string, string>;
  getIsHighlighted: (docNumber: string) => boolean;
  getIsExpanded: (uuid: string) => boolean;
  onToggleExpanded: (uuid: string) => void;
  showUUIDs: boolean;
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
            <TreeNode
              key={key}
              node={child}
              depth={depth + 1}
              isRootNode={false}
              uuidMappings={uuidMappings}
              uuidToDocNoMap={uuidToDocNoMap}
              isHighlighted={getIsHighlighted(child.doc_no || '')}
              getIsHighlighted={getIsHighlighted}
              isExpanded={getIsExpanded(child.uuid || '')}
              getIsExpanded={getIsExpanded}
              onToggleExpanded={onToggleExpanded}
              showUUIDs={showUUIDs}
            />
          );
        })}
      </ul>
    </div>
  );
}

function renderSupportingDocuments({
  node,
  depth,
  uuidMappings,
  uuidToDocNoMap,
  getIsHighlighted,
  getIsExpanded,
  onToggleExpanded,
  showUUIDs,
}: {
  node: StandardizedAtlasDocument;
  depth: number;
  uuidMappings: UuidMappings;
  uuidToDocNoMap: Map<string, string>;
  getIsHighlighted: (docNumber: string) => boolean;
  getIsExpanded: (uuid: string) => boolean;
  onToggleExpanded: (uuid: string) => void;
  showUUIDs: boolean;
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
            depth,
            uuidMappings,
            uuidToDocNoMap,
            getIsHighlighted,
            getIsExpanded,
            onToggleExpanded,
            showUUIDs,
          })}
        </div>
      ))}
    </div>
  );
}

/**
 *
 */
function TreeNode({
  node,
  depth = 0,
  isRootNode = false,
  uuidMappings,
  uuidToDocNoMap,
  isHighlighted,
  getIsHighlighted,
  isExpanded,
  getIsExpanded,
  onToggleExpanded,
  showUUIDs,
}: RenderTreeNodeProps): React.ReactElement {
  // Get node identifiers and metadata based on type
  const nodeId = node.uuid || '';
  const docNumber = node.doc_no;
  const docName = node.name;
  const docType = node.type;

  // Get Notion page ID for links
  let notionId: string | null = null;
  if (node.uuid && uuidMappings.atlasUUIDsToNotionPageIds) {
    notionId = uuidMappings.atlasUUIDsToNotionPageIds.get(node.uuid) || null;
  }

  // Format content based on type, converting UUID links to document number anchors
  const formattedContent = markdownToHTML(node.content, uuidToDocNoMap);

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
    ...(docWithImmutable.agent_scope_database || []),
  ];

  if (depth > 50) {
    throw new Error('Maximum tree depth exceeded, possible circular reference');
  }

  // All document types are collapsible (regardless of whether they have children)
  const isCollapsibleType = true;

  // Memoize the selectedKeys Set to avoid creating new instances on every render
  const selectedKeys = React.useMemo(() => {
    return isExpanded ? new Set([nodeId]) : new Set<string>();
  }, [isExpanded, nodeId]);

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
    <div className={isHighlighted ? styles.highlightedContent : ''} data-doc-id={docNumber || undefined}>
      {!isRootNode && (
        <div className={`${styles.nodeTitle} flex items-center`}>
          <a href={docNumber ? `#${docNumber}` : undefined} className={styles.nodeTitle}>
            {docNumber} - {docName}
          </a>
          <CopyToClipboardButton
            text={
              typeof window !== 'undefined'
                ? `${window.location.origin}${window.location.pathname}#${docNumber}`
                : `#${docNumber}`
            }
          />
          <TypeChip type={docType} />
        </div>
      )}
      {nodeBodyContent}
    </div>
  );

  // Children content (rendered separately, not highlighted)
  const childrenContent = (
    <>
      {immutableAndPrimaryDocumentPages.length > 0 && (
        <ul className={styles.immutableDocsList}>
          {immutableAndPrimaryDocumentPages.map((child, idx) => {
            const childNotionId = child.uuid ? uuidMappings.atlasUUIDsToNotionPageIds.get(child.uuid) : null;
            const key = childNotionId || `child-${idx}`;
            return (
              <TreeNode
                key={key}
                node={child}
                depth={depth + 1}
                isRootNode={false}
                uuidMappings={uuidMappings}
                uuidToDocNoMap={uuidToDocNoMap}
                isHighlighted={getIsHighlighted(child.doc_no || '')}
                getIsHighlighted={getIsHighlighted}
                isExpanded={getIsExpanded(child.uuid || '')}
                getIsExpanded={getIsExpanded}
                onToggleExpanded={onToggleExpanded}
                showUUIDs={showUUIDs}
              />
            );
          })}
        </ul>
      )}

      {renderSupportingDocuments({
        node,
        depth,
        uuidMappings,
        uuidToDocNoMap,
        getIsHighlighted,
        getIsExpanded,
        onToggleExpanded,
        showUUIDs,
      })}
    </>
  );

  // For collapsible types (Article/Section with children), wrap in an Accordion
  const nodeContent = isCollapsibleType ? (
    <div data-doc-id={docNumber || undefined}>
      <Accordion
        disableAnimation={true}
        selectionMode="multiple"
        variant="light"
        className="px-0"
        selectedKeys={selectedKeys}
        onSelectionChange={(keys) => {
          if (nodeId) {
            // The Accordion tells us if this item should be expanded based on the new selection
            const shouldBeExpanded = keys === 'all' || (keys instanceof Set && keys.has(nodeId));
            const currentlyExpanded = isExpanded;

            // Only toggle if the state is actually changing
            if (shouldBeExpanded !== currentlyExpanded) {
              onToggleExpanded(nodeId);
            }
          }
        }}
      >
        <AccordionItem
          key={nodeId}
          aria-label={`${docNumber} - ${docName}`}
          title={
            // <div className={styles.nodeTitle}>
            <div className={`${styles.nodeTitle} flex items-center gap-0.5 px-2 py-2`}>
              {docNumber} - {docName}
              <CopyToClipboardButton
                text={
                  typeof window !== 'undefined'
                    ? `${window.location.origin}${window.location.pathname}#${docNumber}`
                    : `#${docNumber}`
                }
              />
              <TypeChip type={docType} />
            </div>
            // </div>
          }
          classNames={{
            base: 'px-0 mb-3',
            trigger: `px-0 py-0 cursor-pointer bg-slate-100 rounded-md ${isHighlighted ? styles.highlightedContent : ''}`,
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
}: {
  scopeTreesWithoutAgents: StandardizedAtlasDocument[];
  uuidMappings: UuidMappings;
}) {
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

  // Build path lookup map once on mount for O(1) lookups (memoized)
  const pathLookupMap = React.useMemo(() => {
    return createPathLookupMap(scopeTreesWithoutAgents);
  }, [scopeTreesWithoutAgents]);

  // Build UUID to document number map once on mount for converting internal links (memoized)
  const uuidToDocNoMap = React.useMemo(() => {
    return createUuidToDocNoMap(scopeTreesWithoutAgents);
  }, [scopeTreesWithoutAgents]);

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
    let scrollTimeout: NodeJS.Timeout | null = null;

    const updateHighlight = () => {
      const hash = window.location.hash.slice(1); // Remove the '#' prefix
      setHighlightedDocNumber(hash || null);

      if (hash) {
        // Look up the path using O(1) map lookup instead of O(n) tree traversal
        const path = pathLookupMap.get(hash);
        if (path && path.length > 0) {
          // Expand all nodes in the path (merge with existing expanded keys to preserve user interactions)
          setExpandedKeys((prev) => {
            const newSet = new Set(prev);
            path.forEach((uuid) => newSet.add(uuid));
            return newSet;
          });

          // Clear any pending scroll timeout to debounce rapid navigation
          if (scrollTimeout) {
            clearTimeout(scrollTimeout);
          }

          // Use double requestAnimationFrame for scrolling:
          // First rAF: React commits the DOM changes (expanded accordions)
          // Second rAF: DOM is painted, now safe to scroll
          scrollTimeout = setTimeout(() => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                // Use querySelector with data-doc-id instead of getElementById
                // This prevents browser's native hash navigation behavior
                // Escape special characters in CSS selector to prevent injection
                const escapedHash = CSS.escape(hash);
                const element = document.querySelector(`[data-doc-id="${escapedHash}"]`);
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              });
            });
            scrollTimeout = null;
          }, 0);
        }
      }
    };

    // Set initial highlight
    updateHighlight();

    // Listen for hash changes
    window.addEventListener('hashchange', updateHighlight);
    return () => {
      window.removeEventListener('hashchange', updateHighlight);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [pathLookupMap]);

  // Listen for expandScope custom events from sidebar
  React.useEffect(() => {
    let navigationTimeout: NodeJS.Timeout | null = null;

    const cleanup = addExpandScopeListener((event) => {
      const { targetDocID } = event.detail;

      // Clear any pending navigation timeout to debounce rapid clicks
      if (navigationTimeout) {
        clearTimeout(navigationTimeout);
        navigationTimeout = null;
      }

      // Look up the path using O(1) map lookup instead of O(n) tree traversal
      const path = pathLookupMap.get(targetDocID);
      if (path) {
        // Replace expanded keys with only the path to the target (focused navigation)
        setExpandedKeys(new Set(path));

        // Use requestAnimationFrame for immediate update on next paint
        // Since accordions have disableAnimation=true and nodes are memoized,
        // this is fast enough to feel instant while ensuring DOM updates
        navigationTimeout = setTimeout(() => {
          requestAnimationFrame(() => {
            // Use history.pushState to update hash without triggering browser's native scroll
            // This prevents double-scrolling (browser scroll + our custom scroll)
            const newUrl = `${window.location.pathname}${window.location.search}#${targetDocID}`;
            window.history.pushState(null, '', newUrl);
            // Manually trigger hashchange event for our listeners
            window.dispatchEvent(new HashChangeEvent('hashchange'));
          });
          navigationTimeout = null;
        }, 0);
      }
    });

    return () => {
      cleanup();
      if (navigationTimeout) {
        clearTimeout(navigationTimeout);
      }
    };
  }, [pathLookupMap]);

  console.log('Rendering ContentTree');

  // Handler to toggle expansion of Article/Section nodes
  const handleToggleExpanded = React.useCallback((uuid: string) => {
    setExpandedKeys((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(uuid)) {
        newSet.delete(uuid);
      } else {
        newSet.add(uuid);
      }
      return newSet;
    });
  }, []);

  // Function to check if a node is expanded
  const getIsExpanded = React.useCallback(
    (uuid: string) => {
      return expandedKeys.has(uuid);
    },
    [expandedKeys],
  );

  // Function to check if a node is highlighted
  const getIsHighlighted = React.useCallback(
    (docNumber: string) => {
      // Don't match empty strings
      if (!docNumber || !highlightedDocNumber) {
        return false;
      }
      return highlightedDocNumber === docNumber;
    },
    [highlightedDocNumber],
  );

  if (scopeTreesWithoutAgents.length === 0) {
    return <div>No Scopes found in Atlas</div>;
  }

  return (
    <div className={styles.containerMain}>
      <Accordion
        disableAnimation={true}
        selectionMode="multiple"
        variant="splitted"
        className="max-w-full space-y-6"
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
            data-doc-id={scopeTree.doc_no || undefined}
            aria-label={scopeTree.name || `Document ${scopeTree.uuid || 'unknown'}`}
            title={
              <div className={`${styles.accordionTitle} flex items-center gap-0.5 text-xl font-semibold text-gray-900`}>
                <span>
                  {scopeTree.doc_no} - {scopeTree.name}
                </span>
                <CopyToClipboardButton
                  text={
                    typeof window !== 'undefined'
                      ? `${window.location.origin}${window.location.pathname}#${scopeTree.doc_no}`
                      : `#${scopeTree.doc_no}`
                  }
                />
                <TypeChip type={scopeTree.type} />
              </div>
            }
            classNames={{
              heading: 'bg-slate-100 rounded-md p-3 text-indigo-900 cursor-pointer',
              base: 'px-0 shadow-none',
              trigger: 'cursor-pointer',
            }}
          >
            <TreeNode
              node={scopeTree}
              depth={0}
              isRootNode={true}
              uuidMappings={uuidMappings}
              uuidToDocNoMap={uuidToDocNoMap}
              isHighlighted={getIsHighlighted(scopeTree.doc_no || '')}
              getIsHighlighted={getIsHighlighted}
              isExpanded={getIsExpanded(scopeTree.uuid || '')}
              getIsExpanded={getIsExpanded}
              onToggleExpanded={handleToggleExpanded}
              showUUIDs={showUUIDs}
            />
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

function CopyToClipboardButton({ text }: { text: string }) {
  const { copied, copy } = useClipboard({ timeout: 3000 });

  return (
    <div className="relative flex items-center gap-1">
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          // Prevent accordion toggle when clicking the copy button
          e.stopPropagation();
          copy(text);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            copy(text);
          }
        }}
        className="inline-flex h-6 w-6 min-w-6 cursor-pointer items-center justify-center rounded-md hover:bg-gray-200 active:bg-gray-300"
        title="Copy link to clipboard"
      >
        <Link2 className="text-default-400" size={12} />
      </span>
      {copied && (
        <span className="absolute top-0 left-8 rounded-md bg-white px-2 py-1 text-xs font-semibold whitespace-nowrap text-green-600 shadow-md">
          COPIED!
        </span>
      )}
    </div>
  );
}
