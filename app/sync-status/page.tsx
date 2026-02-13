/**
 * Sync Status Dashboard
 *
 * Internal tool that lists Notion-to-Supabase sync jobs from Trigger.dev.
 * Shows start datetime, duration, and status for notion-database-import runs.
 *
 * Protected by simple password authentication. Fetches data on each load (no caching).
 */
import type { Metadata } from 'next';
import { checkAuthentication } from './_actions/auth-actions';
import { fetchNotionDatabaseImportRuns } from './fetch-trigger-runs';
import { PasswordInput } from './password-input';
import { type SyncRunRow, SyncRunsTable, mapRunToRow } from './sync-runs-table';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sync Status - Atlas',
  description: 'Notion to Supabase sync job status dashboard',
};

export default async function SyncStatusPage() {
  const isAuthenticated = await checkAuthentication();

  if (!isAuthenticated) {
    return <PasswordInput />;
  }

  let runRows: SyncRunRow[] = [];
  let error: string | null = null;

  if (!process.env.TRIGGER_SECRET_KEY) {
    error = 'TRIGGER_SECRET_KEY is not configured. Cannot fetch runs.';
  } else {
    try {
      const runs = await fetchNotionDatabaseImportRuns();
      runRows = runs.map(mapRunToRow);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch runs';
      error = message;
      console.error('[sync-status] Error fetching Trigger.dev runs:', err);
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100 p-6 pb-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Notion to Supabase Sync Status</h1>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-lg font-semibold text-slate-800">notion-database-import runs</h2>
          </div>
          <div className="p-4">
            <SyncRunsTable runs={runRows} />
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-500">
          Reload the page to refresh. Data is fetched from Trigger.dev on each load.
        </p>
      </div>
    </div>
  );
}
