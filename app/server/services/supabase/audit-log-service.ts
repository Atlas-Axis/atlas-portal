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
