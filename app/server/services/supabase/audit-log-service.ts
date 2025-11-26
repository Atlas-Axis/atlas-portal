/**
 * Audit Log Service
 *
 * Manages audit logging for all Notion API operations during Markdown→Notion sync.
 * Stores complete request/response payloads for debugging, compliance, and accountability.
 *
 * Audit logs are stored in the notion_api_audit_log table and include:
 * - Operation type (create, update, delete)
 * - Complete request and response payloads
 * - Success/failure status
 * - Error messages for failures
 * - Batch ID to group operations from the same sync
 */
import { AtlasDatabaseName } from '../../atlas/atlas-types';
import type { Json } from './database.types';
import { supabase } from './supabase-client';

/**
 * Audit log entry for a single Notion API operation
 */
export interface AuditLogEntry {
  operationType: 'create' | 'update' | 'delete';
  notionPageId: string;
  atlasDocumentUuid: string | null;
  databaseName: AtlasDatabaseName;
  requestPayload: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
  syncBatchId?: string;
}

/**
 * Create a new sync batch ID for grouping related operations.
 *
 * A sync batch represents a single execution of the Markdown→Notion sync.
 * All operations within that sync share the same batch ID for tracking.
 *
 * @returns A new UUID for the sync batch
 */
export function createSyncBatch(): string {
  return crypto.randomUUID();
}

/**
 * Log a Notion API operation to the audit log.
 *
 * This function should be called after every Notion API operation (create, update, delete)
 * during sync to maintain a complete audit trail.
 *
 * @param entry The audit log entry to store
 * @throws Error if logging fails (non-critical - should not block sync)
 */
export async function logNotionApiOperation(entry: AuditLogEntry): Promise<void> {
  try {
    const { error } = await supabase()
      .from('notion_api_audit_log')
      .insert({
        operation_type: entry.operationType,
        notion_page_id: entry.notionPageId,
        atlas_document_uuid: entry.atlasDocumentUuid,
        database_name: entry.databaseName,
        request_payload: entry.requestPayload as Json,
        response_payload: (entry.responsePayload || null) as Json,
        success: entry.success,
        error_message: entry.errorMessage || null,
        sync_batch_id: entry.syncBatchId || null,
      });

    if (error) {
      // Log error but don't throw - audit logging should not block sync operations
      console.error('Failed to log Notion API operation to audit log:', error);
      console.error('Entry that failed to log:', entry);
    }
  } catch (error) {
    // Catch any unexpected errors and log them
    console.error('Unexpected error logging Notion API operation:', error);
    console.error('Entry that failed to log:', entry);
  }
}

/**
 * Log multiple Notion API operations in a single batch.
 *
 * This is more efficient than calling logNotionApiOperation() multiple times
 * when multiple operations complete at once.
 *
 * NOTE: This function is currently unused and may be deleted in the future.
 * Created for potential batch logging but currently operations are logged individually.
 *
 * @param entries Array of audit log entries to store
 */
export async function logNotionApiOperationsBatch(entries: AuditLogEntry[]): Promise<void> {
  if (entries.length === 0) {
    return;
  }

  try {
    const rows = entries.map((entry) => ({
      operation_type: entry.operationType,
      notion_page_id: entry.notionPageId,
      atlas_document_uuid: entry.atlasDocumentUuid,
      database_name: entry.databaseName,
      request_payload: entry.requestPayload as Json,
      response_payload: (entry.responsePayload || null) as Json,
      success: entry.success,
      error_message: entry.errorMessage || null,
      sync_batch_id: entry.syncBatchId || null,
    }));

    const { error } = await supabase().from('notion_api_audit_log').insert(rows);

    if (error) {
      // Log error but don't throw - audit logging should not block sync operations
      console.error('Failed to log Notion API operations batch to audit log:', error);
      console.error(`Failed to log ${entries.length} entries`);
    }
  } catch (error) {
    // Catch any unexpected errors and log them
    console.error('Unexpected error logging Notion API operations batch:', error);
    console.error(`Failed to log ${entries.length} entries`);
  }
}

/**
 * Query audit log entries for a specific sync batch.
 *
 * Useful for reviewing all operations performed during a single sync execution.
 *
 * NOTE: This function is currently unused and may be deleted in the future.
 * Created for potential audit log querying but not currently needed in the UI.
 *
 * @param syncBatchId The batch ID to query
 * @returns Array of audit log entries for the batch
 */
export async function getAuditLogEntriesForBatch(syncBatchId: string): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase()
    .from('notion_api_audit_log')
    .select('*')
    .eq('sync_batch_id', syncBatchId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to get audit log entries for batch: ${error.message}`);
  }

  return (
    data?.map((row: Record<string, unknown>) => ({
      operationType: row.operation_type as 'create' | 'update' | 'delete',
      notionPageId: row.notion_page_id as string,
      atlasDocumentUuid: row.atlas_document_uuid as string | null,
      databaseName: row.database_name as AtlasDatabaseName,
      requestPayload: row.request_payload as Record<string, unknown>,
      responsePayload: row.response_payload as Record<string, unknown> | undefined,
      success: row.success as boolean,
      errorMessage: (row.error_message as string) || undefined,
      syncBatchId: (row.sync_batch_id as string) || undefined,
    })) || []
  );
}

/**
 * Query audit log entries for a specific Notion page.
 *
 * Useful for reviewing the history of operations on a single page.
 *
 * NOTE: This function is currently unused and may be deleted in the future.
 * Created for potential audit log querying but not currently needed in the UI.
 *
 * @param notionPageId The Notion page ID to query
 * @param limit Maximum number of entries to return (default: 100)
 * @returns Array of audit log entries for the page
 */
export async function getAuditLogEntriesForPage(notionPageId: string, limit = 100): Promise<AuditLogEntry[]> {
  const { data, error } = await supabase()
    .from('notion_api_audit_log')
    .select('*')
    .eq('notion_page_id', notionPageId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get audit log entries for page: ${error.message}`);
  }

  return (
    data?.map((row: Record<string, unknown>) => ({
      operationType: row.operation_type as 'create' | 'update' | 'delete',
      notionPageId: row.notion_page_id as string,
      atlasDocumentUuid: row.atlas_document_uuid as string | null,
      databaseName: row.database_name as AtlasDatabaseName,
      requestPayload: row.request_payload as Record<string, unknown>,
      responsePayload: row.response_payload as Record<string, unknown> | undefined,
      success: row.success as boolean,
      errorMessage: (row.error_message as string) || undefined,
      syncBatchId: (row.sync_batch_id as string) || undefined,
    })) || []
  );
}
