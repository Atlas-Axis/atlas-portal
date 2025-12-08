import { parseAtlasMarkdown } from '@/app/server/atlas/export/atlas-markdown-importer';
import { type BuildExportAtlasTreeOptions, buildExportAtlasTreeJSON } from '../export/atlas-json-exporter';
import { ExportAtlasTreeScopeTrees } from '../export/types';
import { loadAtlasMarkdownForSync } from '../load-atlas-markdown-from-github';
import { AtlasDiffResult, buildLookupMaps, detectChanges, extractAllUuids } from './atlas-diff';

/**
 * Options for diff operation
 *
 * @todo CLEANUP: Remove after migration complete (Phase 8)
 */
export interface DiffOptions {
  /**
   * Migration mode: Use dynamically calculated doc_no/name (generatedDocID/generatedDocName)
   * instead of stored values from Supabase (atlas_document_number/plain_text_name).
   * Default: false (use stored values from standardized Notion fields)
   *
   * @todo CLEANUP: Remove after migration complete (Phase 8)
   */
  useDynamicValues?: boolean;
}

/**
 * Diff two Atlas scope tree lists and return the list of changes.
 *
 * Compares the current Atlas data in Supabase with the canonical Atlas markdown
 * file stored in GitHub.
 *
 * @param options Optional diff options (e.g., useDynamicValues for migration mode)
 * @todo CLEANUP: Remove options parameter after migration (Phase 8)
 */
export async function diffAtlasScopeTreeLists(options?: DiffOptions): Promise<AtlasDiffResult> {
  const exportOptions: BuildExportAtlasTreeOptions = {
    useDynamicValues: options?.useDynamicValues, // @todo CLEANUP: Remove (Phase 8)
  };

  const originalScopeTreeList = await loadSupabaseAsExportAtlasScopeTrees(exportOptions);
  const newScopeTreeList = await loadMarkdownAsExportAtlasScopeTrees();

  // Build lookup maps for both trees (UUID→doc, doc_no→doc, UUID→ancestry, UUID→database)
  const originalMaps = buildLookupMaps(originalScopeTreeList);
  const newMaps = buildLookupMaps(newScopeTreeList);

  // Extract UUID sets
  const originalUuids = extractAllUuids(originalMaps.uuidToDoc);
  const newUuids = extractAllUuids(newMaps.uuidToDoc);

  // Detect changes
  const changes = detectChanges(originalMaps, newMaps, originalUuids, newUuids);

  return {
    changes,
    originalIdsToDocuments: originalMaps.uuidToDoc,
    newIdsToDocuments: newMaps.uuidToDoc,
    originalIdsToDatabase: originalMaps.uuidToDatabase,
    newIdsToDatabase: newMaps.uuidToDatabase,
  };
}

async function loadSupabaseAsExportAtlasScopeTrees(
  exportOptions?: BuildExportAtlasTreeOptions,
): Promise<ExportAtlasTreeScopeTrees> {
  return buildExportAtlasTreeJSON(exportOptions);
}

/**
 * Loads Atlas markdown for sync and parses it into Export Tree format.
 *
 * In local development, uses truncated-atlas.md if available.
 * In production, fetches from GitHub.
 *
 * @returns The parsed Atlas scope trees
 */
async function loadMarkdownAsExportAtlasScopeTrees(): Promise<ExportAtlasTreeScopeTrees> {
  const markdown = await loadAtlasMarkdownForSync();
  return parseAtlasMarkdown(markdown);
}
