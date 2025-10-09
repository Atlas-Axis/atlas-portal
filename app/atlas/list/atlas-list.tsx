'use client';

import { Accordion, AccordionItem } from '@heroui/accordion';
import { atlasDatabasePageToHTML } from '@/app/server/atlas/atlas-rich-text-formatter';
import { AtlasTreeNode } from '@/app/server/atlas/atlas-tree-types';
import { UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import { typeColorMap } from '@/app/server/atlas/type-color-map';
import { uuidToNoHyphens } from '@/app/shared/utils/utils';
import { CustomHTML } from '../../components/custom-html';

interface AtlasListClientProps {
  atlasPagesPerDatabase: Record<string, AtlasTreeNode[]>;
  uuidMappings: UuidMappings;
}

export default function AtlasList({ atlasPagesPerDatabase, uuidMappings }: AtlasListClientProps) {
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
                      <ListItem key={page.notion_page_id} node={page} uuidMappings={uuidMappings} />
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
  node: AtlasTreeNode;
  uuidMappings: UuidMappings;
}

function ListItem({ node, uuidMappings }: ListItemProps) {
  const formattedContent = atlasDatabasePageToHTML(node, uuidMappings);
  const hasContent = formattedContent.trim().length > 0;

  // if (node.notion_page_id === '280f2ff0-8d73-80f8-a5d5-fcfb43950956') {
  //   console.log({ node });
  // }

  const handleTitleClick = () => {
    if (node.generatedDocID) {
      window.location.hash = node.generatedDocID;
    }
  };

  return (
    <div className="flex items-start space-x-3 py-3" id={node.generatedDocID}>
      <div className="min-w-0 flex-1">
        <div className="space-y-2">
          <div className="flex items-center">
            {node.atlas_document_number && (
              <h3 className="mr-2 inline-block rounded-md bg-slate-50 px-2 py-1 text-xs font-medium">
                {node.atlas_document_number}
              </h3>
            )}
            <div>
              <span
                className={`inline-block rounded-md px-2 py-1 text-xs font-medium ${typeColorMap[node.atlas_document_type]}`}
              >
                {node.atlas_document_type || 'Unknown Type'}
              </span>
            </div>
          </div>
          <h3
            className="cursor-pointer text-lg font-semibold transition-colors hover:text-blue-600"
            onClick={handleTitleClick}
          >
            {node.canonical_document_title || '<Untitled>'}
          </h3>
        </div>

        {hasContent && (
          <div className="mt-1 line-clamp-2 text-sm text-gray-600">
            <CustomHTML html={formattedContent} />
          </div>
        )}

        <div className="mt-2 flex flex-col items-start text-xs text-gray-300">
          {node.sort_order && <span>Order: {node.sort_order}</span>}
          <span>
            Notion ID:{' '}
            <a
              href={`https://www.notion.so/${uuidToNoHyphens(node.notion_page_id)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-700 hover:underline"
            >
              {uuidToNoHyphens(node.notion_page_id)}
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
