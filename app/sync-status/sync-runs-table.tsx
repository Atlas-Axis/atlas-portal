import { formatDuration } from './format-duration';

export interface SyncRunRow {
  id: string;
  startedAt: Date | undefined;
  durationMs: number | undefined;
  status: string;
}

function getStatusClasses(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'bg-green-100 text-green-800';
    case 'FAILED':
    case 'CANCELED':
    case 'CRASHED':
    case 'SYSTEM_FAILURE':
    case 'TIMED_OUT':
    case 'EXPIRED':
      return 'bg-red-100 text-red-800';
    case 'EXECUTING':
    case 'QUEUED':
    case 'DEQUEUED':
    case 'WAITING':
    case 'DELAYED':
    case 'PENDING_VERSION':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-slate-100 text-slate-800';
  }
}

function formatStartedAt(date: Date | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function SyncRunsTable({ runs }: { runs: SyncRunRow[] }) {
  if (runs.length === 0) {
    return <p className="text-slate-600">No notion-database-import runs found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead>
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-sm font-medium text-slate-700">
              Started
            </th>
            <th scope="col" className="px-4 py-3 text-left text-sm font-medium text-slate-700">
              Duration
            </th>
            <th scope="col" className="px-4 py-3 text-left text-sm font-medium text-slate-700">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {runs.map((run) => (
            <tr key={run.id}>
              <td className="px-4 py-3 text-sm whitespace-nowrap text-slate-900">{formatStartedAt(run.startedAt)}</td>
              <td className="px-4 py-3 text-sm whitespace-nowrap text-slate-900">{formatDuration(run.durationMs)}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusClasses(run.status)}`}
                >
                  {run.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Run item from Trigger.dev API (startedAt is ISO string from JSON) */
interface TriggerRunItem {
  id: string;
  startedAt?: string;
  durationMs?: number;
  status: string;
}

/**
 * Map Trigger.dev run item to SyncRunRow
 */
export function mapRunToRow(run: TriggerRunItem): SyncRunRow {
  return {
    id: run.id,
    startedAt: run.startedAt ? new Date(run.startedAt) : undefined,
    durationMs: run.durationMs,
    status: run.status,
  };
}
