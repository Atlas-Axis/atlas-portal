'use client';

import React from 'react';
import { Accordion, AccordionItem } from '@heroui/accordion';
import { StandardizedAtlasDocument } from '@/app/server/atlas/export/types';
import { UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import { typeColorMap } from '@/app/server/atlas/type-color-map';
import { markdownToHTML } from '@/app/server/markdown/markdown-to-html';
import { uuidToNoHyphens } from '@/app/shared/utils/utils';
import { CustomHTML } from '../../components/custom-html';

/**
 * Creates a UUID to document number lookup map for all documents.
 * Used for converting internal links from UUIDs to document number anchors.
 */
function createUuidToDocNoMap(atlasPagesPerDatabase: Record<string, StandardizedAtlasDocument[]>): Map<string, string> {
  const map = new Map<string, string>();

  for (const pages of Object.values(atlasPagesPerDatabase)) {
    for (const page of pages) {
      if (page.uuid && page.doc_no) {
        map.set(page.uuid, page.doc_no);
      }
    }
  }

  return map;
}

interface AtlasListClientProps {
  atlasPagesPerDatabase: Record<string, StandardizedAtlasDocument[]>;
  uuidMappings: UuidMappings;
}

export default function AtlasList({ atlasPagesPerDatabase, uuidMappings }: AtlasListClientProps) {
  const databaseNames = Object.keys(atlasPagesPerDatabase);

  // Build UUID to document number map once on mount for converting internal links (memoized)
  const uuidToDocNoMap = React.useMemo(() => {
    return createUuidToDocNoMap(atlasPagesPerDatabase);
  }, [atlasPagesPerDatabase]);

  return (
    <div className="min-h-screen bg-gray-100 p-3 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <Accordion
          variant="splitted"
          className="space-y-6"
          selectionMode="multiple"
          defaultExpandedKeys={databaseNames}
          disableAnimation={true}
        >
          {Object.entries(atlasPagesPerDatabase).map(([databaseName, pages]) => (
            <AccordionItem
              key={databaseName}
              aria-label={`${databaseName} database`}
              title={
                <h2 className="cursor-pointer text-2xl font-bold text-gray-900">
                  {databaseName}
                  <span className="ml-6 text-sm text-gray-300">{pages.length} documents</span>
                </h2>
              }
              className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:p-12"
              classNames={{ trigger: 'py-0 pb-3 border-b border-gray-200', heading: 'cursor-pointer' }}
            >
              <div className="pt-6">
                {pages.length > 0 ? (
                  <div className="space-y-3">
                    {pages.map((page, idx) => (
                      <ListItem
                        // Prefer Notion page ID (mapped from UUID)
                        key={
                          (page.uuid && uuidMappings.atlasUUIDsToNotionPageIds.get(page.uuid)) ||
                          page.doc_no ||
                          `doc-${idx}`
                        }
                        item={page}
                        uuidMappings={uuidMappings}
                        uuidToDocNoMap={uuidToDocNoMap}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 italic">No documents found in this database.</p>
                )}
              </div>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}

interface ListItemProps {
  item: StandardizedAtlasDocument;
  uuidMappings: UuidMappings;
  uuidToDocNoMap: Map<string, string>;
}

function ListItem({ item, uuidMappings, uuidToDocNoMap }: ListItemProps) {
  // Extract fields from StandardizedAtlasDocument
  const docNumber = item.doc_no;
  const docType = item.type;
  const docName = item.name;
  const docId = item.doc_no;

  // Get Notion ID for link - from UUID mappings
  let notionId: string | null = null;
  if (item.uuid && uuidMappings.atlasUUIDsToNotionPageIds) {
    notionId = uuidMappings.atlasUUIDsToNotionPageIds.get(item.uuid) || null;
  }

  // Format content, converting UUID links to document number anchors
  const formattedContent = markdownToHTML(item.content, uuidToDocNoMap);
  const hasContent = formattedContent.trim().length > 0;

  const handleTitleClick = () => {
    if (docId) {
      // Use history.pushState to update hash without triggering browser's native scroll
      // This prevents double-scrolling when navigating
      const newUrl = `${window.location.pathname}${window.location.search}#${docId}`;
      window.history.pushState(null, '', newUrl);
      // Manually trigger hashchange event for any listeners
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  };

  return (
    <div className="flex items-start space-x-3 py-3" data-doc-id={docId || undefined}>
      <div className="min-w-0 flex-1">
        <div className="space-y-2">
          <div className="flex items-center">
            {docNumber && (
              <h3 className="mr-2 inline-block rounded-md bg-slate-50 px-2 py-1 text-xs font-medium">{docNumber}</h3>
            )}
            <div>
              <span className={`inline-block rounded-md px-2 py-1 text-xs font-medium ${typeColorMap[docType]}`}>
                {docType || 'Unknown Type'}
              </span>
            </div>
          </div>
          <h3
            className="cursor-pointer text-lg font-semibold transition-colors hover:text-blue-600"
            onClick={handleTitleClick}
          >
            {docName || '<Untitled>'}
          </h3>
        </div>

        {hasContent && (
          <div className="mt-1 line-clamp-2 text-sm text-gray-600">
            <CustomHTML html={formattedContent} />
          </div>
        )}

        <div className="mt-2 flex flex-col items-start text-xs text-gray-300">
          {notionId && (
            <span>
              Notion ID:{' '}
              <a
                href={`https://www.notion.so/${uuidToNoHyphens(notionId)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-gray-700 hover:underline"
              >
                {uuidToNoHyphens(notionId)}
              </a>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
