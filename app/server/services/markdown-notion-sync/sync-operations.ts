/**
 * Core CRUD operations for Markdown-to-Notion sync
 */
import {
  databaseSupportsInternalNesting,
  getDatabaseNameFromDocument,
  getInternalParentPageIdFromAncestry,
  getNotionDatabaseIdForDatabaseName,
} from '@/app/atlas/sync/_lib/atlas-database-mapper';
import {
  ContentConversionWarning,
  addInterDatabaseRelationshipProperties,
  addParentPageRelationshipProperty,
  buildNotionProperties,
} from '@/app/atlas/sync/_lib/notion-property-builder';
import { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import { AtlasDocumentChange } from '@/app/server/atlas/diff/atlas-diff';
import { ExportAtlasTreeBaseDocument } from '@/app/server/atlas/export/types';
import { UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import { NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS } from '@/app/server/atlas/notion-mapping/notion-database-properties-and-relationships';
import { notion } from '@/app/server/services/notion/notion-client';
import { logNotionApiOperation } from '@/app/server/services/supabase/audit-log-service';
import { storeUuidMapping } from '@/app/server/services/supabase/uuid-mapping-service';
import { pageHasChildren, validatePageExists } from './sync-helpers';
import { SyncActionResult } from './types';

/**
 * Updates the content of an existing Notion page.
 *
 * @param change Atlas document change with old and new values
 * @param originalIdsToDatabase Map of UUID to database name (for old values)
 * @param uuidMappings Bidirectional UUID mappings
 * @param syncBatchId Sync batch ID for audit logging
 * @returns Result with success status
 */
export async function updateNotionPageContent(
  change: AtlasDocumentChange,
  originalIdsToDatabase: Map<string, AtlasDatabaseName>,
  uuidMappings: UuidMappings,
  syncBatchId: string,
): Promise<SyncActionResult> {
  if (!change.uuid || !change.newValues || !change.oldValues) {
    return { success: false, error: 'Missing required data' };
  }

  const notionPageId = uuidMappings.atlasUUIDsToNotionPageIds.get(change.uuid);
  if (!notionPageId) {
    return { success: false, reason: 'mapping_not_found', error: 'No Notion page ID mapping found' };
  }

  const databaseName = getDatabaseNameFromDocument(change.oldValues.type, change.uuid, originalIdsToDatabase);
  const warnings: ContentConversionWarning[] = [];
  const properties = buildNotionProperties(change.newValues, databaseName, uuidMappings, warnings);

  try {
    const notionClient = notion();
    const response = await notionClient.pages.update({
      page_id: notionPageId,
      properties: properties as Parameters<typeof notionClient.pages.update>[0]['properties'],
    });

    await logNotionApiOperation({
      operationType: 'update',
      notionPageId,
      atlasDocumentUuid: change.uuid,
      databaseName,
      requestPayload: { page_id: notionPageId, properties },
      responsePayload: response as Record<string, unknown>,
      success: true,
      syncBatchId,
    });

    return { success: true, pageId: notionPageId };
  } catch (error) {
    const err = error as Error;
    await logNotionApiOperation({
      operationType: 'update',
      notionPageId,
      atlasDocumentUuid: change.uuid,
      databaseName,
      requestPayload: { page_id: notionPageId, properties },
      success: false,
      errorMessage: err.message,
      syncBatchId,
    });
    return { success: false, error: err.message };
  }
}

/**
 * Creates a new Notion database page with relationships.
 *
 * @param change Atlas document change with new values
 * @param newIdsToDocuments Map of UUID to document (for new values)
 * @param newIdsToDatabase Map of UUID to database name (for new values)
 * @param uuidMappings Bidirectional UUID mappings
 * @param syncBatchId Sync batch ID for audit logging
 * @param createdPagesInSync Set of page IDs created in this sync (for validation)
 * @param parentValidationCache Cache for parent validation results
 * @returns Result with success status and new page ID
 */
export async function createNotionDatabasePage(
  change: AtlasDocumentChange,
  newIdsToDocuments: Map<string, ExportAtlasTreeBaseDocument>,
  newIdsToDatabase: Map<string, AtlasDatabaseName>,
  uuidMappings: UuidMappings,
  syncBatchId: string,
  createdPagesInSync: Set<string>,
  parentValidationCache: Map<string, boolean>,
): Promise<SyncActionResult> {
  if (!change.newValues?.uuid) {
    return { success: false, error: 'Missing document UUID' };
  }

  const doc = change.newValues;
  const databaseName = getDatabaseNameFromDocument(doc.type, doc.uuid!, newIdsToDatabase);
  const databaseId = getNotionDatabaseIdForDatabaseName(databaseName);

  // Get internal parent info
  let internalParentInfo;
  try {
    internalParentInfo = getInternalParentPageIdFromAncestry(
      change.newAncestry,
      databaseName,
      newIdsToDatabase,
      uuidMappings,
    );
  } catch (error) {
    return { success: false, reason: 'parent_lookup_error', error: (error as Error).message };
  }

  // Validate internal parent exists
  if (internalParentInfo) {
    const createdInSync = createdPagesInSync.has(internalParentInfo.notionPageId);
    if (!createdInSync) {
      const parentExists = await validatePageExists(internalParentInfo.notionPageId, parentValidationCache);
      if (!parentExists) {
        return { success: false, reason: 'parent_not_found', error: 'Parent page does not exist' };
      }
    }
  }

  const warnings: ContentConversionWarning[] = [];
  const properties = buildNotionProperties(doc, databaseName, uuidMappings, warnings);

  // Add internal parent relationship
  if (databaseSupportsInternalNesting(databaseName) && internalParentInfo) {
    Object.assign(properties, addParentPageRelationshipProperty(internalParentInfo.notionPageId, databaseName));
  }

  // Add inter-database relationships
  let interDbRelationshipProps: Record<string, unknown>;
  try {
    interDbRelationshipProps = addInterDatabaseRelationshipProperties(
      change.newAncestry,
      databaseName,
      newIdsToDocuments,
      newIdsToDatabase,
      uuidMappings,
    );
  } catch (error) {
    return { success: false, reason: 'relationship_error', error: (error as Error).message };
  }

  // Validate inter-database parents
  for (const propValue of Object.values(interDbRelationshipProps)) {
    const relationProp = propValue as { relation?: Array<{ id: string }> };
    if (relationProp.relation) {
      for (const rel of relationProp.relation) {
        if (!createdPagesInSync.has(rel.id)) {
          const exists = await validatePageExists(rel.id, parentValidationCache);
          if (!exists) {
            return { success: false, reason: 'parent_not_found', error: 'Inter-database parent does not exist' };
          }
        }
      }
    }
  }

  Object.assign(properties, interDbRelationshipProps);

  try {
    const notionClient = notion();
    const createdPage = await notionClient.pages.create({
      parent: { type: 'database_id', database_id: databaseId },
      properties: properties as Parameters<typeof notionClient.pages.create>[0]['properties'],
    });

    // Store UUID mapping
    if (doc.uuid) {
      await storeUuidMapping(createdPage.id, doc.uuid);
      uuidMappings.atlasUUIDsToNotionPageIds.set(doc.uuid, createdPage.id);
      uuidMappings.notionPageIDsToAtlasUUIDs.set(createdPage.id, doc.uuid);
    }

    await logNotionApiOperation({
      operationType: 'create',
      notionPageId: createdPage.id,
      atlasDocumentUuid: doc.uuid,
      databaseName,
      requestPayload: { parent: { type: 'database_id', database_id: databaseId }, properties },
      responsePayload: createdPage as Record<string, unknown>,
      success: true,
      syncBatchId,
    });

    // Extract unresolved mention UUIDs from warnings for post-processing
    const unresolvedMentionUuids = warnings
      .filter((w) => w.type === 'missing_mapping' && w.atlasUuid)
      .map((w) => w.atlasUuid!);

    return {
      success: true,
      pageId: createdPage.id,
      unresolvedMentionUuids: unresolvedMentionUuids.length > 0 ? unresolvedMentionUuids : undefined,
    };
  } catch (error) {
    const err = error as Error;
    await logNotionApiOperation({
      operationType: 'create',
      notionPageId: 'failed-to-create',
      atlasDocumentUuid: doc.uuid,
      databaseName,
      requestPayload: { parent: { type: 'database_id', database_id: databaseId }, properties },
      success: false,
      errorMessage: err.message,
      syncBatchId,
    });
    return { success: false, error: err.message };
  }
}

/**
 * Deletes (archives) a Notion page.
 * Validates that the page has no children before deletion.
 *
 * @param change Atlas document change with old values
 * @param originalIdsToDatabase Map of UUID to database name (for old values)
 * @param uuidMappings Bidirectional UUID mappings
 * @param syncBatchId Sync batch ID for audit logging
 * @returns Result with success status
 */
export async function deleteNotionPage(
  change: AtlasDocumentChange,
  originalIdsToDatabase: Map<string, AtlasDatabaseName>,
  uuidMappings: UuidMappings,
  syncBatchId: string,
): Promise<SyncActionResult> {
  if (!change.uuid || !change.oldValues) {
    return { success: false, error: 'Missing required data' };
  }

  const notionPageId = uuidMappings.atlasUUIDsToNotionPageIds.get(change.uuid);
  if (!notionPageId) {
    return { success: false, reason: 'mapping_not_found', error: 'No Notion page ID mapping found' };
  }

  const databaseName = getDatabaseNameFromDocument(change.oldValues.type, change.uuid, originalIdsToDatabase);

  // Check for children
  const hasChildren = await pageHasChildren(notionPageId, change.oldValues, originalIdsToDatabase);
  if (hasChildren) {
    return { success: false, reason: 'has_children', error: 'Page has children' };
  }

  try {
    const notionClient = notion();
    const response = await notionClient.pages.update({
      page_id: notionPageId,
      archived: true,
    });

    await logNotionApiOperation({
      operationType: 'delete',
      notionPageId,
      atlasDocumentUuid: change.uuid,
      databaseName,
      requestPayload: { page_id: notionPageId, archived: true },
      responsePayload: response as Record<string, unknown>,
      success: true,
      syncBatchId,
    });

    return { success: true, pageId: notionPageId };
  } catch (error) {
    const err = error as Error;
    await logNotionApiOperation({
      operationType: 'delete',
      notionPageId,
      atlasDocumentUuid: change.uuid,
      databaseName,
      requestPayload: { page_id: notionPageId, archived: true },
      success: false,
      errorMessage: err.message,
      syncBatchId,
    });
    return { success: false, error: err.message };
  }
}

/**
 * Updates the parent relationships of a Notion page.
 * Handles both same-database and cross-database parent changes.
 *
 * @param change Atlas document change with old and new values
 * @param newIdsToDocuments Map of UUID to document (for new values)
 * @param newIdsToDatabase Map of UUID to database name (for new values)
 * @param originalIdsToDatabase Map of UUID to database name (for old values)
 * @param uuidMappings Bidirectional UUID mappings
 * @param syncBatchId Sync batch ID for audit logging
 * @param parentValidationCache Cache for parent validation results
 * @returns Result with success status
 */
export async function updateNotionPageParent(
  change: AtlasDocumentChange,
  newIdsToDocuments: Map<string, ExportAtlasTreeBaseDocument>,
  newIdsToDatabase: Map<string, AtlasDatabaseName>,
  originalIdsToDatabase: Map<string, AtlasDatabaseName>,
  uuidMappings: UuidMappings,
  syncBatchId: string,
  parentValidationCache: Map<string, boolean>,
): Promise<SyncActionResult> {
  if (!change.uuid || !change.newValues || !change.oldValues) {
    return { success: false, error: 'Missing required data' };
  }

  const notionPageId = uuidMappings.atlasUUIDsToNotionPageIds.get(change.uuid);
  if (!notionPageId) {
    return { success: false, reason: 'mapping_not_found', error: 'No Notion page ID mapping found' };
  }

  const databaseName = getDatabaseNameFromDocument(change.newValues.type, change.uuid, newIdsToDatabase);
  const properties: Record<string, unknown> = {};

  const newParentAtlasUuid =
    change.newAncestry && change.newAncestry.length > 0 ? change.newAncestry[change.newAncestry.length - 1] : null;
  const oldParentAtlasUuid =
    change.oldAncestry && change.oldAncestry.length > 0 ? change.oldAncestry[change.oldAncestry.length - 1] : null;

  let newParentNotionPageId: string | null = null;
  if (newParentAtlasUuid) {
    newParentNotionPageId = uuidMappings.atlasUUIDsToNotionPageIds.get(newParentAtlasUuid) ?? null;
    if (!newParentNotionPageId) {
      return { success: false, reason: 'parent_not_found', error: 'No mapping for parent' };
    }
  }

  // Handle same-database parent changes
  if (databaseSupportsInternalNesting(databaseName)) {
    // Check if there's a same-database parent in either old or new ancestry
    const oldParentDatabase = oldParentAtlasUuid ? newIdsToDatabase.get(oldParentAtlasUuid) : null;
    const newParentDatabase = newParentAtlasUuid ? newIdsToDatabase.get(newParentAtlasUuid) : null;
    const oldParentSameDatabase = oldParentDatabase === databaseName;
    const newParentSameDatabase = newParentDatabase === databaseName;

    // If there was a same-database parent or there is a new same-database parent, update the relationship
    if (oldParentSameDatabase || newParentSameDatabase) {
      const config = NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[databaseName];
      if (config.parentPropertyName) {
        if (newParentSameDatabase && newParentNotionPageId) {
          // Set new parent
          properties[config.parentPropertyName] = { relation: [{ id: newParentNotionPageId }] };
        } else {
          // Clear parent (moving to root or cross-database parent)
          properties[config.parentPropertyName] = { relation: [] };
        }
      }
    }
  }

  // Handle cross-database parent changes
  if (newParentAtlasUuid) {
    const newParentDatabase = newIdsToDatabase.get(newParentAtlasUuid);
    if (newParentDatabase && newParentDatabase !== databaseName) {
      try {
        const interDbProps = addInterDatabaseRelationshipProperties(
          change.newAncestry,
          databaseName,
          newIdsToDocuments,
          newIdsToDatabase,
          uuidMappings,
        );
        Object.assign(properties, interDbProps);
      } catch (error) {
        return { success: false, reason: 'relationship_error', error: (error as Error).message };
      }
    }
  }

  if (Object.keys(properties).length === 0) {
    return { success: true, pageId: notionPageId };
  }

  // Validate parent exists
  if (newParentNotionPageId) {
    const parentExists = await validatePageExists(newParentNotionPageId, parentValidationCache);
    if (!parentExists) {
      return { success: false, reason: 'parent_not_found', error: 'New parent does not exist' };
    }
  }

  try {
    const notionClient = notion();
    const response = await notionClient.pages.update({
      page_id: notionPageId,
      properties: properties as Parameters<typeof notionClient.pages.update>[0]['properties'],
    });

    await logNotionApiOperation({
      operationType: 'update',
      notionPageId,
      atlasDocumentUuid: change.uuid,
      databaseName,
      requestPayload: { page_id: notionPageId, properties },
      responsePayload: response as Record<string, unknown>,
      success: true,
      syncBatchId,
    });

    return { success: true, pageId: notionPageId };
  } catch (error) {
    const err = error as Error;
    await logNotionApiOperation({
      operationType: 'update',
      notionPageId,
      atlasDocumentUuid: change.uuid,
      databaseName,
      requestPayload: { page_id: notionPageId, properties },
      success: false,
      errorMessage: err.message,
      syncBatchId,
    });
    return { success: false, error: err.message };
  }
}

/**
 * Updates the content of a Notion page to fix placeholder mentions.
 * This is called in the mention post-processing phase after all new pages are created.
 *
 * @param notionPageId The Notion page ID to update
 * @param document The document data (used to rebuild content with proper mentions)
 * @param databaseName The database name for property mapping
 * @param uuidMappings Updated UUID mappings (now includes newly created pages)
 * @param syncBatchId Sync batch ID for audit logging
 * @returns Result with success status
 */
export async function updatePageMentions(
  notionPageId: string,
  document: ExportAtlasTreeBaseDocument,
  databaseName: AtlasDatabaseName,
  uuidMappings: UuidMappings,
  syncBatchId: string,
): Promise<SyncActionResult> {
  const warnings: ContentConversionWarning[] = [];

  // Log the UUID mappings available for this update
  console.log(
    `[updatePageMentions] Updating ${document.doc_no} (${document.uuid}) - UUID mappings available: ${uuidMappings.atlasUUIDsToNotionPageIds.size}`,
  );

  // Rebuild properties with the now-complete UUID mappings
  // This will convert placeholder mentions to proper Notion mentions
  const properties = buildNotionProperties(document, databaseName, uuidMappings, warnings);

  // Check if there are still unresolved mentions (shouldn't happen if all pages were created)
  const stillUnresolved = warnings.filter((w) => w.type === 'missing_mapping');
  if (stillUnresolved.length > 0) {
    console.warn(
      `[updatePageMentions] Still have ${stillUnresolved.length} unresolved mentions after post-processing:`,
      stillUnresolved.map((w) => w.atlasUuid),
    );
  } else {
    console.log(`[updatePageMentions] All mentions resolved for ${document.doc_no}`);
  }

  // Debug: Log the mention page IDs in the Content property
  const contentProp = properties['Content'] as { rich_text?: unknown[] } | undefined;
  if (contentProp?.rich_text) {
    const mentions = contentProp.rich_text.filter((item: unknown) => {
      const typedItem = item as { type?: string };
      return typedItem.type === 'mention';
    });
    if (mentions.length > 0) {
      console.log(
        `[updatePageMentions] Content has ${mentions.length} mention(s) with page IDs:`,
        mentions.map((m: unknown) => {
          const typedM = m as { mention?: { page?: { id?: string } } };
          return typedM.mention?.page?.id;
        }),
      );
    }
  }

  try {
    const notionClient = notion();
    const response = await notionClient.pages.update({
      page_id: notionPageId,
      properties: properties as Parameters<typeof notionClient.pages.update>[0]['properties'],
    });

    await logNotionApiOperation({
      operationType: 'update',
      notionPageId,
      atlasDocumentUuid: document.uuid,
      databaseName,
      requestPayload: { page_id: notionPageId, properties, _phase: 'mention_post_processing' },
      responsePayload: response as Record<string, unknown>,
      success: true,
      syncBatchId,
    });

    return { success: true, pageId: notionPageId };
  } catch (error) {
    const err = error as Error;
    await logNotionApiOperation({
      operationType: 'update',
      notionPageId,
      atlasDocumentUuid: document.uuid,
      databaseName,
      requestPayload: { page_id: notionPageId, properties, _phase: 'mention_post_processing' },
      success: false,
      errorMessage: err.message,
      syncBatchId,
    });
    return { success: false, error: err.message };
  }
}
