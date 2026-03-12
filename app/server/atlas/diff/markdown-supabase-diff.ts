import { parseAtlasMarkdown } from '@/app/server/atlas/export/atlas-markdown-importer';
import { buildExportAtlasTreeJSON } from '../export/atlas-json-exporter';
import { ExportAtlasTreeScopeTrees } from '../export/types';
import { loadAtlasMarkdownForSync } from '../load-atlas-markdown-from-github';
import { AtlasDiffResult, buildLookupMaps, detectChanges, extractAllUuids } from './atlas-diff';

/**
 * Diff two Atlas scope tree lists and return the list of changes.
 *
 * Compares the current Atlas data (from GitHub markdown) with the canonical Atlas markdown
 * file stored in GitHub. Post-migration, both sides read from GitHub markdown,
 * so this diff will always be empty. Kept for compatibility with sync UI.
 */
export async function diffAtlasScopeTreeLists(): Promise<AtlasDiffResult> {
  const originalScopeTreeList = await buildExportAtlasTreeJSON();
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
