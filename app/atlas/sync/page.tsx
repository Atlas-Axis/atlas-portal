import { diffAtlasScopeTreeLists } from '@/app/server/atlas/diff/markdown-supabase-diff';
import { loadUuidMappings, serializeUuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import { Content } from './content';

export const dynamic = 'force-dynamic';

/**
 * Atlas Sync Page - Server Component
 *
 * This page compares the Atlas Markdown export (exported-atlas/atlas.md)
 * with the current Supabase data and displays all differences in a visual diff UI.
 * The client component handles user interaction and synchronization to Notion.
 */
export default async function AtlasSyncPage() {
  // Diff happens server-side for performance (large datasets)
  const result = await diffAtlasScopeTreeLists();

  // Omit structural changes (parent_changed, sibling_order_changed) for now - will be enabled later!
  const filteredChanges = {
    added: result.changes.added,
    changed: result.changes.changed,
    deleted: result.changes.deleted,
    parent_changed: [],
    sibling_order_changed: [],
  };
  const filteredResult = {
    ...result,
    changes: filteredChanges,
  };

  // Load and serialize UUID mappings for markdown to rich text conversion
  const uuidMappings = await loadUuidMappings();
  const serializedMappings = serializeUuidMappings(uuidMappings);

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100 p-6 pb-12">
      <Content result={filteredResult} serializedMappings={serializedMappings} />
    </div>
  );
}
