'use client';

import { useState, useTransition } from 'react';
import { CheckCircle, XCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { AuditLogRow, fetchAuditLogs } from './_actions/fetch-logs';

interface LogsContentProps {
  initialLogs: AuditLogRow[];
  initialHasMore: boolean;
}

export function LogsContent({ initialLogs, initialHasMore }: LogsContentProps) {
  const [logs, setLogs] = useState<AuditLogRow[]>(initialLogs);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startTransition] = useTransition();

  const handleLoadMore = () => {
    startTransition(async () => {
      const result = await fetchAuditLogs(logs.length);
      setLogs((prev) => [...prev, ...result.logs]);
      setHasMore(result.hasMore);
    });
  };

  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow-sm">
        <p className="text-slate-500">No audit logs found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="divide-y divide-slate-100">
          {logs.map((log) => (
            <LogRow key={log.id} log={log} />
          ))}
        </div>
      </div>

      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={handleLoadMore}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </button>
        </div>
      )}

      <p className="text-center text-sm text-slate-500">
        Showing {logs.length} log{logs.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

function LogRow({ log }: { log: AuditLogRow }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const operationColors = {
    create: 'bg-green-100 text-green-800',
    update: 'bg-blue-100 text-blue-800',
    delete: 'bg-red-100 text-red-800',
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="p-4">
      <div
        className="flex cursor-pointer items-center justify-between gap-4"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {log.success ? (
            <CheckCircle className="h-5 w-5 shrink-0 text-green-500" />
          ) : (
            <XCircle className="h-5 w-5 shrink-0 text-red-500" />
          )}

          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium uppercase ${operationColors[log.operation_type]}`}
          >
            {log.operation_type}
          </span>

          <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
            {log.database_name}
          </span>

          <span className="font-mono text-xs text-slate-500">{log.notion_page_id}</span>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs text-slate-500">{formatDate(log.created_at)}</span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Notion Page ID:</span>
              <code className="ml-2 font-mono text-xs">{log.notion_page_id}</code>
            </div>
            {log.atlas_document_uuid && (
              <div>
                <span className="text-slate-500">Atlas UUID:</span>
                <code className="ml-2 font-mono text-xs">{log.atlas_document_uuid}</code>
              </div>
            )}
            {log.sync_batch_id && (
              <div>
                <span className="text-slate-500">Batch ID:</span>
                <code className="ml-2 font-mono text-xs">{log.sync_batch_id}</code>
              </div>
            )}
          </div>

          {log.error_message && (
            <div className="rounded-md bg-red-50 p-3">
              <p className="text-sm font-medium text-red-800">Error:</p>
              <p className="mt-1 text-sm text-red-700">{log.error_message}</p>
            </div>
          )}

          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">Request Payload:</p>
            <pre className="max-h-48 overflow-auto rounded-md bg-slate-50 p-3 text-xs">
              {JSON.stringify(log.request_payload, null, 2)}
            </pre>
          </div>

          {log.response_payload && (
            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">Response Payload:</p>
              <pre className="max-h-48 overflow-auto rounded-md bg-slate-50 p-3 text-xs">
                {JSON.stringify(log.response_payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

