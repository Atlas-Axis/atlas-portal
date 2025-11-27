import { AuditLogRow, fetchAuditLogs } from './_actions/fetch-logs';
import { LogsContent } from './content';

export const dynamic = 'force-dynamic';

export default async function SyncLogsPage() {
  const { logs, hasMore } = await fetchAuditLogs(0);

  return (
    <div className="min-h-screen bg-slate-100 p-6 pb-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Notion API Audit Logs</h1>
          <p className="mt-1 text-sm text-slate-600">
            Complete audit trail of all Notion API operations during Markdown→Notion sync.
          </p>
        </div>

        <LogsContent initialLogs={logs} initialHasMore={hasMore} />
      </div>
    </div>
  );
}

