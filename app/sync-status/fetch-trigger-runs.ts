/**
 * Fetch notion-database-import runs from Trigger.dev REST API.
 * Uses fetch instead of SDK to avoid client-side code in server components.
 */

const TRIGGER_API_BASE = 'https://api.trigger.dev';

export interface TriggerRunItem {
  id: string;
  status: string;
  startedAt?: string;
  durationMs?: number;
}

interface ListRunsResponse {
  data: TriggerRunItem[];
  pagination?: { next?: string; previous?: string };
}

export async function fetchNotionDatabaseImportRuns(): Promise<TriggerRunItem[]> {
  const secretKey = process.env.TRIGGER_SECRET_KEY;
  if (!secretKey) {
    throw new Error('TRIGGER_SECRET_KEY is not configured');
  }

  const params = new URLSearchParams({
    'filter[taskIdentifier]': 'notion-database-import',
    'page[size]': '50',
  });

  const url = `${TRIGGER_API_BASE}/api/v1/runs?${params.toString()}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 0 }, // Never cache
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Trigger.dev API error ${res.status}: ${text}`);
  }

  const json = (await res.json()) as ListRunsResponse;
  return json.data ?? [];
}

/** Row shape for SyncRunsTable (startedAt stays as ISO string for client formatting) */
export interface SyncRunRow {
  id: string;
  startedAt?: string;
  durationMs?: number;
  status: string;
}

export function mapRunToRow(run: TriggerRunItem): SyncRunRow {
  return {
    id: run.id,
    startedAt: run.startedAt,
    durationMs: run.durationMs,
    status: run.status,
  };
}
