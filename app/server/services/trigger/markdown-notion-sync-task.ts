import { metadata, task } from '@trigger.dev/sdk/v3';
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
import { AtlasDocumentChange, GroupedAtlasChanges } from '@/app/server/atlas/diff/atlas-diff';
import { diffAtlasScopeTreeLists } from '@/app/server/atlas/diff/markdown-supabase-diff';
import { compareDocNumbers } from '@/app/server/atlas/document-numbering/atlas-utils';
import { ExportAtlasTreeBaseDocument } from '@/app/server/atlas/export/types';
import { UuidMappings, loadUuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import { NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS } from '@/app/server/atlas/notion-mapping/notion-database-properties-and-relationships';
import { notion } from '@/app/server/services/notion/notion-client';
import { createSyncBatch, logNotionApiOperation } from '@/app/server/services/supabase/audit-log-service';
import {
  acquireSyncLock,
  isStopRequested,
  releaseSyncLock,
} from '@/app/server/services/supabase/markdown-notion-sync-lock';
import {
  buildNestingBugAffectedUuidsSet,
  loadNotionNestingFixMappings,
} from '@/app/server/services/supabase/notion-nesting-bug-mappings';
import { storeUuidMapping } from '@/app/server/services/supabase/uuid-mapping-service';

// Sync phase type for progress tracking
type SyncPhase = 'initializing' | 'content' | 'additions' | 'deletions' | 'parent_changes' | 'completed' | 'stopped';

// Metadata structure for real-time progress tracking
interface SyncMetadata {
  phase: SyncPhase;
  completed: number;
  total: number;
  currentDoc: string | null;
  succeeded: number;
  failed: number;
  skipped: number;
}

// Sync filters for controlling which change types are processed
export interface SyncFilters {
  added: boolean;
  deleted: boolean;
  contentChanges: boolean;
  parentChanges: boolean;
}

// Task payload
export interface MarkdownNotionSyncPayload {
  filters: SyncFilters;
}

// Task result
export interface MarkdownNotionSyncResult {
  succeeded: number;
  failed: number;
  skipped: number;
  stoppedEarly: boolean;
  error?: string;
}

const updateMetadata = (data: Partial<SyncMetadata>) => {
  const current = (metadata.get('sync') as unknown as SyncMetadata) || {
    phase: 'initializing',
    completed: 0,
    total: 0,
    currentDoc: null,
    succeeded: 0,
    failed: 0,
    skipped: 0,
  };
  metadata.set('sync', { ...current, ...data });
};

export const markdownNotionSyncTask = task({
  id: 'markdown-notion-sync',
  maxDuration: 6 * 60 * 60, // 6 hours max
  retry: {
    maxAttempts: 1, // No automatic retries - sync should be manually triggered
  },
  machine: 'small-1x',
  run: async (payload: MarkdownNotionSyncPayload, { ctx }) => {
    const runId = ctx.run.id;
    let lockAcquired = false;

    try {
      // Initialize metadata
      updateMetadata({ phase: 'initializing', completed: 0, total: 0, currentDoc: 'Acquiring lock...' });

      // Acquire sync lock
      lockAcquired = await acquireSyncLock(runId);
      if (!lockAcquired) {
        throw new Error('Another sync is already in progress. Please wait for it to complete.');
      }

      console.log(`[Markdown-Notion Sync] Lock acquired, starting sync...`);
      updateMetadata({ currentDoc: 'Loading data...' });

      // Load diff result and UUID mappings
      const [diffResult, uuidMappings] = await Promise.all([diffAtlasScopeTreeLists(), loadUuidMappings()]);

      // Load nesting bug mappings
      const nestingMappings = await loadNotionNestingFixMappings();
      const nestingBugAffectedUuids = buildNestingBugAffectedUuidsSet(nestingMappings, uuidMappings, {
        throwOnMissingUuid: false,
      });

      // Apply filters
      const filteredChanges: GroupedAtlasChanges = {
        added: payload.filters.added ? diffResult.changes.added : [],
        deleted: payload.filters.deleted ? diffResult.changes.deleted : [],
        changed: payload.filters.contentChanges ? diffResult.changes.changed : [],
        parent_changed: payload.filters.parentChanges ? diffResult.changes.parent_changed : [],
      };

      // Sort additions in depth-first order
      const sortedAdditions = sortAdditionsByDepthFirst(filteredChanges.added);

      // Calculate total
      const total =
        filteredChanges.changed.length +
        sortedAdditions.length +
        filteredChanges.deleted.length +
        filteredChanges.parent_changed.length;

      if (total === 0) {
        updateMetadata({ phase: 'completed', total: 0, completed: 0, currentDoc: null });
        return { succeeded: 0, failed: 0, skipped: 0, stoppedEarly: false };
      }

      // Create sync batch ID for audit logging
      const syncBatchId = createSyncBatch();
      console.log(`[Markdown-Notion Sync] Processing ${total} changes (batch: ${syncBatchId})`);

      updateMetadata({ total, currentDoc: 'Starting sync...' });

      let succeeded = 0;
      let failed = 0;
      let skipped = 0;
      let completed = 0;

      // Track pages created in this sync for parent validation
      const createdPagesInSync = new Set<string>();
      const parentValidationCache = new Map<string, boolean>();

      // Helper to check stop and update progress
      const checkStopAndProgress = async (phase: SyncPhase, docLabel: string): Promise<boolean> => {
        const stopRequested = await isStopRequested();
        if (stopRequested) {
          updateMetadata({ phase: 'stopped', currentDoc: 'Stop requested, finishing...' });
          return true;
        }
        updateMetadata({ phase, completed, currentDoc: docLabel, succeeded, failed, skipped });
        return false;
      };

      // Phase 1: Content changes
      if (filteredChanges.changed.length > 0) {
        updateMetadata({ phase: 'content' });
        for (const change of filteredChanges.changed) {
          const docLabel = getDocumentLabel(change);
          if (await checkStopAndProgress('content', docLabel)) {
            return { succeeded, failed, skipped, stoppedEarly: true };
          }

          try {
            const result = await updateNotionPageContent(
              change,
              diffResult.originalIdsToDatabase,
              uuidMappings,
              syncBatchId,
            );
            completed++;
            if (result.success) {
              succeeded++;
            } else if (result.reason) {
              skipped++;
            } else {
              failed++;
            }
          } catch (error) {
            completed++;
            failed++;
            console.error(`[Sync] Error updating ${docLabel}:`, error);
          }
        }
      }

      // Phase 2: Additions
      if (sortedAdditions.length > 0) {
        updateMetadata({ phase: 'additions' });
        for (const change of sortedAdditions) {
          const docLabel = getDocumentLabel(change);
          if (await checkStopAndProgress('additions', docLabel)) {
            return { succeeded, failed, skipped, stoppedEarly: true };
          }

          try {
            const result = await createNotionDatabasePage(
              change,
              diffResult.newIdsToDocuments,
              diffResult.newIdsToDatabase,
              uuidMappings,
              syncBatchId,
              createdPagesInSync,
              parentValidationCache,
            );
            completed++;
            if (result.success) {
              succeeded++;
              if (result.pageId) {
                createdPagesInSync.add(result.pageId);
              }
            } else if (result.reason) {
              skipped++;
            } else {
              failed++;
            }
          } catch (error) {
            completed++;
            failed++;
            console.error(`[Sync] Error creating ${docLabel}:`, error);
          }
        }
      }

      // Phase 3: Deletions
      if (filteredChanges.deleted.length > 0) {
        updateMetadata({ phase: 'deletions' });
        for (const change of filteredChanges.deleted) {
          const docLabel = getDocumentLabel(change);
          if (await checkStopAndProgress('deletions', docLabel)) {
            return { succeeded, failed, skipped, stoppedEarly: true };
          }

          try {
            const result = await deleteNotionPage(change, diffResult.originalIdsToDatabase, uuidMappings, syncBatchId);
            completed++;
            if (result.success) {
              succeeded++;
            } else if (result.reason) {
              skipped++;
            } else {
              failed++;
            }
          } catch (error) {
            completed++;
            failed++;
            console.error(`[Sync] Error deleting ${docLabel}:`, error);
          }
        }
      }

      // Phase 4: Parent changes
      if (filteredChanges.parent_changed.length > 0) {
        updateMetadata({ phase: 'parent_changes' });
        for (const change of filteredChanges.parent_changed) {
          const docLabel = getDocumentLabel(change);
          if (await checkStopAndProgress('parent_changes', docLabel)) {
            return { succeeded, failed, skipped, stoppedEarly: true };
          }

          // Skip documents affected by nesting bug
          if (change.uuid && nestingBugAffectedUuids.has(change.uuid)) {
            completed++;
            skipped++;
            console.log(`[Sync] Skipped (nesting bug): ${docLabel}`);
            continue;
          }

          try {
            const result = await updateNotionPageParent(
              change,
              diffResult.newIdsToDocuments,
              diffResult.newIdsToDatabase,
              diffResult.originalIdsToDatabase,
              uuidMappings,
              syncBatchId,
              parentValidationCache,
            );
            completed++;
            if (result.success) {
              succeeded++;
            } else if (result.reason) {
              skipped++;
            } else {
              failed++;
            }
          } catch (error) {
            completed++;
            failed++;
            console.error(`[Sync] Error updating parent ${docLabel}:`, error);
          }
        }
      }

      updateMetadata({ phase: 'completed', completed, currentDoc: null, succeeded, failed, skipped });
      console.log(`[Markdown-Notion Sync] Complete: ${succeeded} succeeded, ${failed} failed, ${skipped} skipped`);

      return { succeeded, failed, skipped, stoppedEarly: false };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Markdown-Notion Sync] Failed:`, error);
      updateMetadata({ phase: 'stopped', currentDoc: `Error: ${errorMessage}` });
      throw error;
    } finally {
      // Always release lock
      if (lockAcquired) {
        await releaseSyncLock(runId);
        console.log(`[Markdown-Notion Sync] Lock released`);
      }
    }
  },
});

// ============================================================================
// Sync Operations (moved from sync-actions.ts, simplified)
// ============================================================================

interface SyncActionResult {
  success: boolean;
  pageId?: string;
  error?: string;
  reason?: string;
}

async function updateNotionPageContent(
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

async function createNotionDatabasePage(
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

    return { success: true, pageId: createdPage.id };
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

async function deleteNotionPage(
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

async function updateNotionPageParent(
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

  let newParentNotionPageId: string | null = null;
  if (newParentAtlasUuid) {
    newParentNotionPageId = uuidMappings.atlasUUIDsToNotionPageIds.get(newParentAtlasUuid) ?? null;
    if (!newParentNotionPageId) {
      return { success: false, reason: 'parent_not_found', error: 'No mapping for parent' };
    }
  }

  // Handle same-database parent changes
  if (databaseSupportsInternalNesting(databaseName) && newParentAtlasUuid && newParentNotionPageId) {
    const newParentDatabase = newIdsToDatabase.get(newParentAtlasUuid);
    if (newParentDatabase === databaseName) {
      const config = NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[databaseName];
      if (config.parentPropertyName) {
        properties[config.parentPropertyName] = { relation: [{ id: newParentNotionPageId }] };
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

// ============================================================================
// Helper Functions
// ============================================================================

async function validatePageExists(pageId: string, cache?: Map<string, boolean>): Promise<boolean> {
  if (cache?.has(pageId)) {
    return cache.get(pageId)!;
  }

  try {
    const notionClient = notion();
    await notionClient.pages.retrieve({ page_id: pageId });
    cache?.set(pageId, true);
    return true;
  } catch (error) {
    const err = error as Error & { code?: string };
    const exists = err.code !== 'object_not_found';
    cache?.set(pageId, exists);
    return exists ? true : false;
  }
}

async function pageHasChildren(
  pageId: string,
  pageDocument: ExportAtlasTreeBaseDocument,
  originalIdsToDatabase: Map<string, AtlasDatabaseName>,
): Promise<boolean> {
  try {
    const databaseName = getDatabaseNameFromDocument(pageDocument.type, pageId, originalIdsToDatabase);
    const config = NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[databaseName];
    const childRelationshipNames = Object.values(config.childRelationships).filter((name) => name);

    const notionClient = notion();
    const page = await notionClient.pages.retrieve({ page_id: pageId });
    const pageProps = (page as { properties: Record<string, unknown> }).properties;

    for (const propertyName of childRelationshipNames) {
      const property = pageProps[propertyName] as { type?: string; relation?: unknown[] } | undefined;
      if (property?.type === 'relation' && property.relation && property.relation.length > 0) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error(`Error checking children for page ${pageId}:`, error);
    return true; // Assume has children for safety
  }
}

function sortAdditionsByDepthFirst(additions: AtlasDocumentChange[]): AtlasDocumentChange[] {
  if (additions.length === 0) return [];

  const childrenMap = new Map<string | null, AtlasDocumentChange[]>();
  const addedUuids = new Set(additions.map((c) => c.uuid));

  for (const change of additions) {
    const parentUuid = change.newAncestry?.length ? change.newAncestry[change.newAncestry.length - 1] : null;
    const effectiveParent = parentUuid && addedUuids.has(parentUuid) ? parentUuid : null;

    if (!childrenMap.has(effectiveParent)) {
      childrenMap.set(effectiveParent, []);
    }
    childrenMap.get(effectiveParent)!.push(change);
  }

  for (const children of childrenMap.values()) {
    children.sort((a, b) => compareDocNumbers(a.newValues?.doc_no ?? '', b.newValues?.doc_no ?? ''));
  }

  const result: AtlasDocumentChange[] = [];

  function traverse(parentUuid: string | null) {
    const children = childrenMap.get(parentUuid) ?? [];
    for (const child of children) {
      result.push(child);
      if (child.uuid) {
        traverse(child.uuid);
      }
    }
  }

  traverse(null);
  return result;
}

function getDocumentLabel(change: AtlasDocumentChange): string {
  const doc = change.newValues || change.oldValues;
  if (!doc) return 'Unknown document';
  return `${doc.doc_no} - ${doc.name} [${doc.type}]`;
}
