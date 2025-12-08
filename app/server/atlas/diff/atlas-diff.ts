/**
 * Atlas Diffing Module
 *
 * Compares two versions of the Atlas document hierarchy (Supabase vs Markdown)
 * and identifies changes between them.
 *
 * TEMPORARY WORKAROUND FOR COSMETIC FORMATTING:
 * This module currently normalizes cosmetic formatting differences to reduce noise:
 * - Fancy quotes (" ") are normalized to straight quotes (")
 * - Bullet characters (•) are normalized to hyphens (-)
 *
 * This workaround should be REMOVED once the source data formatting is consistent
 * across all Atlas documents. The normalization is applied in the
 * `normalizeCosmeticFormatting()` function and used in `compareDocumentFields()`.
 *
 * TODO: Remove cosmetic formatting normalization when no longer needed.
 */
import { AtlasDatabaseName } from '../atlas-types';
import {
  ChildCollectionName,
  ExportAtlasTreeBaseDocument,
  ExportAtlasTreeDocument,
  ExportAtlasTreeScopeTrees,
  childCollectionNameToDatabaseName,
  childCollectionNames,
} from '../export/types';
import {
  NEEDED_RESEARCH_PROPERTY_MAPPING,
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '../notion-mapping/notion-database-properties-and-relationships';

// ============================================================================
// Type Definitions
// ============================================================================

export type AtlasChangeType = 'added' | 'deleted' | 'changed' | 'parent_changed';

export interface AtlasDocumentChange {
  uuid: string;
  changeType: AtlasChangeType;
  oldValues?: ExportAtlasTreeBaseDocument;
  newValues?: ExportAtlasTreeBaseDocument;
  oldAncestry?: string[]; // UUIDs from parent to root
  newAncestry?: string[]; // UUIDs from parent to root
}

export interface GroupedAtlasChanges {
  added: AtlasDocumentChange[];
  deleted: AtlasDocumentChange[];
  changed: AtlasDocumentChange[];
  parent_changed: AtlasDocumentChange[];
}

export interface AtlasDiffResult {
  changes: GroupedAtlasChanges;
  originalIdsToDocuments: Map<string, ExportAtlasTreeBaseDocument>;
  newIdsToDocuments: Map<string, ExportAtlasTreeBaseDocument>;
  originalIdsToDatabase: Map<string, AtlasDatabaseName>;
  newIdsToDatabase: Map<string, AtlasDatabaseName>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Result of building lookup maps from scope trees.
 */
export interface LookupMaps {
  uuidToDoc: Map<string, ExportAtlasTreeBaseDocument>;
  docNoToDoc: Map<string, ExportAtlasTreeBaseDocument>;
  uuidToAncestry: Map<string, string[]>; // UUID → ancestry list (from parent to root)
  uuidToDatabase: Map<string, AtlasDatabaseName>; // UUID → Atlas database name
}

/**
 * Maps a collection name to its corresponding Atlas database name.
 * Each collection name uniquely identifies a database in the Export Tree.
 *
 * NOTE: This function does NOT perform Agent Scope Database detection.
 * Agent Scope Database detection happens during markdown import in
 * `mapTypeToDatabase()` within `atlas-markdown-importer.ts`. This function
 * simply reads the collection names that were already determined during import.
 */
export function getDatabaseFromCollectionName(collectionName: string): AtlasDatabaseName {
  if (collectionName in childCollectionNameToDatabaseName) {
    return childCollectionNameToDatabaseName[collectionName as ChildCollectionName];
  }
  throw new Error(`Unknown collection name: ${collectionName}`);
}

/**
 * Recursively traverse all documents in the tree and build flat lookup maps.
 * Documents without UUIDs are skipped and logged as errors.
 * Returns UUID→document, doc_no→document, UUID→ancestry, and UUID→database maps.
 * Ancestry and database are tracked during traversal, not inferred from doc_no.
 *
 * NOTE: Database tracking reads collection names from the Export Tree structure.
 * Agent Scope Database detection happens earlier during markdown import in
 * `mapTypeToDatabase()` within `atlas-markdown-importer.ts`. This function
 * simply records which collection each document came from.
 */
export function buildLookupMaps(scopeTrees: ExportAtlasTreeScopeTrees): LookupMaps {
  const uuidToDoc = new Map<string, ExportAtlasTreeBaseDocument>();
  const docNoToDoc = new Map<string, ExportAtlasTreeBaseDocument>();
  const uuidToAncestry = new Map<string, string[]>(); // List of UUIDs from parent to root
  const uuidToDatabase = new Map<string, AtlasDatabaseName>(); // Track which database each document belongs to

  function traverseDocument(
    doc: ExportAtlasTreeDocument,
    ancestry: string[] = [],
    parentCollectionName?: string, // Track which collection this doc came from
  ) {
    const strippedDoc = stripChildCollections(doc);

    // Skip documents without UUIDs and log as error
    if (!doc.uuid) {
      console.error(`Document without UUID found: type="${doc.type}", doc_no="${doc.doc_no}", name="${doc.name}"`);
    } else {
      // Store stripped version (without children) in the UUID lookup map
      uuidToDoc.set(doc.uuid, strippedDoc);
      // Store ancestry for this document (copy of current ancestry array)
      uuidToAncestry.set(doc.uuid, [...ancestry]);

      // Derive and store database from collection name
      if (parentCollectionName) {
        const database = getDatabaseFromCollectionName(parentCollectionName);
        uuidToDatabase.set(doc.uuid, database);
      } else {
        // Root documents are always Scopes
        uuidToDatabase.set(doc.uuid, 'Scopes');
      }
    }

    // Always store in doc_no map (may be used for other purposes)
    docNoToDoc.set(doc.doc_no, strippedDoc);

    // Build extended ancestry for children (add current doc's UUID if it has one)
    const childAncestry = doc.uuid ? [...ancestry, doc.uuid] : ancestry;

    // Traverse all child collections and pass collection name down
    const docAsRecord = doc as unknown as Record<string, unknown>;
    for (const collectionName of childCollectionNames) {
      const collection = docAsRecord[collectionName];
      if (Array.isArray(collection)) {
        for (const child of collection as ExportAtlasTreeDocument[]) {
          traverseDocument(child, childAncestry, collectionName); // Pass collection name
        }
      }
    }
  }

  for (const rootDoc of scopeTrees) {
    traverseDocument(rootDoc); // Root docs have no parent collection
  }

  return { uuidToDoc, docNoToDoc, uuidToAncestry, uuidToDatabase };
}

/**
 * Extract all UUIDs from a lookup map as a Set.
 */
export function extractAllUuids(lookupMap: Map<string, ExportAtlasTreeBaseDocument>): Set<string> {
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
 * Normalize whitespace in text by trimming each line individually.
 * This handles multi-line text more intelligently by removing leading and trailing
 * whitespace from each line, not just from the entire string.
 */
function normalizeWhitespace(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

/**
 * Normalize cosmetic formatting differences in text.
 * TEMPORARY WORKAROUND: Converts fancy quotes to straight quotes and bullet characters to hyphens.
 * This helps suppress noise in diffs where the only changes are formatting-related.
 *
 * TODO: Remove this workaround once source data formatting is consistent.
 */
function normalizeCosmeticFormatting(text: string): string {
  return (
    text
      // Convert left/right double quotation marks to straight quotes
      .replace(/[\u201C\u201D]/g, '"')
      // Convert bullet characters to hyphens
      .replace(/\u2022/g, '-')
  );
}

/**
 * Compare document fields to detect changes.
 * Compares: type, doc_no, name, content, and extra fields for specific document types.
 * Does NOT compare last_modified.
 * Trims whitespace from each line in multi-line texts for comparison.
 *
 * NOTE: doc_no and name now use stored values from Supabase (from standardized Notion fields)
 * instead of dynamically calculated values.
 * See: docs/docs/action-plans/NOTION_PROPERTY_STANDARDIZATION_ACTION_PLAN.md
 *
 * TEMPORARY WORKAROUND: Also normalizes cosmetic formatting (fancy quotes, bullets)
 * to suppress noise in diffs. This should be removed once source data is consistent.
 */
export function compareDocumentFields(
  original: ExportAtlasTreeBaseDocument,
  updated: ExportAtlasTreeBaseDocument,
): boolean {
  // Compare basic fields
  if (original.type !== updated.type) return true;

  // Apply both whitespace and cosmetic formatting normalization
  const normalizeFully = (text: string) => normalizeWhitespace(normalizeCosmeticFormatting(text));

  // Compare doc_no (document number from standardized "Document Number" Notion field)
  if (normalizeFully(original.doc_no) !== normalizeFully(updated.doc_no)) return true;
  // Compare name (document title from standardized "Document Title" Notion field)
  if (normalizeFully(original.name) !== normalizeFully(updated.name)) return true;
  if (normalizeFully(original.content) !== normalizeFully(updated.content)) return true;

  // Compare extra fields for specific document types
  const extraFieldKeys = getExtraFieldKeysForDocumentType(original.type);
  if (extraFieldKeys.length > 0) {
    const originalRecord = original as unknown as Record<string, unknown>;
    const updatedRecord = updated as unknown as Record<string, unknown>;

    for (const key of extraFieldKeys) {
      const originalValue = originalRecord[key];
      const updatedValue = updatedRecord[key];

      // Ensure values are compared as strings, and handle undefined/null safely
      const originalStr = originalValue !== undefined && originalValue !== null ? String(originalValue) : '';
      const updatedStr = updatedValue !== undefined && updatedValue !== null ? String(updatedValue) : '';
      if (normalizeFully(originalStr) !== normalizeFully(updatedStr)) return true;
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
    case 'Needed Research':
      return Object.keys(NEEDED_RESEARCH_PROPERTY_MAPPING);
    default:
      return [];
  }
}

/**
 * Create a shallow copy of a document without child collection properties.
 * Returns only core fields: type, doc_no, name, uuid, content, and extra fields.
 * Does NOT include last_modified.
 */
export function stripChildCollections(doc: ExportAtlasTreeDocument): ExportAtlasTreeBaseDocument {
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

  return stripped as unknown as ExportAtlasTreeBaseDocument;
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
      const ancestryChanged = !arraysEqual(oldAncestry, newAncestry);

      if (fieldsChanged || ancestryChanged) {
        // A document can have multiple types of changes simultaneously.
        // Create separate change records for each type of change.

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
        }

        // If fields changed, record as a separate change (even if parent also changed)
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
  };
}
