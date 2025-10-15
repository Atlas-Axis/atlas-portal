import fs from 'node:fs/promises';
import path from 'node:path';
import { parseAtlasMarkdown } from '@/app/server/atlas/json-export/atlas-markdown-importer';
import { buildAtlasJSON } from '../json-export/atlas-json-exporter';
import {
  BaseAtlasDocument,
  StandardizedAtlasDocument,
  StandardizedAtlasScopeTrees,
  childCollectionNames,
} from '../json-export/types';
import {
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '../notion-database-properties-and-relationships';

// ============================================================================
// Type Definitions
// ============================================================================

export type AtlasChangeType = 'added' | 'deleted' | 'changed' | 'sibling_order_changed' | 'parent_changed';

export interface AtlasDocumentChange {
  uuid: string;
  changeType: AtlasChangeType;
  oldValues?: BaseAtlasDocument;
  newValues?: BaseAtlasDocument;
  oldAncestry?: string[]; // UUIDs from parent to root
  newAncestry?: string[]; // UUIDs from parent to root
}

export interface AtlasDiffResult {
  changes: AtlasDocumentChange[];
  originalIdsToDocuments: Map<string, BaseAtlasDocument>;
  newIdsToDocuments: Map<string, BaseAtlasDocument>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Result of building lookup maps from scope trees.
 */
export interface LookupMaps {
  uuidToDoc: Map<string, BaseAtlasDocument>;
  docNoToDoc: Map<string, BaseAtlasDocument>;
}

/**
 * Recursively traverse all documents in the tree and build flat lookup maps.
 * Documents without UUIDs are skipped and logged as errors.
 * Returns both UUID→document and doc_no→document maps for efficient lookups.
 */
export function buildLookupMaps(scopeTrees: StandardizedAtlasScopeTrees): LookupMaps {
  const uuidToDoc = new Map<string, BaseAtlasDocument>();
  const docNoToDoc = new Map<string, BaseAtlasDocument>();

  function traverseDocument(doc: StandardizedAtlasDocument) {
    const strippedDoc = stripChildCollections(doc);

    // Skip documents without UUIDs and log as error
    if (!doc.uuid) {
      console.error(`Document without UUID found: type="${doc.type}", doc_no="${doc.doc_no}", name="${doc.name}"`);
    } else {
      // Store stripped version (without children) in the UUID lookup map
      uuidToDoc.set(doc.uuid, strippedDoc);
    }

    // Always store in doc_no map for ancestry lookups
    docNoToDoc.set(doc.doc_no, strippedDoc);

    // Traverse all child collections
    const docAsRecord = doc as unknown as Record<string, unknown>;
    for (const collectionName of childCollectionNames) {
      const collection = docAsRecord[collectionName];
      if (Array.isArray(collection)) {
        for (const child of collection as StandardizedAtlasDocument[]) {
          traverseDocument(child);
        }
      }
    }
  }

  for (const rootDoc of scopeTrees) {
    traverseDocument(rootDoc);
  }

  return { uuidToDoc, docNoToDoc };
}

/**
 * Extract all UUIDs from a lookup map as a Set.
 */
export function extractAllUuids(lookupMap: Map<string, BaseAtlasDocument>): Set<string> {
  return new Set(lookupMap.keys());
}

/**
 * Compare document fields to detect changes.
 * Compares: type, name, content, and extra fields for specific document types.
 * Does NOT compare last_modified.
 */
export function compareDocumentFields(original: BaseAtlasDocument, updated: BaseAtlasDocument): boolean {
  // Compare basic fields
  if (original.type !== updated.type) return true;
  if (original.name !== updated.name) return true;
  if (original.content !== updated.content) return true;

  // Compare extra fields for specific document types
  const extraFieldKeys = getExtraFieldKeysForDocumentType(original.type);
  if (extraFieldKeys.length > 0) {
    const originalRecord = original as unknown as Record<string, unknown>;
    const updatedRecord = updated as unknown as Record<string, unknown>;

    for (const key of extraFieldKeys) {
      const originalValue = originalRecord[key];
      const updatedValue = updatedRecord[key];
      if (originalValue !== updatedValue) return true;
    }
  }

  return false;
}

/**
 * Get the list of extra field keys for a given document type.
 */
function getExtraFieldKeysForDocumentType(type: string): string[] {
  switch (type) {
    case 'Type Specification':
      return Object.keys(TYPE_SPECIFICATION_PROPERTY_MAPPING);
    case 'Scenario':
      return Object.keys(SCENARIO_PROPERTY_MAPPING);
    case 'Scenario Variation':
      return Object.keys(SCENARIO_VARIATION_PROPERTY_MAPPING);
    default:
      return [];
  }
}

/**
 * Extract the ancestry path from a doc_no (everything except the last segment).
 * Examples:
 *   "A.2.9.1" → "A.2.9"
 *   ".var1" → ""
 *   ".0.3.1" → ".0.3"
 */
export function extractDocNoAncestryPath(docNo: string): string {
  const lastDotIndex = docNo.lastIndexOf('.');
  if (lastDotIndex === -1) {
    // No dots, so no parent (e.g., "A" or "NR-1")
    return '';
  }
  return docNo.substring(0, lastDotIndex);
}

/**
 * Extract the last segment from a doc_no.
 * Examples:
 *   "A.2.9.1" → "1"
 *   ".var1" → "var1"
 *   "A" → "A"
 */
export function extractDocNoLastSegment(docNo: string): string {
  const lastDotIndex = docNo.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return docNo;
  }
  return docNo.substring(lastDotIndex + 1);
}

/**
 * Build an ancestry list (UUIDs from parent to root) for a document.
 * Uses doc_no to identify the parent and recursively builds the list.
 */
export function buildAncestryList(
  uuid: string,
  uuidToDoc: Map<string, BaseAtlasDocument>,
  docNoToDoc: Map<string, BaseAtlasDocument>,
  visited: Set<string> = new Set(),
): string[] {
  if (visited.has(uuid)) {
    console.error(`Cycle detected while building ancestry for ${uuid}`);
    return [];
  }
  visited.add(uuid);

  const doc = uuidToDoc.get(uuid);
  if (!doc) return [];

  const parentDocNo = extractDocNoAncestryPath(doc.doc_no);
  if (!parentDocNo) {
    // No parent (root document)
    return [];
  }

  // Find parent by doc_no using efficient lookup
  const parentDoc = docNoToDoc.get(parentDocNo);
  if (!parentDoc || !parentDoc.uuid) {
    // Parent not found or has no UUID
    console.error(`Parent document not found for ${doc.doc_no}`);
    return [];
  }

  // Recursively build ancestry list
  const parentAncestry = buildAncestryList(parentDoc.uuid, uuidToDoc, docNoToDoc, visited);
  return [...parentAncestry, parentDoc.uuid];
}

/**
 * Create a shallow copy of a document without child collection properties.
 * Returns only core fields: type, doc_no, name, uuid, content, and extra fields.
 * Does NOT include last_modified.
 */
export function stripChildCollections(doc: StandardizedAtlasDocument): BaseAtlasDocument {
  const stripped: Record<string, unknown> = {
    type: doc.type,
    doc_no: doc.doc_no,
    name: doc.name,
    uuid: doc.uuid,
    content: doc.content,
    last_modified: '',
  };

  // Include extra fields if present
  const extraFieldKeys = getExtraFieldKeysForDocumentType(doc.type);
  if (extraFieldKeys.length > 0) {
    const docRecord = doc as unknown as Record<string, unknown>;
    for (const key of extraFieldKeys) {
      if (key in docRecord) {
        stripped[key] = docRecord[key];
      }
    }
  }

  return stripped as unknown as BaseAtlasDocument;
}

// ============================================================================
// Main Diff Logic
// ============================================================================

/**
 * Detect changes between original and new documents.
 * Returns an array of change records.
 *
 * TODO: Sort changes by doc_no - question: which order should we use? original or new? Or don't sort at all - just show added/deleted changes in the beginning?
 */
export function detectChanges(
  originalMaps: LookupMaps,
  newMaps: LookupMaps,
  originalUuids: Set<string>,
  newUuids: Set<string>,
): AtlasDocumentChange[] {
  const changes: AtlasDocumentChange[] = [];

  // Added documents: exist in new but not in original
  for (const uuid of newUuids) {
    if (!originalUuids.has(uuid)) {
      const newDoc = newMaps.uuidToDoc.get(uuid);
      if (!newDoc) {
        console.error(`Added document with UUID ${uuid} not found in new lookup map`);
        continue;
      }
      changes.push({
        uuid,
        changeType: 'added',
        newValues: newDoc,
        newAncestry: buildAncestryList(uuid, newMaps.uuidToDoc, newMaps.docNoToDoc),
      });
    }
  }

  // Deleted documents: exist in original but not in new
  for (const uuid of originalUuids) {
    if (!newUuids.has(uuid)) {
      const originalDoc = originalMaps.uuidToDoc.get(uuid);
      if (!originalDoc) {
        console.error(`Deleted document with UUID ${uuid} not found in original lookup map`);
        continue;
      }
      changes.push({
        uuid,
        changeType: 'deleted',
        oldValues: originalDoc,
        oldAncestry: buildAncestryList(uuid, originalMaps.uuidToDoc, originalMaps.docNoToDoc),
      });
    }
  }

  // Changed documents: exist in both, but with differences
  for (const uuid of originalUuids) {
    if (newUuids.has(uuid)) {
      const originalDoc = originalMaps.uuidToDoc.get(uuid);
      const newDoc = newMaps.uuidToDoc.get(uuid);

      if (!originalDoc || !newDoc) {
        console.error(`Changed document with UUID ${uuid} not found in lookup maps`);
        continue;
      }

      const fieldsChanged = compareDocumentFields(originalDoc, newDoc);
      const docNoChanged = originalDoc.doc_no !== newDoc.doc_no;

      if (fieldsChanged || docNoChanged) {
        // Determine the type of change
        let changeType: AtlasChangeType = 'changed';

        if (docNoChanged) {
          const originalAncestryPath = extractDocNoAncestryPath(originalDoc.doc_no);
          const newAncestryPath = extractDocNoAncestryPath(newDoc.doc_no);

          if (originalAncestryPath !== newAncestryPath) {
            // Parent changed
            changeType = 'parent_changed';
          } else {
            // Only last segment changed (sibling order)
            changeType = 'sibling_order_changed';
          }
        }

        changes.push({
          uuid,
          changeType,
          oldValues: originalDoc,
          newValues: newDoc,
          oldAncestry: buildAncestryList(uuid, originalMaps.uuidToDoc, originalMaps.docNoToDoc),
          newAncestry: buildAncestryList(uuid, newMaps.uuidToDoc, newMaps.docNoToDoc),
        });
      }
    }
  }

  return changes;
}

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

/**
 * Find the project root by searching upward for package.json
 */
async function findProjectRoot(startDir: string = __dirname): Promise<string> {
  let currentDir = startDir;

  while (currentDir !== path.parse(currentDir).root) {
    const packageJsonPath = path.join(currentDir, 'package.json');

    try {
      await fs.access(packageJsonPath);
      return currentDir;
    } catch {
      // package.json not found, continue searching upward
      currentDir = path.dirname(currentDir);
    }
  }

  // Throw an error if the project root is not found
  throw new Error('Project root not found');
}

async function loadSupabaseAsStandardizedAtlasScopeTrees() {
  return buildAtlasJSON();
}

async function loadMarkdownAsStandardizedAtlasScopeTrees() {
  const projectRoot = await findProjectRoot();
  const dir = path.join(projectRoot, '.debug-data', 'standardized-atlas');
  const inFile = path.join(dir, 'atlas.md');

  const markdown = await fs.readFile(inFile, 'utf8');
  return parseAtlasMarkdown(markdown);
}
