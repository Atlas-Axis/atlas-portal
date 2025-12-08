import { diffAtlasScopeTreeLists } from '@/app/server/atlas/diff/markdown-supabase-diff';
import { Content } from './content';

export const dynamic = 'force-dynamic';

/**
 * Atlas Sync Page - Server Component
 *
 * This page compares the canonical Atlas Markdown file from GitHub
 * with the current Supabase data and displays all differences in a visual diff UI.
 * The client component handles user interaction and synchronization to Notion.
 *
 * The initial diff is performed server-side for performance (large datasets).
 * When the "Use Dynamic Values" toggle is changed, the client re-runs the diff
 * via a server action with the new option.
 *
 * Note: UUID mappings are loaded in the server action (runRealSync) to avoid
 * large payload transfers between server and client.
 */
export default async function AtlasSyncPage() {
  // Initial diff happens server-side for performance (large datasets)
  // Uses stored values (useDynamicValues: false) by default
  const initialResult = await diffAtlasScopeTreeLists();
  const isDevMode = process.env.NODE_ENV !== 'production';

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100 p-6 pb-12">
      <Content initialResult={initialResult} isDevMode={isDevMode} />
    </div>
  );
}
