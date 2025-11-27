'use server';

import { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import { AtlasDocumentChange } from '@/app/server/atlas/diff/atlas-diff';
import { diffAtlasScopeTreeLists } from '@/app/server/atlas/diff/markdown-supabase-diff';
import { ExportAtlasTreeBaseDocument } from '@/app/server/atlas/export/types';
import { UuidMappings, loadUuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import { NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS } from '@/app/server/atlas/notion-mapping/notion-database-properties-and-relationships';
import { notion } from '@/app/server/services/notion/notion-client';
import { logNotionApiOperation } from '@/app/server/services/supabase/audit-log-service';
import {
  buildNestingBugAffectedUuidsSet,
  loadNotionNestingFixMappings,
} from '@/app/server/services/supabase/notion-nesting-bug-mappings';
import { storeUuidMapping } from '@/app/server/services/supabase/uuid-mapping-service';
import {
  databaseSupportsInternalNesting,
  getDatabaseNameFromDocument,
  getInternalParentPageIdFromAncestry,
  getNotionDatabaseIdForDatabaseName,
} from '../_lib/atlas-database-mapper';
import type { RealSyncResult, SerializedBatchData } from '../_lib/batch-sync-types';
import {
  addInterDatabaseRelationshipProperties,
  addParentPageRelationshipProperty,
  buildNotionProperties,
} from '../_lib/notion-property-builder';
import { syncChangesToNotion } from '../_lib/sync-orchestrator';

// Re-export types for client use (only type exports allowed in 'use server' files)
export type { RealSyncResult, SerializedBatchData } from '../_lib/batch-sync-types';
// Note: SYNC_BATCH_SIZE must be imported directly from batch-sync-types.ts by clients

export interface SyncActionResult {
  success: boolean;
  pageId?: string;
  error?: string;
  reason?: string;
}

export interface SyncActionOptions {
  syncBatchId?: string;
}

/**
 * Updates content and properties of an existing Notion page.
 * Handles all document types including extra fields.
 *
 * @param change The change object containing the new values
 * @param originalIdsToDatabase Map of UUIDs to database names for original documents
 * @param uuidMappings UUID mappings for converting Atlas UUIDs to Notion page links in markdown
 * @param options Sync options including batch ID for audit logging
 */
export async function updateNotionPageContent(
  change: AtlasDocumentChange,
  originalIdsToDatabase: Map<string, AtlasDatabaseName>,
  uuidMappings: UuidMappings,
  options?: SyncActionOptions,
): Promise<SyncActionResult> {
  let databaseName: AtlasDatabaseName | null = null;
  let properties: Record<string, unknown> | null = null;

  try {
    if (!change.uuid) {
      return { success: false, error: 'Missing page UUID' };
    }

    if (!change.newValues) {
      return { success: false, error: 'Missing new values for update' };
    }

    if (!change.oldValues) {
      return { success: false, error: 'Missing old values for database derivation' };
    }

    // Derive database name from document type and database tracking map
    databaseName = getDatabaseNameFromDocument(change.oldValues.type, change.uuid, originalIdsToDatabase);

    // Build Notion properties from the document (converts markdown to rich text)
    properties = buildNotionProperties(change.newValues, databaseName, uuidMappings);

    // Update the page using Notion API
    const notionClient = notion();
    const response = await notionClient.pages.update({
      page_id: change.uuid,
      properties: properties as Parameters<typeof notionClient.pages.update>[0]['properties'],
    });

    // Log successful operation to audit log
    await logNotionApiOperation({
      operationType: 'update',
      notionPageId: change.uuid,
      atlasDocumentUuid: change.newValues.uuid || null,
      databaseName,
      requestPayload: { page_id: change.uuid, properties },
      responsePayload: response as Record<string, unknown>,
      success: true,
      syncBatchId: options?.syncBatchId,
    });

    return { success: true, pageId: change.uuid };
  } catch (error) {
    const err = error as Error;
    console.error(`Failed to update page ${change.uuid}:`, err);

    // Log failed operation to audit log
    if (databaseName && properties) {
      await logNotionApiOperation({
        operationType: 'update',
        notionPageId: change.uuid || 'unknown',
        atlasDocumentUuid: change.newValues?.uuid || null,
        databaseName,
        requestPayload: { page_id: change.uuid, properties },
        success: false,
        errorMessage: err.message,
        syncBatchId: options?.syncBatchId,
      });
    }

    return {
      success: false,
      error: err.message || 'Unknown error',
    };
  }
}

/**
 * Creates a new Notion database page.
 * Validates that the relationship parent page exists before creating (if applicable).
 *
 * CRITICAL: The Notion API parent is always the database itself (parent.database_id).
 * Internal hierarchy is established via relationship properties (e.g., "Parent Doc", "Parent item").
 *
 * @param change The change object containing the new document
 * @param newIdsToDocuments Map of UUIDs to document objects for database derivation
 * @param newIdsToDatabase Map of UUIDs to database names for new documents
 * @param uuidMappings UUID mappings for converting Atlas UUIDs to Notion page IDs
 * @param options Sync options including batch ID for audit logging
 */
export async function createNotionDatabasePage(
  change: AtlasDocumentChange,
  newIdsToDocuments: Map<string, ExportAtlasTreeBaseDocument>,
  newIdsToDatabase: Map<string, AtlasDatabaseName>,
  uuidMappings: UuidMappings,
  options?: SyncActionOptions,
): Promise<SyncActionResult> {
  try {
    if (!change.newValues) {
      return { success: false, error: 'Missing new values for creation' };
    }

    const doc = change.newValues;

    if (!doc.uuid) {
      return { success: false, error: 'Missing document UUID' };
    }

    // Derive database name from document type and database tracking map
    const databaseName = getDatabaseNameFromDocument(doc.type, doc.uuid, newIdsToDatabase);
    const databaseId = getNotionDatabaseIdForDatabaseName(databaseName);

    // Get internal parent info (only if parent is in the same database)
    // Returns null for cross-database parents or when no parent exists - both are valid scenarios
    // The returned notionPageId is the Notion page ID (converted from Atlas UUID via uuidMappings)
    const internalParentInfo = getInternalParentPageIdFromAncestry(
      change.newAncestry,
      databaseName,
      newIdsToDatabase,
      uuidMappings,
    );

    // Validate relationship parent exists ONLY if one is specified and it's in the same database
    // Skip validation when internalParentInfo is null (root-level or cross-database) - both are valid
    if (internalParentInfo) {
      const parentExists = await validatePageExists(internalParentInfo.notionPageId);
      if (!parentExists) {
        return {
          success: false,
          reason: 'parent_not_found',
          error: `Relationship parent page ${internalParentInfo.notionPageId} (Atlas UUID: ${internalParentInfo.atlasUuid}) does not exist`,
        };
      }
    }

    // Build Notion properties from Atlas document data (converts markdown to rich text)
    const properties = buildNotionProperties(doc, databaseName, uuidMappings);

    // Add relationship properties for internally nested databases
    // This sets the "Parent Doc" or "Parent item" property to establish internal hierarchy
    // Note: addParentPageRelationshipProperty expects a Notion page ID, which we get from internalParentInfo
    if (databaseSupportsInternalNesting(databaseName) && internalParentInfo) {
      const relationshipProps = addParentPageRelationshipProperty(internalParentInfo.notionPageId, databaseName);
      Object.assign(properties, relationshipProps);
    }

    // Add relationship properties for inter-database relationships
    // This sets relationships when parent is in a different database (e.g., Article → Section)
    // Note: addInterDatabaseRelationshipProperties converts Atlas UUIDs to Notion page IDs internally
    const interDbRelationshipProps = addInterDatabaseRelationshipProperties(
      change.newAncestry,
      databaseName,
      newIdsToDocuments,
      newIdsToDatabase,
      uuidMappings,
    );

    // Validate inter-database parent exists (if one was found)
    // Extract Notion page IDs from the relationship properties to validate
    // Note: The IDs in interDbRelationshipProps are already Notion page IDs (converted from Atlas UUIDs)
    const interDbParentIds: string[] = [];
    for (const propValue of Object.values(interDbRelationshipProps)) {
      const relationProp = propValue as { relation?: Array<{ id: string }> };
      if (relationProp.relation && Array.isArray(relationProp.relation)) {
        interDbParentIds.push(...relationProp.relation.map((r) => r.id));
      } else {
        throw new Error('Invalid relationship property');
      }
    }

    // If more than one inter-database parent exists, throw an error
    if (interDbParentIds.length > 1) {
      throw new Error(
        `Multiple inter-database parents found for database "${databaseName}": ${JSON.stringify(interDbParentIds)}`,
      );
    }

    // Validate all inter-database parents exist
    for (const interDbParentNotionPageId of interDbParentIds) {
      const parentExists = await validatePageExists(interDbParentNotionPageId);
      if (!parentExists) {
        return {
          success: false,
          reason: 'parent_not_found',
          error: `Inter-database parent page ${interDbParentNotionPageId} does not exist`,
        };
      }
    }

    // Merge inter-database relationship properties
    Object.assign(properties, interDbRelationshipProps);

    // Prepare request payload for audit logging
    const requestPayload = {
      parent: {
        type: 'database_id',
        database_id: databaseId,
      },
      properties,
    };

    // Create the page (parent is always the database ID, never a page ID)
    const notionClient = notion();
    const createdPage = await notionClient.pages.create({
      parent: {
        type: 'database_id',
        database_id: databaseId,
      },
      properties: properties as Parameters<typeof notionClient.pages.create>[0]['properties'],
    });

    // Store UUID mapping for the newly created page
    // This allows the new page to be referenced in subsequent operations during the same sync
    if (doc.uuid) {
      await storeUuidMapping(createdPage.id, doc.uuid);

      // Update the UUID mappings in-memory for use in this sync batch
      uuidMappings.atlasUUIDsToNotionPageIds.set(doc.uuid, createdPage.id);
      uuidMappings.notionPageIDsToAtlasUUIDs.set(createdPage.id, doc.uuid);
    }

    // Log successful operation to audit log
    await logNotionApiOperation({
      operationType: 'create',
      notionPageId: createdPage.id,
      atlasDocumentUuid: doc.uuid,
      databaseName,
      requestPayload,
      responsePayload: createdPage as Record<string, unknown>,
      success: true,
      syncBatchId: options?.syncBatchId,
    });

    return { success: true, pageId: createdPage.id };
  } catch (error) {
    const err = error as Error;
    console.error(`Failed to create page:`, err);

    // Log failed operation to audit log (best effort - may not have all details)
    if (change.newValues?.uuid) {
      const doc = change.newValues;
      const databaseName = getDatabaseNameFromDocument(doc.type, doc.uuid!, newIdsToDatabase);

      await logNotionApiOperation({
        operationType: 'create',
        notionPageId: 'failed-to-create',
        atlasDocumentUuid: doc.uuid,
        databaseName,
        requestPayload: { error: 'Failed before request could be made' },
        success: false,
        errorMessage: err.message,
        syncBatchId: options?.syncBatchId,
      });
    }

    return {
      success: false,
      error: err.message || 'Unknown error',
    };
  }
}

/**
 * Deletes (archives) a Notion page.
 * Verifies the page has no children before deletion.
 *
 * @param change The change object containing the old values
 * @param originalIdsToDatabase Map of UUIDs to database names for original documents
 * @param options Sync options including batch ID for audit logging
 */
export async function deleteNotionPage(
  change: AtlasDocumentChange,
  originalIdsToDatabase: Map<string, AtlasDatabaseName>,
  options?: SyncActionOptions,
): Promise<SyncActionResult> {
  try {
    if (!change.uuid) {
      return { success: false, error: 'Missing page UUID' };
    }

    if (!change.oldValues) {
      return { success: false, error: 'Missing old values for database derivation' };
    }

    // Derive database name for audit logging
    const databaseName = getDatabaseNameFromDocument(change.oldValues.type, change.uuid, originalIdsToDatabase);

    // Check if page has children
    const hasChildren = await pageHasChildren(change.uuid, change.oldValues, originalIdsToDatabase);
    if (hasChildren) {
      return {
        success: false,
        reason: 'has_children',
        error: `Page ${change.uuid} has children and cannot be deleted`,
      };
    }

    // Prepare request payload for audit logging
    const requestPayload = {
      page_id: change.uuid,
      archived: true,
    };

    // Archive the page (soft delete)
    const notionClient = notion();
    const response = await notionClient.pages.update({
      page_id: change.uuid,
      archived: true,
    });

    // Log successful operation to audit log
    await logNotionApiOperation({
      operationType: 'delete',
      notionPageId: change.uuid,
      atlasDocumentUuid: change.oldValues.uuid || null,
      databaseName,
      requestPayload,
      responsePayload: response as Record<string, unknown>,
      success: true,
      syncBatchId: options?.syncBatchId,
    });

    return { success: true, pageId: change.uuid };
  } catch (error) {
    const err = error as Error;
    console.error(`Failed to delete page ${change.uuid}:`, err);

    // Log failed operation to audit log
    if (change.oldValues) {
      const databaseName = getDatabaseNameFromDocument(change.oldValues.type, change.uuid!, originalIdsToDatabase);

      await logNotionApiOperation({
        operationType: 'delete',
        notionPageId: change.uuid || 'unknown',
        atlasDocumentUuid: change.oldValues.uuid || null,
        databaseName,
        requestPayload: { page_id: change.uuid, archived: true },
        success: false,
        errorMessage: err.message,
        syncBatchId: options?.syncBatchId,
      });
    }

    return {
      success: false,
      error: err.message || 'Unknown error',
    };
  }
}

/**
 * Updates the parent relationship for a Notion page.
 * Handles both same-database and cross-database parent changes.
 *
 * @param change The change object containing old and new parent information
 * @param newIdsToDocuments Map of UUIDs to document objects for parent lookup
 * @param newIdsToDatabase Map of UUIDs to database names for new documents
 * @param originalIdsToDatabase Map of UUIDs to database names for original documents
 * @param uuidMappings UUID mappings for converting Atlas UUIDs to Notion page IDs
 * @param options Sync options including batch ID for audit logging
 */
export async function updateNotionPageParent(
  change: AtlasDocumentChange,
  newIdsToDocuments: Map<string, ExportAtlasTreeBaseDocument>,
  newIdsToDatabase: Map<string, AtlasDatabaseName>,
  originalIdsToDatabase: Map<string, AtlasDatabaseName>,
  uuidMappings: UuidMappings,
  options?: SyncActionOptions,
): Promise<SyncActionResult> {
  let databaseName: AtlasDatabaseName | null = null;
  let properties: Record<string, unknown> | null = null;

  try {
    if (!change.uuid) {
      return { success: false, error: 'Missing page UUID' };
    }

    if (!change.newValues || !change.oldValues) {
      return { success: false, error: 'Missing values for parent change' };
    }

    // Derive database name from document type
    databaseName = getDatabaseNameFromDocument(change.newValues.type, change.uuid, newIdsToDatabase);

    // Build properties object for updating relationships
    properties = {};

    // Get new parent Atlas UUID (last element in ancestry array)
    const newParentAtlasUuid =
      change.newAncestry && change.newAncestry.length > 0 ? change.newAncestry[change.newAncestry.length - 1] : null;

    // Convert Atlas UUID to Notion page ID for validation and relationship setting
    let newParentNotionPageId: string | null = null;
    if (newParentAtlasUuid) {
      newParentNotionPageId = uuidMappings.atlasUUIDsToNotionPageIds.get(newParentAtlasUuid) ?? null;
      if (!newParentNotionPageId) {
        return {
          success: false,
          reason: 'parent_not_found',
          error: `No Notion page ID mapping found for parent Atlas UUID ${newParentAtlasUuid}`,
        };
      }
    }

    // Handle same-database parent changes (internal nesting)
    if (databaseSupportsInternalNesting(databaseName) && newParentAtlasUuid && newParentNotionPageId) {
      // Check if new parent is in the same database
      const newParentDatabase = newIdsToDatabase.get(newParentAtlasUuid);

      if (newParentDatabase === databaseName) {
        // Same-database parent change - use Notion page ID for relationship
        const config = NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[databaseName];

        if (config.parentPropertyName) {
          // Update parent relationship property using Notion page ID
          properties[config.parentPropertyName] = {
            relation: [{ id: newParentNotionPageId }],
          };
        }
      }
    }

    // Handle cross-database parent changes
    if (newParentAtlasUuid) {
      const newParentDatabase = newIdsToDatabase.get(newParentAtlasUuid);

      if (newParentDatabase && newParentDatabase !== databaseName) {
        // Cross-database parent change
        // Note: addInterDatabaseRelationshipProperties converts Atlas UUIDs to Notion page IDs internally
        const interDbRelationshipProps = addInterDatabaseRelationshipProperties(
          change.newAncestry,
          databaseName,
          newIdsToDocuments,
          newIdsToDatabase,
          uuidMappings,
        );

        Object.assign(properties, interDbRelationshipProps);
      }
    }

    // If no properties to update, return success (no-op)
    if (Object.keys(properties).length === 0) {
      return { success: true, pageId: change.uuid };
    }

    // Validate new parent exists using the Notion page ID
    if (newParentNotionPageId) {
      const parentExists = await validatePageExists(newParentNotionPageId);
      if (!parentExists) {
        return {
          success: false,
          reason: 'parent_not_found',
          error: `New parent page ${newParentNotionPageId} (Atlas UUID: ${newParentAtlasUuid}) does not exist`,
        };
      }
    }

    // Update the page using Notion API
    const notionClient = notion();
    const response = await notionClient.pages.update({
      page_id: change.uuid,
      properties: properties as Parameters<typeof notionClient.pages.update>[0]['properties'],
    });

    // Log successful operation to audit log
    await logNotionApiOperation({
      operationType: 'update',
      notionPageId: change.uuid,
      atlasDocumentUuid: change.newValues.uuid || null,
      databaseName,
      requestPayload: { page_id: change.uuid, properties },
      responsePayload: response as Record<string, unknown>,
      success: true,
      syncBatchId: options?.syncBatchId,
    });

    return { success: true, pageId: change.uuid };
  } catch (error) {
    const err = error as Error;
    console.error(`Failed to update page parent ${change.uuid}:`, err);

    // Log failed operation to audit log
    if (databaseName && properties) {
      await logNotionApiOperation({
        operationType: 'update',
        notionPageId: change.uuid || 'unknown',
        atlasDocumentUuid: change.newValues?.uuid || null,
        databaseName,
        requestPayload: { page_id: change.uuid, properties },
        success: false,
        errorMessage: err.message,
        syncBatchId: options?.syncBatchId,
      });
    }

    return {
      success: false,
      error: err.message || 'Unknown error',
    };
  }
}

/**
 * Validates that a Notion page exists.
 */
export async function validatePageExists(pageId: string): Promise<boolean> {
  try {
    const notionClient = notion();
    await notionClient.pages.retrieve({ page_id: pageId });
    return true;
  } catch (error) {
    const err = error as Error & { code?: string };
    if (err.code === 'object_not_found') {
      return false;
    }
    // For other errors, log and return false
    console.error(`Error validating page ${pageId}:`, err);
    return false;
  }
}

/**
 * Checks if a page has any children by examining its relationship properties.
 * This includes checking all child relationship properties (Subdocs, Annotations, Tenets, etc.)
 * to prevent orphaned documents when deleting pages.
 *
 * @param pageId The UUID of the page to check
 * @param pageDocument The document object for database derivation
 * @param originalIdsToDatabase Map of UUIDs to database names for original documents
 */
async function pageHasChildren(
  pageId: string,
  pageDocument: ExportAtlasTreeBaseDocument,
  originalIdsToDatabase: Map<string, AtlasDatabaseName>,
): Promise<boolean> {
  try {
    // Derive database name from document type and database tracking map
    const databaseName = getDatabaseNameFromDocument(pageDocument.type, pageId, originalIdsToDatabase);

    // Get all child relationship property names for this database
    // e.g., "Subdocs", "Annotations", "Tenets", "Sub-item", etc.
    const config = NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[databaseName];
    const childRelationshipNames = Object.values(config.childRelationships).filter((name) => name);

    // Also check the sub-items property if it exists
    const propertyNamesToCheck = [...childRelationshipNames];

    // Fetch the page from Notion to check its relationships
    const notionClient = notion();
    const page = await notionClient.pages.retrieve({ page_id: pageId });

    // Check each relationship property - if any have relations, page has children
    const pageProps = (page as { properties: Record<string, unknown> }).properties;
    for (const propertyName of propertyNamesToCheck) {
      const property = pageProps[propertyName] as { type?: string; relation?: unknown[] } | undefined;
      if (property && property.type === 'relation' && property.relation && property.relation.length > 0) {
        return true;
      }
      // TODO: Manually verify that every child relationship property is detected and handled properly across all Notion databases
    }

    return false;
  } catch (error) {
    const err = error as Error;
    console.error(`Error checking children for page ${pageId}:`, err);
    // If we can't determine, assume it has children for safety (prevents accidental deletion)
    return true;
  }
}

/**
 * Server action to run a dry-run sync.
 * This must be a server action because the orchestrator has server-side dependencies.
 * Computes diff and loads UUID mappings on the server to avoid payload size limits.
 *
 * @returns Object with succeeded and skipped counts
 */
export async function runDryRunSync(): Promise<{ succeeded: number; skipped: number; error?: string }> {
  try {
    // Compute diff and load UUID mappings on the server (avoids sending large payloads)
    const [diffResult, uuidMappings] = await Promise.all([diffAtlasScopeTreeLists(), loadUuidMappings()]);

    const result = await syncChangesToNotion(diffResult, { stopRequested: false, dryRun: true }, uuidMappings, () => {
      // No-op progress callback for dry-run
    });

    return {
      succeeded: result.succeeded.length,
      skipped: result.skipped.length,
    };
  } catch (error) {
    const err = error as Error;
    console.error('Dry-run sync failed:', err);
    return {
      succeeded: 0,
      skipped: 0,
      error: err.message,
    };
  }
}

// ============================================================================
// Batch Sync Types and Functions
// ============================================================================

/**
 * Server action to run the real sync (non-dry-run).
 * This must be a server action because the orchestrator has server-side dependencies
 * (Supabase, Notion API, etc.) that require server environment variables.
 *
 * Note: This version does not support real-time progress updates to the client.
 * Progress is logged to the server console instead.
 *
 * @returns Object with sync results including succeeded/failed/skipped counts and logs
 */
export async function runRealSync(): Promise<RealSyncResult> {
  try {
    console.log('[Sync] Starting sync...');

    // Compute diff and load UUID mappings on the server (avoids sending large payloads)
    const [diffResult, uuidMappings] = await Promise.all([diffAtlasScopeTreeLists(), loadUuidMappings()]);

    const totalChanges =
      diffResult.changes.changed.length +
      diffResult.changes.added.length +
      diffResult.changes.deleted.length +
      diffResult.changes.parent_changed.length +
      diffResult.changes.sibling_order_changed.length;

    console.log(`[Sync] ${totalChanges} changes to process`);

    const result = await syncChangesToNotion(
      diffResult,
      { stopRequested: false, dryRun: false },
      uuidMappings,
      (progress) => {
        // Log progress to server console
        const pct = progress.totalCount > 0 ? Math.round((progress.completedCount / progress.totalCount) * 100) : 0;
        const doc = progress.currentDocumentLabel ? ` - ${progress.currentDocumentLabel}` : '';
        console.log(`[Sync] ${progress.phase}: ${progress.completedCount}/${progress.totalCount} (${pct}%)${doc}`);
      },
    );

    console.log(
      `[Sync] Complete: ${result.succeeded.length} succeeded, ${result.failed.length} failed, ${result.skipped.length} skipped`,
    );

    return {
      succeeded: result.succeeded.length,
      failed: result.failed.length,
      skipped: result.skipped.length,
      logs: result.logs.map((log) => ({
        ...log,
        timestamp: log.timestamp.toISOString(),
      })),
      stopRequested: result.stopRequested,
    };
  } catch (error) {
    const err = error as Error;
    console.error('[Sync] Failed:', err);
    return {
      succeeded: 0,
      failed: 0,
      skipped: 0,
      logs: [],
      stopRequested: false,
      error: err.message,
    };
  }
}

/**
 * Server action to run a single batch of sync operations.
 * Called by the client in a loop to process all changes in batches.
 *
 * This enables:
 * - Progress updates between batches (client can update UI)
 * - Stop functionality (client can stop before starting next batch)
 * - Avoiding server action timeout for large syncs
 *
 * @param batchData Serialized batch data containing changes and lookup maps
 * @param batchIndex Current batch index (0-based)
 * @param totalBatches Total number of batches
 * @param syncBatchId Shared batch ID for audit logging (generated by client, used across all batches)
 * @returns Object with sync results for this batch
 */
export async function runSyncBatch(
  batchData: SerializedBatchData,
  batchIndex: number,
  totalBatches: number,
  syncBatchId: string,
): Promise<RealSyncResult> {
  const logs: RealSyncResult['logs'] = [];
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  const addLog = (
    message: string,
    type: 'info' | 'success' | 'error' | 'warning',
    documentId?: string,
    documentLabel?: string,
  ) => {
    logs.push({
      timestamp: new Date().toISOString(),
      message,
      type,
      documentId,
      documentLabel,
    });
  };

  try {
    console.log(`[Sync] Batch ${batchIndex + 1}/${totalBatches}: Processing ${batchData.changes.length} changes`);
    addLog(`Batch ${batchIndex + 1}/${totalBatches}: Processing ${batchData.changes.length} changes`, 'info');

    // Deserialize maps from arrays
    const originalIdsToDatabase = new Map<string, AtlasDatabaseName>(batchData.originalIdsToDatabase);
    const newIdsToDatabase = new Map<string, AtlasDatabaseName>(batchData.newIdsToDatabase);
    const newIdsToDocuments = new Map<string, ExportAtlasTreeBaseDocument>(batchData.newIdsToDocuments);

    // Load UUID mappings server-side (cached after first load)
    const uuidMappings = await loadUuidMappings();

    // Load nesting bug mappings for skipping affected documents
    // Use throwOnMissingUuid: false because some documents may not exist yet when sync starts
    const nestingMappings = await loadNotionNestingFixMappings();
    const nestingBugAffectedUuids = buildNestingBugAffectedUuidsSet(nestingMappings, uuidMappings, {
      throwOnMissingUuid: false,
    });

    const options: SyncActionOptions = { syncBatchId };

    // Process each change in the batch
    for (const change of batchData.changes) {
      const docLabel = getDocumentLabel(change);

      try {
        let result: SyncActionResult;

        switch (change.changeType) {
          case 'changed':
          case 'sibling_order_changed':
            // Content and sibling order changes use the same update function
            result = await updateNotionPageContent(change, originalIdsToDatabase, uuidMappings, options);
            break;

          case 'added':
            result = await createNotionDatabasePage(change, newIdsToDocuments, newIdsToDatabase, uuidMappings, options);
            break;

          case 'deleted':
            result = await deleteNotionPage(change, originalIdsToDatabase, options);
            break;

          case 'parent_changed':
            // Skip documents affected by nesting bug to preserve manual corrections
            if (change.uuid && nestingBugAffectedUuids.has(change.uuid)) {
              addLog(`⊘ Skipped (nesting bug affected): ${docLabel}`, 'warning', change.uuid, docLabel);
              skipped++;
              continue;
            }
            result = await updateNotionPageParent(
              change,
              newIdsToDocuments,
              newIdsToDatabase,
              originalIdsToDatabase,
              uuidMappings,
              options,
            );
            break;

          default:
            addLog(`⚠ Unknown change type: ${change.changeType}`, 'warning', change.uuid, docLabel);
            skipped++;
            continue;
        }

        // Process result
        if (result.success) {
          succeeded++;
          addLog(`✓ ${change.changeType}: ${docLabel}`, 'success', change.uuid, docLabel);
        } else if (result.reason === 'parent_not_found' || result.reason === 'has_children') {
          skipped++;
          addLog(`⊘ Skipped (${result.reason}): ${docLabel}`, 'warning', change.uuid, docLabel);
        } else {
          // Stop on first error
          failed++;
          addLog(`✗ Failed ${change.changeType}: ${docLabel} - ${result.error}`, 'error', change.uuid, docLabel);
          console.log(
            `[Sync] Batch ${batchIndex + 1}/${totalBatches}: Stopping on error - ${succeeded} succeeded, ${failed} failed, ${skipped} skipped`,
          );
          return {
            succeeded,
            failed,
            skipped,
            logs,
            stopRequested: false,
            error: result.error,
          };
        }
      } catch (error) {
        // Stop on first exception
        const err = error as Error;
        failed++;
        addLog(`✗ Error ${change.changeType}: ${docLabel} - ${err.message}`, 'error', change.uuid, docLabel);
        console.log(
          `[Sync] Batch ${batchIndex + 1}/${totalBatches}: Stopping on exception - ${succeeded} succeeded, ${failed} failed, ${skipped} skipped`,
        );
        return {
          succeeded,
          failed,
          skipped,
          logs,
          stopRequested: false,
          error: err.message,
        };
      }
    }

    console.log(
      `[Sync] Batch ${batchIndex + 1}/${totalBatches}: ${succeeded} succeeded, ${failed} failed, ${skipped} skipped`,
    );
    addLog(`Batch complete: ${succeeded} succeeded, ${failed} failed, ${skipped} skipped`, 'info');

    return {
      succeeded,
      failed,
      skipped,
      logs,
      stopRequested: false,
    };
  } catch (error) {
    const err = error as Error;
    console.error(`[Sync] Batch ${batchIndex + 1}/${totalBatches} failed:`, err);
    return {
      succeeded,
      failed,
      skipped,
      logs: [...logs, { timestamp: new Date().toISOString(), message: `Batch failed: ${err.message}`, type: 'error' }],
      stopRequested: false,
      error: err.message,
    };
  }
}

/**
 * Gets a human-readable label for a document change.
 */
function getDocumentLabel(change: AtlasDocumentChange): string {
  const doc = change.newValues || change.oldValues;
  if (!doc) return 'Unknown document';
  return `${doc.doc_no} - ${doc.name} [${doc.type}]`;
}
