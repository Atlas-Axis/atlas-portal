'use server';

import { supabase } from '@/app/server/services/supabase/supabase-client';

export interface AuditLogRow {
  id: string;
  operation_type: 'create' | 'update' | 'delete';
  notion_page_id: string;
  atlas_document_uuid: string | null;
  database_name: string;
  request_payload: Record<string, unknown>;
  response_payload: Record<string, unknown> | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
  sync_batch_id: string | null;
}

const PAGE_SIZE = 100;

/**
 * Fetch audit logs from notion_api_audit_log table with pagination.
 * Returns latest entries first, ordered by created_at DESC.
 */
export async function fetchAuditLogs(offset: number = 0): Promise<{
  logs: AuditLogRow[];
  hasMore: boolean;
}> {
  const { data, error } = await supabase()
    .from('notion_api_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (error) {
    console.error('Failed to fetch audit logs:', error);
    throw new Error(`Failed to fetch audit logs: ${error.message}`);
  }

  return {
    logs: (data ?? []) as AuditLogRow[],
    hasMore: (data?.length ?? 0) === PAGE_SIZE,
  };
}

