'use server';

import { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import { AtlasDocumentChange } from '@/app/server/atlas/diff/atlas-diff';
import { ExportAtlasTreeBaseDocument } from '@/app/server/atlas/export/types';
import { UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import { NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS } from '@/app/server/atlas/notion-mapping/notion-database-properties-and-relationships';
import { notion } from '@/app/server/services/notion/notion-client';
import { logNotionApiOperation } from '@/app/server/services/supabase/audit-log-service';
import { storeUuidMapping } from '@/app/server/services/supabase/uuid-mapping-service';
import {
  databaseSupportsInternalNesting,
  getDatabaseNameFromDocument,
  getInternalParentPageIdFromAncestry,
  getNotionDatabaseIdForDatabaseName,
} from '../_lib/atlas-database-mapper';
import {
  addInterDatabaseRelationshipProperties,
  addParentPageRelationshipProperty,
  buildNotionProperties,
} from '../_lib/notion-property-builder';

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
    const notionClient = notion('write');
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
 * @param uuidMappings UUID mappings for converting Atlas UUIDs to Notion page links in markdown
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

    // Get internal parent page ID (only if parent is in the same database)
    // Returns null for cross-database parents or when no parent exists - both are valid scenarios
    const parentPageId = getInternalParentPageIdFromAncestry(change.newAncestry, databaseName, newIdsToDatabase);

    // Validate relationship parent exists ONLY if one is specified and it's in the same database
    // Skip validation when parentPageId is null (root-level or cross-database) - both are valid
    if (parentPageId) {
      const parentExists = await validatePageExists(parentPageId);
      if (!parentExists) {
        return {
          success: false,
          reason: 'parent_not_found',
          error: `Relationship parent page ${parentPageId} does not exist`,
        };
      }
    }

    // Build Notion properties from Atlas document data (converts markdown to rich text)
    const properties = buildNotionProperties(doc, databaseName, uuidMappings);

    // Add relationship properties for internally nested databases
    // This sets the "Parent Doc" or "Parent item" property to establish internal hierarchy
    if (databaseSupportsInternalNesting(databaseName) && parentPageId) {
      const relationshipProps = addParentPageRelationshipProperty(parentPageId, databaseName);
      Object.assign(properties, relationshipProps);
    }

    // Add relationship properties for inter-database relationships
    // This sets relationships when parent is in a different database (e.g., Article → Section)
    const interDbRelationshipProps = addInterDatabaseRelationshipProperties(
      change.newAncestry,
      databaseName,
      newIdsToDocuments,
      newIdsToDatabase,
    );

    // Validate inter-database parent exists (if one was found)
    // Extract parent ID from the relationship properties to validate
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
    for (const interDbParentId of interDbParentIds) {
      const parentExists = await validatePageExists(interDbParentId);
      if (!parentExists) {
        return {
          success: false,
          reason: 'parent_not_found',
          error: `Inter-database parent page ${interDbParentId} does not exist`,
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
    const notionClient = notion('write');
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
    const notionClient = notion('write');
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
 * @param options Sync options including batch ID for audit logging
 */
export async function updateNotionPageParent(
  change: AtlasDocumentChange,
  newIdsToDocuments: Map<string, ExportAtlasTreeBaseDocument>,
  newIdsToDatabase: Map<string, AtlasDatabaseName>,
  originalIdsToDatabase: Map<string, AtlasDatabaseName>,
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

    // Get new parent information
    const newParentId =
      change.newAncestry && change.newAncestry.length > 0 ? change.newAncestry[change.newAncestry.length - 1] : null;

    // Handle same-database parent changes (internal nesting)
    if (databaseSupportsInternalNesting(databaseName) && newParentId) {
      // Check if new parent is in the same database
      const newParentDatabase = newIdsToDatabase.get(newParentId);

      if (newParentDatabase === databaseName) {
        // Same-database parent change
        const config = NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[databaseName];

        if (config.parentPropertyName) {
          // Update parent relationship property
          properties[config.parentPropertyName] = {
            relation: [{ id: newParentId }],
          };
        }
      }
    }

    // Handle cross-database parent changes
    if (newParentId) {
      const newParentDatabase = newIdsToDatabase.get(newParentId);

      if (newParentDatabase && newParentDatabase !== databaseName) {
        // Cross-database parent change
        const interDbRelationshipProps = addInterDatabaseRelationshipProperties(
          change.newAncestry,
          databaseName,
          newIdsToDocuments,
          newIdsToDatabase,
        );

        Object.assign(properties, interDbRelationshipProps);
      }
    }

    // If no properties to update, return success (no-op)
    if (Object.keys(properties).length === 0) {
      return { success: true, pageId: change.uuid };
    }

    // Validate new parent exists
    if (newParentId) {
      const parentExists = await validatePageExists(newParentId);
      if (!parentExists) {
        return {
          success: false,
          reason: 'parent_not_found',
          error: `New parent page ${newParentId} does not exist`,
        };
      }
    }

    // Update the page using Notion API
    const notionClient = notion('write');
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
    const notionClient = notion('write');
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
    const notionClient = notion('write');
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
