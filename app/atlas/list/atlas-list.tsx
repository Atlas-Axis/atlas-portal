'use client';

import { Accordion, AccordionItem } from '@heroui/accordion';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { uuidToNoHyphens } from '@/app/shared/utils/utils';
import s from './atlas-list.module.css';

interface AtlasListClientProps {
  atlasPagesPerDatabase: Record<string, NotionDatabasePage[]>;
}

// Optimization: This page renders ~6000 PageListItem rows. We use a CSS module with
// compact, purpose-specific classes instead of Tailwind utilities inside those rows
// to minimize repeated class name markup and reduce prerendered HTML size for Vercel builds.
// We ran into build errors when the size of the prerendered HTML exceeded the Vercel limit (19 MB)
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

  const typeClass = (() => {
    switch (page.atlas_document_type) {
      case 'Scope':
        return s.typeScope;
      case 'Article':
        return s.typeArticle;
      case 'Section':
        return s.typeSection;
      case 'Core':
        return s.typeCore;
      case 'Type Specification':
        return s.typeTypeSpecification;
      case 'Active Data Controller':
        return s.typeActiveDataController;
      case 'Spell SP Controller':
        return s.typeSpellSPController;
      case 'Placeholder':
        return s.typePlaceholder;
      case 'Category':
        return s.typeCategory;
      case 'Action Tenet':
        return s.typeActionTenet;
      case 'Active Data':
        return s.typeActiveData;
      case 'Annotation':
        return s.typeAnnotation;
      case 'Scenario':
        return s.typeScenario;
      case 'Scenario Variation':
        return s.typeScenarioVariation;
      case 'Needed Research':
        return s.typeNeededResearch;
      default:
        return '';
    }
  })();

  return (
    <div className={s.item}>
      <div className={s.content}>
        <div>
          <div className={s.header}>
            {page.atlas_document_number && <h3 className={s.number}>{page.atlas_document_number}</h3>}
            <div>
              <span className={`${s.type} ${typeClass}`}>{page.atlas_document_type || 'Unknown Type'}</span>
            </div>
          </div>
          <h3 className={s.title}>{page.canonical_document_title || '<Untitled>'}</h3>
        </div>

        {hasContent && <p className={s.desc}>{page.plain_text_content}</p>}

        <div className={s.meta}>
          {page.sort_order && <span>Order: {page.sort_order}</span>}
          <span>
            Notion ID:{' '}
            <a
              href={`https://www.notion.so/${uuidToNoHyphens(page.notion_page_id)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={s.link}
            >
              {uuidToNoHyphens(page.notion_page_id)}
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
