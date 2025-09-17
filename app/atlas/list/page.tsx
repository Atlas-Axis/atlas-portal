import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { loadAtlasFromSupabase } from '@/app/server/services/atlas/load-atlas-from-supabase';
import { typeColorMap } from '@/app/server/services/atlas/type-color-map';
import { uuidToNoHyphens } from '@/app/shared/utils/utils';

// export const dynamic = 'force-dynamic';

export default async function AtlasListPage() {
  // Load Atlas pages from Supabase, grouped by Atlas database
  const atlasPagesPerDatabase = await loadAtlasFromSupabase();

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {Object.entries(atlasPagesPerDatabase).map(([databaseName, pages]) => (
          <DatabaseSection key={databaseName} databaseName={databaseName} pages={pages} />
        ))}
      </div>
    </div>
  );
}

interface DatabaseSectionProps {
  databaseName: string;
  pages: NotionDatabasePage[];
}

// Note: Data is already sorted by sort_order from the database query, no need to sort here
function DatabaseSection({ databaseName, pages }: DatabaseSectionProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-12 shadow-sm">
      <h2 className="mb-6 border-b border-gray-200 pb-3 text-2xl font-bold text-gray-900">
        {databaseName}
        <span className="ml-4 text-sm text-gray-300">{pages.length} documents</span>
      </h2>

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
  );
}

interface PageListItemProps {
  page: NotionDatabasePage;
}

function PageListItem({ page }: PageListItemProps) {
  // TODO: Create a reusable function in the atlas folder for calculating display title based on database type
  const hasContent = page.plain_text_content && page.plain_text_content.trim().length > 0;

  return (
    <div className="flex items-start space-x-3 p-3">
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
          <h3 className="text-lg font-semibold">{page.plain_text_name || '<Untitled>'}</h3>
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
