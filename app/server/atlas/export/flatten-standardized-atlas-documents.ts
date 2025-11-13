import { AtlasDatabaseName } from '@/app/server/atlas/atlas-types';
import { traverseStandardizedDocuments } from './standardized-atlas-document-traversal';
import {
  type ChildCollectionName,
  type StandardizedAtlasDocument,
  childCollectionNameToDatabaseName,
  childCollectionNames,
} from './types';

const ALLOWED_DUPLICATE_TYPES = ['Needed Research'];

/**
 * Flattens StandardizedAtlasDocument trees into flat arrays grouped by Atlas database.
 *
 * This is used on the /atlas/list page where we need to render flat lists of documents per database, instead of nested trees.
 *
 * This function mirrors `flattenAtlasScopeTreesToNodesPerDatabase` but works with
 * StandardizedAtlasDocument format instead of AtlasTreeNode.
 *
 * @param scopeDocs - Array of root Scope documents to flatten
 * @returns Record mapping Atlas database names to flat arrays of documents
 *
 * @example
 * ```typescript
 * const flattened = flattenStandardizedAtlasDocuments(scopeTrees);
 * const agentDocs = flattened['Agent Scope Database'];
 * ```
 */
export function flattenStandardizedAtlasDocuments(
  scopeDocs: StandardizedAtlasDocument[],
): Record<AtlasDatabaseName, StandardizedAtlasDocument[]> {
  // Initialize result object with empty arrays for each database
  const flatDocsPerDatabase: Record<AtlasDatabaseName, StandardizedAtlasDocument[]> = {
    Scopes: [],
    Articles: [],
    'Sections & Primary Docs': [],
    Annotations: [],
    Tenets: [],
    Scenarios: [],
    'Scenario Variations': [],
    'Active Data': [],
    'Agent Scope Database': [],
    'Needed Research': [],
  };

  /**
   * Helper type to access and modify child collections
   */
  type MutableDocumentCollections = {
    -readonly [K in ChildCollectionName]?: StandardizedAtlasDocument[];
  };

  // Helper function to normalize document by removing child collections
  const normalizeDocument = (doc: StandardizedAtlasDocument): StandardizedAtlasDocument => {
    // Create a shallow copy with base fields only
    const normalized = { ...doc } as StandardizedAtlasDocument & MutableDocumentCollections;

    // Remove all child collection arrays
    // We need to do this because the flattened documents shouldn't have nested children
    // The child collections will be set to empty arrays based on the document's database type
    for (const key of childCollectionNames) {
      if (key in normalized) {
        normalized[key] = [];
      }
    }

    return normalized as StandardizedAtlasDocument;
  };

  // Keep track of seen UUIDs to prevent duplicates for most types
  const seenUuids = new Set<string>();

  // Traverse all scope trees and flatten
  traverseStandardizedDocuments(
    scopeDocs,
    (doc, depth, _parent, collectionName) => {
      const allowDuplicatesForType = ALLOWED_DUPLICATE_TYPES.includes(doc.type);

      // Determine which database this document belongs to
      let databaseName: AtlasDatabaseName;

      if (depth === 0) {
        // Root documents are always Scopes
        databaseName = 'Scopes';
      } else if (collectionName) {
        // Use the collection name to determine the database
        databaseName = childCollectionNameToDatabaseName[collectionName];
      } else {
        console.warn(
          `[flattenStandardizedAtlasDocuments] Unable to determine database for document: ${doc.uuid || doc.doc_no} (type: ${doc.type})`,
        );
        return true; // Continue traversal
      }

      // Check for duplicates
      if (doc.uuid && seenUuids.has(doc.uuid) && !allowDuplicatesForType) {
        console.warn(
          `[flattenStandardizedAtlasDocuments] Duplicate document detected: ${doc.uuid} - ${doc.name} (type: ${doc.type})`,
        );
        // Continue traversal but don't add to output
        return true;
      }

      // Log duplicates for allowed types
      if (doc.uuid && seenUuids.has(doc.uuid) && allowDuplicatesForType) {
        console.info(
          `[flattenStandardizedAtlasDocuments] Duplicate 'Needed Research' document kept: ${doc.uuid} - ${doc.name}`,
        );
      }

      // Track this UUID
      if (doc.uuid) {
        seenUuids.add(doc.uuid);
      }

      // Normalize and add to appropriate database array
      const normalizedDoc = normalizeDocument(doc);
      flatDocsPerDatabase[databaseName].push(normalizedDoc);

      return true; // Continue traversal
    },
    50, // maxDepth
  );

  return flatDocsPerDatabase;
}
