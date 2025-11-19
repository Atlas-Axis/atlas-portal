import fs from 'node:fs/promises';
import path from 'node:path';
import { parseAtlasMarkdown } from '@/app/server/atlas/export/atlas-markdown-importer';
import { buildExportAtlasTreeJSON } from '../export/atlas-json-exporter';
import { ExportAtlasTreeScopeTrees } from '../export/types';
import { AtlasDiffResult, buildLookupMaps, detectChanges, extractAllUuids } from './atlas-diff';

/**
 * Diff two Atlas scope tree lists and return the list of changes.
 */
export async function diffAtlasScopeTreeLists(): Promise<AtlasDiffResult> {
  const originalScopeTreeList = await loadSupabaseAsExportAtlasScopeTrees();
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

async function loadSupabaseAsExportAtlasScopeTrees(): Promise<ExportAtlasTreeScopeTrees> {
  return buildExportAtlasTreeJSON();
}

async function loadMarkdownAsExportAtlasScopeTrees(): Promise<ExportAtlasTreeScopeTrees> {
  const projectRoot = process.cwd();
  const dir = path.join(projectRoot, 'exported-atlas');
  const inFile = path.join(dir, 'atlas.md');

  const markdown = await fs.readFile(inFile, 'utf8');
  return parseAtlasMarkdown(markdown);
}
