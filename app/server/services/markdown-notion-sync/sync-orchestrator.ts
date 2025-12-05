/**
 * Main orchestration logic for Markdown-to-Notion sync
 */
import { getDatabaseNameFromDocument } from '@/app/atlas/sync/_lib/atlas-database-mapper';
import type { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import { AtlasDiffResult } from '@/app/server/atlas/diff/atlas-diff';
import { UuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import {
  buildNestingBugAffectedUuidsSet,
  loadNotionNestingFixMappings,
} from '@/app/server/services/supabase/notion-nesting-bug-mappings';
import { getDocumentLabel, sortAdditionsByDepthFirst } from './sync-helpers';
import {
  createNotionDatabasePage,
  deleteNotionPage,
  updateNotionPageContent,
  updateNotionPageParent,
  updatePageMentions,
} from './sync-operations';
import { PageWithUnresolvedMentions, SyncFilters, SyncPhase } from './types';

/**
 * Callback for progress updates
 */
export type ProgressCallback = (data: {
  phase: SyncPhase;
  completed: number;
  currentDoc: string;
  succeeded: number;
  failed: number;
  skipped: number;
}) => void;

/**
 * Callback for checking if stop was requested
 */
export type StopCheckCallback = () => Promise<boolean>;

/**
 * Result of processing changes
 */
export interface ProcessChangesResult {
  succeeded: number;
  failed: number;
  skipped: number;
  stoppedEarly: boolean;
  /** Databases that were affected by successfully processed changes */
  affectedDatabases: AtlasDatabaseName[];
}

/**
 * Process all changes from diff result in 5 phases:
 * 1. Content changes (update existing pages)
 * 2. Additions (create new pages)
 * 2.5. Mention updates (fix placeholder mentions with real Notion page IDs)
 * 3. Deletions (archive pages)
 * 4. Parent changes (update relationships)
 *
 * @param diffResult Diff result from comparing Markdown and Supabase
 * @param uuidMappings Bidirectional UUID mappings
 * @param filters Filters for which change types to process
 * @param syncBatchId Sync batch ID for audit logging
 * @param onProgress Callback for progress updates
 * @param onStopCheck Callback for checking if stop was requested
 * @returns Result with counts and stop status
 */
export async function processChanges(
  diffResult: AtlasDiffResult,
  uuidMappings: UuidMappings,
  filters: SyncFilters,
  syncBatchId: string,
  onProgress: ProgressCallback,
  onStopCheck: StopCheckCallback,
): Promise<ProcessChangesResult> {
  // Load nesting bug mappings
  const nestingMappings = await loadNotionNestingFixMappings();
  const nestingBugAffectedUuids = buildNestingBugAffectedUuidsSet(nestingMappings, uuidMappings, {
    throwOnMissingUuid: false,
  });

  // Apply filters
  const filteredChanges = {
    added: filters.added ? diffResult.changes.added : [],
    deleted: filters.deleted ? diffResult.changes.deleted : [],
    changed: filters.contentChanges ? diffResult.changes.changed : [],
    parent_changed: filters.parentChanges ? diffResult.changes.parent_changed : [],
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
    return { succeeded: 0, failed: 0, skipped: 0, stoppedEarly: false, affectedDatabases: [] };
  }

  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  let completed = 0;

  // Track pages created in this sync for parent validation
  const createdPagesInSync = new Set<string>();
  const parentValidationCache = new Map<string, boolean>();

  // Track pages with unresolved mentions for Phase 2.5
  const pagesWithUnresolvedMentions: PageWithUnresolvedMentions[] = [];

  // Track affected databases for chained Notion-to-Supabase import
  const affectedDatabasesSet = new Set<AtlasDatabaseName>();

  // Phase 1: Content changes
  if (filteredChanges.changed.length > 0) {
    for (const change of filteredChanges.changed) {
      const docLabel = getDocumentLabel(change);

      // Check for stop request
      if (await onStopCheck()) {
        return { succeeded, failed, skipped, stoppedEarly: true, affectedDatabases: [...affectedDatabasesSet] };
      }

      // Update progress
      onProgress({ phase: 'content', completed, currentDoc: docLabel, succeeded, failed, skipped });

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
          // Track affected database
          if (change.uuid) {
            const db = diffResult.originalIdsToDatabase.get(change.uuid);
            if (db) affectedDatabasesSet.add(db);
          }
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
    for (const change of sortedAdditions) {
      const docLabel = getDocumentLabel(change);

      // Check for stop request
      if (await onStopCheck()) {
        return { succeeded, failed, skipped, stoppedEarly: true, affectedDatabases: [...affectedDatabasesSet] };
      }

      // Update progress
      onProgress({ phase: 'additions', completed, currentDoc: docLabel, succeeded, failed, skipped });

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

            // Track affected database (the new document's database)
            if (change.uuid) {
              const db = diffResult.newIdsToDatabase.get(change.uuid);
              if (db) affectedDatabasesSet.add(db);
            }

            // Track parent's database (parent's child_*_ids array will be updated in Notion)
            if (change.newAncestry && change.newAncestry.length > 0) {
              const parentUuid = change.newAncestry[change.newAncestry.length - 1];
              const parentDb = diffResult.newIdsToDatabase.get(parentUuid);
              if (parentDb) affectedDatabasesSet.add(parentDb);
            }

            // Track pages with unresolved mentions for Phase 2.5
            if (result.unresolvedMentionUuids && result.unresolvedMentionUuids.length > 0 && change.newValues?.uuid) {
              pagesWithUnresolvedMentions.push({
                notionPageId: result.pageId,
                atlasUuid: change.newValues.uuid,
                unresolvedMentionUuids: result.unresolvedMentionUuids,
              });
            }
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

  // Phase 2.5: Mention updates (fix placeholder mentions with real Notion page IDs)
  if (pagesWithUnresolvedMentions.length > 0) {
    console.log(`[Sync] Phase 2.5: Updating ${pagesWithUnresolvedMentions.length} pages with placeholder mentions`);

    for (const pageInfo of pagesWithUnresolvedMentions) {
      // Check for stop request
      if (await onStopCheck()) {
        return { succeeded, failed, skipped, stoppedEarly: true, affectedDatabases: [...affectedDatabasesSet] };
      }

      // Get the document from the diff result
      const document = diffResult.newIdsToDocuments.get(pageInfo.atlasUuid);
      if (!document) {
        console.warn(`[Sync] Could not find document for mention update: ${pageInfo.atlasUuid}`);
        skipped++;
        completed++;
        continue;
      }

      const databaseName = getDatabaseNameFromDocument(document.type, pageInfo.atlasUuid, diffResult.newIdsToDatabase);
      const docLabel = `${document.doc_no} - ${document.name}`;

      // Update progress
      onProgress({ phase: 'mention_updates', completed, currentDoc: docLabel, succeeded, failed, skipped });

      try {
        const result = await updatePageMentions(
          pageInfo.notionPageId,
          document,
          databaseName,
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
        console.error(`[Sync] Error updating mentions for ${docLabel}:`, error);
      }
    }
  }

  // Phase 3: Deletions
  if (filteredChanges.deleted.length > 0) {
    for (const change of filteredChanges.deleted) {
      const docLabel = getDocumentLabel(change);

      // Check for stop request
      if (await onStopCheck()) {
        return { succeeded, failed, skipped, stoppedEarly: true, affectedDatabases: [...affectedDatabasesSet] };
      }

      // Update progress
      onProgress({ phase: 'deletions', completed, currentDoc: docLabel, succeeded, failed, skipped });

      try {
        const result = await deleteNotionPage(change, diffResult.originalIdsToDatabase, uuidMappings, syncBatchId);
        completed++;
        if (result.success) {
          succeeded++;
          // Track affected database (the deleted document's database)
          if (change.uuid) {
            const db = diffResult.originalIdsToDatabase.get(change.uuid);
            if (db) affectedDatabasesSet.add(db);
          }

          // Track old parent's database (parent's child_*_ids array will be updated in Notion)
          if (change.oldAncestry && change.oldAncestry.length > 0) {
            const parentUuid = change.oldAncestry[change.oldAncestry.length - 1];
            const parentDb = diffResult.originalIdsToDatabase.get(parentUuid);
            if (parentDb) affectedDatabasesSet.add(parentDb);
          }
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
    for (const change of filteredChanges.parent_changed) {
      const docLabel = getDocumentLabel(change);

      // Check for stop request
      if (await onStopCheck()) {
        return { succeeded, failed, skipped, stoppedEarly: true, affectedDatabases: [...affectedDatabasesSet] };
      }

      // Update progress
      onProgress({ phase: 'parent_changes', completed, currentDoc: docLabel, succeeded, failed, skipped });

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
          // Track affected database (the moved document's database)
          if (change.uuid) {
            const db =
              diffResult.newIdsToDatabase.get(change.uuid) ?? diffResult.originalIdsToDatabase.get(change.uuid);
            if (db) affectedDatabasesSet.add(db);
          }

          // Track old parent's database (old parent's child_*_ids array will be updated in Notion)
          if (change.oldAncestry && change.oldAncestry.length > 0) {
            const oldParentUuid = change.oldAncestry[change.oldAncestry.length - 1];
            const oldParentDb =
              diffResult.originalIdsToDatabase.get(oldParentUuid) ?? diffResult.newIdsToDatabase.get(oldParentUuid);
            if (oldParentDb) affectedDatabasesSet.add(oldParentDb);
          }

          // Track new parent's database (new parent's child_*_ids array will be updated in Notion)
          if (change.newAncestry && change.newAncestry.length > 0) {
            const newParentUuid = change.newAncestry[change.newAncestry.length - 1];
            const newParentDb =
              diffResult.newIdsToDatabase.get(newParentUuid) ?? diffResult.originalIdsToDatabase.get(newParentUuid);
            if (newParentDb) affectedDatabasesSet.add(newParentDb);
          }
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

  return { succeeded, failed, skipped, stoppedEarly: false, affectedDatabases: [...affectedDatabasesSet] };
}
