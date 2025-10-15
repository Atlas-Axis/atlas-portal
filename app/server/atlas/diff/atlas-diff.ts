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

export interface GroupedAtlasChanges {
  added: AtlasDocumentChange[];
  deleted: AtlasDocumentChange[];
  changed: AtlasDocumentChange[];
  parent_changed: AtlasDocumentChange[];
  sibling_order_changed: AtlasDocumentChange[];
}

export interface AtlasDiffResult {
  changes: GroupedAtlasChanges;
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
  uuidToAncestry: Map<string, string[]>; // UUID → ancestry list (from parent to root)
}

/**
 * Recursively traverse all documents in the tree and build flat lookup maps.
 * Documents without UUIDs are skipped and logged as errors.
 * Returns UUID→document, doc_no→document, and UUID→ancestry maps.
 * Ancestry is tracked during traversal, not inferred from doc_no.
 */
export function buildLookupMaps(scopeTrees: StandardizedAtlasScopeTrees): LookupMaps {
  const uuidToDoc = new Map<string, BaseAtlasDocument>();
  const docNoToDoc = new Map<string, BaseAtlasDocument>();
  const uuidToAncestry = new Map<string, string[]>(); // List of UUIDs from parent to root

  function traverseDocument(doc: StandardizedAtlasDocument, ancestry: string[] = []) {
    const strippedDoc = stripChildCollections(doc);

    // Skip documents without UUIDs and log as error
    if (!doc.uuid) {
      console.error(`Document without UUID found: type="${doc.type}", doc_no="${doc.doc_no}", name="${doc.name}"`);
    } else {
      // Store stripped version (without children) in the UUID lookup map
      uuidToDoc.set(doc.uuid, strippedDoc);
      // Store ancestry for this document (copy of current ancestry array)
      uuidToAncestry.set(doc.uuid, [...ancestry]);
    }

    // Always store in doc_no map (may be used for other purposes)
    docNoToDoc.set(doc.doc_no, strippedDoc);

    // Build extended ancestry for children (add current doc's UUID if it has one)
    const childAncestry = doc.uuid ? [...ancestry, doc.uuid] : ancestry;

    // Traverse all child collections
    const docAsRecord = doc as unknown as Record<string, unknown>;
    for (const collectionName of childCollectionNames) {
      const collection = docAsRecord[collectionName];
      if (Array.isArray(collection)) {
        for (const child of collection as StandardizedAtlasDocument[]) {
          traverseDocument(child, childAncestry);
        }
      }
    }
  }

  for (const rootDoc of scopeTrees) {
    traverseDocument(rootDoc);
  }

  return { uuidToDoc, docNoToDoc, uuidToAncestry };
}

/**
 * Extract all UUIDs from a lookup map as a Set.
 */
export function extractAllUuids(lookupMap: Map<string, BaseAtlasDocument>): Set<string> {
  return new Set(lookupMap.keys());
}

/**
 * Compare two arrays for equality.
 */
function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
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
 * Returns changes grouped by change type.
 *
 * Uses ancestry arrays (tracked during tree traversal) to detect parent changes.
 * This works correctly for all document types, including Needed Research with global numbering.
 */
export function detectChanges(
  originalMaps: LookupMaps,
  newMaps: LookupMaps,
  originalUuids: Set<string>,
  newUuids: Set<string>,
): GroupedAtlasChanges {
  const added: AtlasDocumentChange[] = [];
  const deleted: AtlasDocumentChange[] = [];
  const changed: AtlasDocumentChange[] = [];
  const parent_changed: AtlasDocumentChange[] = [];
  const sibling_order_changed: AtlasDocumentChange[] = [];

  // Added documents: exist in new but not in original
  for (const uuid of newUuids) {
    if (!originalUuids.has(uuid)) {
      const newDoc = newMaps.uuidToDoc.get(uuid);
      if (!newDoc) {
        console.error(`Added document with UUID ${uuid} not found in new lookup map`);
        continue;
      }
      added.push({
        uuid,
        changeType: 'added',
        newValues: newDoc,
        newAncestry: newMaps.uuidToAncestry.get(uuid) ?? [],
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
      deleted.push({
        uuid,
        changeType: 'deleted',
        oldValues: originalDoc,
        oldAncestry: originalMaps.uuidToAncestry.get(uuid) ?? [],
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

      const oldAncestry = originalMaps.uuidToAncestry.get(uuid) ?? [];
      const newAncestry = newMaps.uuidToAncestry.get(uuid) ?? [];

      const fieldsChanged = compareDocumentFields(originalDoc, newDoc);
      const docNoChanged = originalDoc.doc_no !== newDoc.doc_no;
      const ancestryChanged = !arraysEqual(oldAncestry, newAncestry);

      if (fieldsChanged || docNoChanged || ancestryChanged) {
        // A document can have multiple types of changes simultaneously.
        // Create separate change records for each type of change - except for parent_changed and sibling_order_changed, which are mutually exclusive.

        // Base change object shared by all change types
        const baseChange = {
          uuid,
          oldValues: originalDoc,
          newValues: newDoc,
          oldAncestry,
          newAncestry,
        };

        if (ancestryChanged) {
          // Parent changed (works for all doc types including Needed Research)
          parent_changed.push({
            ...baseChange,
            changeType: 'parent_changed',
          });
        } else if (docNoChanged) {
          // Only sibling order changed (doc_no changed but parent stayed the same)
          sibling_order_changed.push({
            ...baseChange,
            changeType: 'sibling_order_changed',
          });
        }

        // If fields changed, record as a separate change (even if parent/sibling order also changed)
        if (fieldsChanged) {
          changed.push({
            ...baseChange,
            changeType: 'changed',
          });
        }
      }
    }
  }

  return {
    added,
    deleted,
    changed,
    parent_changed,
    sibling_order_changed,
  };
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
