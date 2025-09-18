'use client';

import { Accordion, AccordionItem } from '@heroui/accordion';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { typeColorMap } from '@/app/server/services/atlas/type-color-map';
import { uuidToNoHyphens } from '@/app/shared/utils/utils';

interface AtlasListClientProps {
  atlasPagesPerDatabase: Record<string, NotionDatabasePage[]>;
}

export default function AtlasListClient({ atlasPagesPerDatabase }: AtlasListClientProps) {
  const databaseNames = Object.keys(atlasPagesPerDatabase);

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
                    {pages.map((page) => (
                      <PageListItem key={page.notion_page_id} page={page} />
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

interface PageListItemProps {
  page: NotionDatabasePage;
}

function PageListItem({ page }: PageListItemProps) {
  // TODO: Create a reusable function in the atlas folder for calculating display title based on database type
  const hasContent = page.plain_text_content && page.plain_text_content.trim().length > 0;

  return (
    <div className="flex items-start space-x-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="space-y-2">
          <div className="flex items-center">
            {page.atlas_document_number && (
              <h3 className="mr-2 inline-block rounded-md bg-slate-50 px-2 py-1 text-xs font-medium">
                {page.atlas_document_number}
              </h3>
            )}
            <div>
              <span
                className={`inline-block rounded-md px-2 py-1 text-xs font-medium ${typeColorMap[page.atlas_document_type]}`}
              >
                {page.atlas_document_type || 'Unknown Type'}
              </span>
            </div>
          </div>
          <h3 className="text-lg font-semibold">{page.canonical_document_title || '<Untitled>'}</h3>
        </div>

        {hasContent && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{page.plain_text_content}</p>}

        <div className="mt-2 flex flex-col items-start text-xs text-gray-300">
          {page.sort_order && <span>Order: {page.sort_order}</span>}
          <span>
            Notion ID:{' '}
            <a
              href={`https://www.notion.so/${uuidToNoHyphens(page.notion_page_id)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-700 hover:underline"
            >
              {uuidToNoHyphens(page.notion_page_id)}
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
