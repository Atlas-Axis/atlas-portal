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
 * The diff is performed server-side for performance (large datasets).
 * When the "Use Dynamic Values" toggle is changed, the page refreshes with
 * updated URL params to regenerate the diff server-side.
 *
 * Note: UUID mappings are loaded in the server action (runRealSync) to avoid
 * large payload transfers between server and client.
 */
export default async function AtlasSyncPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Read useDynamicValues from URL params (migration mode toggle)
  // @todo CLEANUP: Remove after migration complete (Phase 8)
  const params = await searchParams;
  const useDynamicValues = params.dynamic === 'true';

  // Diff happens server-side for performance (large datasets)
  const result = await diffAtlasScopeTreeLists({ useDynamicValues });
  const isDevMode = process.env.NODE_ENV !== 'production';

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100 p-6 pb-12">
      <Content result={result} isDevMode={isDevMode} useDynamicValues={useDynamicValues} />
    </div>
  );
}
