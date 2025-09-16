'use client';

import { useEffect } from 'react';
import { Accordion, AccordionItem } from '@heroui/accordion';
import { ExternalLink } from 'lucide-react';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import {
  getAtlasDocumentChildPages,
  getAtlasPageIdMap,
  getAtlasRootPages,
  logAtlasOrphanedNodes,
} from '@/app/server/services/atlas/atlas-document-tree';
import { uuidToNoHyphens } from '@/app/shared/utils/utils';
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
        <h3 className="text-base font-semibold">
          {page.canonical_document_title}
          <span className="ml-2">
            <TypeChip type={page.atlas_document_type} />
          </span>
        </h3>
      )}

      <div className={`text-xs font-medium text-gray-800 ${isRootNode ? 'mb-2' : ''}`}>{content}</div>
      <div className={`text-xs text-gray-300 ${isRootNode ? 'mb-4' : ''}`}>
        {`Node ID: ${uuidToNoHyphens(page.notion_page_id)}`}
        <a
          href={`https://www.notion.so/${uuidToNoHyphens(page.notion_page_id)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink className="ml-2 inline h-3 w-3" />
        </a>
      </div>

      {immutableAndPrimaryDocumentPages.length > 0 && (
        <ul className="mt-1 ml-4 border-l border-gray-200 pl-4">
          {immutableAndPrimaryDocumentPages.map((child) => renderTreeNode(child, pageIdMap, depth + 1, false))}
        </ul>
      )}

      {supportingDocumentPages.length > 0 && (
        <div className="mt-2 ml-8">
          <span className="rounded-md bg-slate-700 p-1 text-sm font-semibold text-slate-100">
            Supporting Documents:
          </span>
          <ul className="border-l border-gray-200">
            {supportingDocumentPages.map((child) => renderTreeNode(child, pageIdMap, depth + 1, false))}
          </ul>
        </div>
      )}
    </>
  );

  if (isRootNode) {
    return (
      <h3 className="text-base font-semibold" key={page.notion_page_id}>
        {nodeContent}
      </h3>
    );
  }

  return (
    <li key={page.notion_page_id} className="my-3 ml-3 border-t-1 border-gray-100 pt-3">
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

  console.log(`🗺️ Rendering Atlas content tree with ${pageIdMap.size} total pages`);
  console.log(`🌳 Found ${rootPages ? rootPages.length : 0} root pages in Atlas databases`);

  // Log orphaned nodes for debugging
  useEffect(() => {
    logAtlasOrphanedNodes(atlasPagesPerDatabase);
  }, [atlasPagesPerDatabase]);

  if (!rootPages) {
    return <div>No root pages found in Atlas databases (Scopes | Agents)</div>;
  }

  return (
    <div className="mt-4">
      <h3 className="mb-6 text-3xl font-semibold">Atlas</h3>
      <Accordion disableAnimation={true}>
        {Array.from(rootPages.values()).map((page) => (
          <AccordionItem
            key={page.notion_page_id}
            aria-label={page.canonical_document_title || `Document ${page.notion_page_id}`}
            title={
              <div className="flex items-center gap-2">
                <span>{page.canonical_document_title}</span>
                <TypeChip type={page.atlas_document_type} />
              </div>
            }
          >
            {renderTreeNode(page, pageIdMap, 0, true)}
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
