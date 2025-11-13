import fs from 'node:fs/promises';
import path from 'node:path';
import { parseAtlasMarkdown } from '@/app/server/atlas/export/atlas-markdown-importer';
import { buildAtlasJSON } from '../export/atlas-json-exporter';
import { StandardizedAtlasScopeTrees } from '../export/types';
import { AtlasDiffResult, buildLookupMaps, detectChanges, extractAllUuids } from './atlas-diff';

/**
 * Diff two Atlas scope tree lists and return the list of changes.
 */
export async function diffAtlasScopeTreeLists(): Promise<AtlasDiffResult> {
  const originalScopeTreeList = await loadSupabaseAsStandardizedAtlasScopeTrees();
  const newScopeTreeList = await loadMarkdownAsStandardizedAtlasScopeTrees();

  // Build lookup maps for both trees (UUID→doc and doc_no→doc)
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
  };
}

async function loadSupabaseAsStandardizedAtlasScopeTrees(): Promise<StandardizedAtlasScopeTrees> {
  return buildAtlasJSON();
}

async function loadMarkdownAsStandardizedAtlasScopeTrees(): Promise<StandardizedAtlasScopeTrees> {
  const projectRoot = process.cwd();
  const dir = path.join(projectRoot, '.debug-data', 'standardized-atlas');
  const inFile = path.join(dir, 'atlas.md');

  const markdown = await fs.readFile(inFile, 'utf8');
  return parseAtlasMarkdown(markdown);
}
