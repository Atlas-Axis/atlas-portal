'use client';

import { useEffect, useState } from 'react';
import { Accordion, AccordionItem } from '@heroui/accordion';
import { Button, ButtonGroup } from '@heroui/react';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import {
  getAtlasDocumentChildPages,
  getAtlasPageIdMap,
  getAtlasRootPages,
  logAtlasOrphanedNodes,
} from '@/app/server/services/atlas/atlas-document-tree';
import { uuidToNoHyphens } from '@/app/shared/utils/utils';
import styles from './content-tree.module.css';
import TypeChip from './type-chip';

function renderTreeNode(
  page: NotionDatabasePage,
  pageIdMap: Map<string, NotionDatabasePage>,
  depth: number = 0,
  isRootNode: boolean = false,
): React.ReactElement {
  const content = page?.plain_text_content || ``;
  const { immutableAndPrimaryDocumentPages, supportingDocumentPages } = getAtlasDocumentChildPages(page, pageIdMap);

  if (depth > 50) {
    throw new Error('Maximum tree depth exceeded, possible circular reference');
  }

  const nodeContent = (
    <>
      {!isRootNode && (
        <h3 className={styles.nodeTitle}>
          {page.canonical_document_title}
          <span className={styles.typeChipSpacing}>
            <TypeChip type={page.atlas_document_type} />
          </span>
        </h3>
      )}

      <div className={`${styles.nodeContent} ${isRootNode ? styles.nodeContentRoot : ''}`}>{content}</div>
      <div className={`${styles.notionLink} ${isRootNode ? styles.notionLinkRoot : ''}`}>
        <a
          href={`https://www.notion.so/${uuidToNoHyphens(page.notion_page_id)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.notionLinkAnchor}
        >
          {`Notion ID: ${uuidToNoHyphens(page.notion_page_id)}`}
        </a>
      </div>

      {immutableAndPrimaryDocumentPages.length > 0 && (
        <ul className={styles.immutableDocsList}>
          {immutableAndPrimaryDocumentPages.map((child) => renderTreeNode(child, pageIdMap, depth + 1, false))}
        </ul>
      )}

      {supportingDocumentPages.length > 0 && (
        <div className={styles.supportingDocsContainer}>
          <span className={styles.supportingDocsLabel}>Supporting Documents:</span>
          <ul className={styles.supportingDocsList}>
            {supportingDocumentPages.map((child) => renderTreeNode(child, pageIdMap, depth + 1, false))}
          </ul>
        </div>
      )}
    </>
  );

  if (isRootNode) {
    return (
      <h3 className={styles.rootTitle} key={page.notion_page_id}>
        {nodeContent}
      </h3>
    );
  }

  return (
    <li key={page.notion_page_id} className={styles.listItem}>
      {nodeContent}
    </li>
  );
}

export default function ContentTree({
  atlasPagesPerDatabase,
}: {
  atlasPagesPerDatabase: Record<string, NotionDatabasePage[]>;
}) {
  // Map over all Atlas databases and create a combined map of page ID to NotionDatabasePage
  const pageIdMap = getAtlasPageIdMap(atlasPagesPerDatabase);
  const rootPages = getAtlasRootPages(atlasPagesPerDatabase);

  // State to control which accordion items are expanded
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    const firstPageId = rootPages?.[0]?.notion_page_id;
    return new Set(firstPageId ? [firstPageId] : []);
  });

  console.log(`🗺️ Rendering Atlas content tree with ${pageIdMap.size} total pages`);
  console.log(`🌳 Found ${rootPages ? rootPages.length : 0} root pages in Atlas databases`);

  // Log orphaned nodes for debugging
  useEffect(() => {
    logAtlasOrphanedNodes(atlasPagesPerDatabase);
  }, [atlasPagesPerDatabase]);

  // Function to expand all accordions
  const expandAll = () => {
    if (rootPages) {
      const allKeys = rootPages.map((page) => page.notion_page_id);
      setExpandedKeys(new Set(allKeys));
    }
  };

  // Function to collapse all accordions
  const collapseAll = () => {
    setExpandedKeys(new Set());
  };

  if (!rootPages) {
    return <div>No root pages found in Atlas databases (Scopes | Agents)</div>;
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
        {Array.from(rootPages.values()).map((page) => (
          <AccordionItem
            key={page.notion_page_id}
            aria-label={page.canonical_document_title || `Document ${page.notion_page_id}`}
            title={
              <div className={`${styles.accordionTitle} text-xl font-semibold text-gray-900`}>
                <span>{page.canonical_document_title}</span>
                <TypeChip type={page.atlas_document_type} />
              </div>
            }
            classNames={{ heading: 'bg-slate-100 rounded-md p-3 text-indigo-900', base: 'px-0 shadow-none' }}
          >
            {renderTreeNode(page, pageIdMap, 0, true)}
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
