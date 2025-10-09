import { Edit3, FileText, Minus, Plus } from 'lucide-react';
import {
  type AtlasPageChange,
  CHILD_FIELDS,
  loadAtlasChangeHistory,
} from '@/app/server/atlas/load-atlas-change-history';
import { supabase } from '@/app/server/services/supabase/supabase-client';

export const dynamic = 'force-dynamic';

async function fetchPageIdToAtlasDocumentNameMap(changes: AtlasPageChange[]): Promise<Map<string, string>> {
  // Collect all Notion page IDs referenced in child field diffs across all changes
  const referencedChildIds = new Set<string>();
  for (const change of changes) {
    if (change.type !== 'changed') continue;
    for (const [field, changeData] of Object.entries(change.changes.properties)) {
      if (!(CHILD_FIELDS as string[]).includes(field)) continue;
      try {
        const removed: unknown = JSON.parse(changeData.oldValue || '[]');
        const added: unknown = JSON.parse(changeData.newValue || '[]');
        if (Array.isArray(removed)) for (const id of removed) referencedChildIds.add(String(id));
        if (Array.isArray(added)) for (const id of added) referencedChildIds.add(String(id));
      } catch {
        // Ignore malformed JSON values
        console.warn('Failed to parse JSON for child field diff:', field, changeData);
      }
    }
  }

  // Fetch names for referenced child IDs in a single query
  const idToName = new Map<string, string>();
  if (referencedChildIds.size > 0) {
    const ids = Array.from(referencedChildIds);
    // Chunk to avoid URL length limits if needed; use 1000 as a safe chunk size
    const chunkSize = 1000;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const { data, error } = await supabase()
        .from('notion_database_pages_current')
        .select('notion_page_id, plain_text_name')
        .in('notion_page_id', chunk);
      if (error) {
        console.error('Failed to load names for child IDs', { error });
        break;
      }
      for (const row of data ?? []) {
        idToName.set(row.notion_page_id as string, (row.plain_text_name as string) ?? '');
      }
    }
  }

  return idToName;
}

export default async function AtlasChangelogPage() {
  const changes = await loadAtlasChangeHistory();

  console.log(`Loaded ${changes.length} changes for the changelog page.`);
  console.log(changes);

  const idToName = await fetchPageIdToAtlasDocumentNameMap(changes);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Atlas Changelog</h1>
        <p className="text-gray-600">Recent changes to Atlas documents tracked in the system.</p>
      </div>

      <div className="space-y-6">
        {changes.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="py-12 text-center">
              <FileText className="mx-auto mb-4 h-12 w-12 text-gray-400" />
              <h3 className="mb-2 text-lg font-semibold">No Changes Found</h3>
              <p className="text-gray-600">No recent changes have been detected in the Atlas documents.</p>
            </div>
          </div>
        ) : (
          changes.map((change, index) => <ChangeCard key={index} change={change} idToName={idToName} />)
        )}
      </div>
    </div>
  );
}

function ChangeCard({ change, idToName }: { change: AtlasPageChange; idToName: Map<string, string> }) {
  const getChangeIcon = () => {
    switch (change.type) {
      case 'new':
        return <Plus className="h-4 w-4" />;
      case 'deleted':
        return <Minus className="h-4 w-4" />;
      case 'changed':
        return <Edit3 className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const page = change.newPage || change.oldPage;
  const changeCount = Object.keys(change.changes.properties).length;

  const formatChildArrayAsNames = (rawJsonArray: string): string => {
    try {
      const arr = JSON.parse(rawJsonArray || '[]');
      if (!Array.isArray(arr)) return rawJsonArray || '[]';
      const names = arr.map((id) => idToName.get(String(id)) || String(id));
      return JSON.stringify(names);
    } catch {
      return rawJsonArray || '[]';
    }
  };

  if (changeCount === 0 && change.type === 'changed') {
    console.warn('Change of type "changed" has no actual property changes:', change);
    return null; // Skip rendering if there are no actual changes
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-row items-center justify-between p-6">
        <div className="flex items-center gap-3">
          <div className="relative mr-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
              <FileText className="h-4 w-4 text-gray-600" />
            </div>
            <div
              className={`absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-xs ${
                change.type === 'new'
                  ? 'bg-green-500 text-white'
                  : change.type === 'deleted'
                    ? 'bg-red-500 text-white'
                    : 'bg-yellow-500 text-white'
              }`}
            >
              {getChangeIcon()}
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold">{page?.plain_text_name || 'Unknown Document'}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                {page?.atlas_document_type || 'Unknown Type'}
              </span>
              <span>•</span>
              <span>{page?.atlas_database_name || 'Unknown Database'}</span>
              {page?.atlas_document_number && (
                <>
                  <span>•</span>
                  <span className="font-mono text-xs">{page.atlas_document_number}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
              change.type === 'new'
                ? 'bg-green-100 text-green-800'
                : change.type === 'deleted'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800'
            }`}
          >
            {getChangeIcon()}
            {change.type.toUpperCase()}
          </span>
          {change.type === 'changed' && changeCount > 0 && (
            <span className="inline-flex items-center rounded-full border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700">
              {changeCount} change{changeCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {change.type === 'changed' && changeCount > 0 && (
        <>
          <div className="border-t border-gray-200"></div>
          <div className="p-6 pt-4">
            <h4 className="mb-3 text-sm font-semibold text-gray-700">Changes Made:</h4>
            <div className="space-y-3">
              {Object.entries(change.changes.properties).map(([field, changeData]) => (
                <div key={field} className="rounded-lg bg-gray-50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 capitalize">{field.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <div className="mb-1 text-xs text-gray-500">
                        {(CHILD_FIELDS as string[]).includes(field) ? 'Removed:' : 'Before:'}
                      </div>
                      <div className="rounded border border-red-200 bg-red-50 p-2 font-mono text-sm text-red-800">
                        {(CHILD_FIELDS as string[]).includes(field)
                          ? formatChildArrayAsNames(changeData.oldValue)
                          : changeData.oldValue || '(empty)'}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 text-xs text-gray-500">
                        {(CHILD_FIELDS as string[]).includes(field) ? 'Added:' : 'After:'}
                      </div>
                      <div className="rounded border border-green-200 bg-green-50 p-2 font-mono text-sm text-green-800">
                        {(CHILD_FIELDS as string[]).includes(field)
                          ? formatChildArrayAsNames(changeData.newValue)
                          : changeData.newValue || '(empty)'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {change.type === 'new' && change.newPage && (
        <>
          <div className="border-t border-gray-200"></div>
          <div className="p-6 pt-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <div className="text-sm text-green-800">
                <strong>New document created:</strong> {change.newPage.plain_text_name}
              </div>
              {change.newPage.plain_text_content && (
                <div className="mt-2 text-sm text-green-700">
                  {change.newPage.plain_text_content.substring(0, 200)}
                  {change.newPage.plain_text_content.length > 200 && '...'}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {change.type === 'deleted' && change.oldPage && (
        <>
          <div className="border-t border-gray-200"></div>
          <div className="p-6 pt-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <div className="text-sm text-red-800">
                <strong>Document deleted:</strong> {change.oldPage.plain_text_name}
              </div>
              {change.oldPage.plain_text_content && (
                <div className="mt-2 text-sm text-red-700">
                  {change.oldPage.plain_text_content.substring(0, 200)}
                  {change.oldPage.plain_text_content.length > 200 && '...'}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
