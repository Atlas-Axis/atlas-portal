import { AtlasDatabaseName, AtlasDocumentType } from '@/app/server/atlas/atlas-types';
import { ATLAS_DATABASE_ID_MAP } from '@/app/server/atlas/constants';
import type { UuidMappings } from '@/app/server/atlas/load-uuid-mapping';

/**
 * Gets the Atlas database name for a document based on its type.
 *
 * For Core and Active Data Controller, uses the database tracking map
 * to determine the correct database (Sections & Primary Docs vs Agent Scope Database).
 *
 * @param documentType The Atlas document type
 * @param documentUuid The UUID of the document
 * @param uuidToDatabase Map of UUIDs to database names (from buildLookupMaps)
 */
export function getDatabaseNameFromDocument(
  documentType: AtlasDocumentType,
  documentUuid: string,
  uuidToDatabase: Map<string, AtlasDatabaseName>,
): AtlasDatabaseName {
  // Most types have direct mappings
  const directMapping: Partial<Record<AtlasDocumentType, AtlasDatabaseName>> = {
    Scope: 'Scopes',
    Article: 'Articles',
    Section: 'Sections & Primary Docs',
    'Type Specification': 'Sections & Primary Docs',
    Annotation: 'Annotations',
    'Action Tenet': 'Tenets',
    Scenario: 'Scenarios',
    'Scenario Variation': 'Scenario Variations',
    'Active Data': 'Active Data',
    'Needed Research': 'Needed Research',
  };

  const directDatabase = directMapping[documentType];
  if (directDatabase) {
    return directDatabase;
  }

  // Core and Active Data Controller need disambiguation via database tracking
  if (documentType === 'Core' || documentType === 'Active Data Controller') {
    const database = uuidToDatabase.get(documentUuid);
    if (database) {
      return database;
    }

    throw new Error(`Database name not found for document ${documentUuid}`);
  }

  throw new Error(`No database mapping found for document type: ${documentType}`);
}

/**
 * Gets the Notion database ID for a given Atlas database name.
 */
export function getNotionDatabaseIdForDatabaseName(databaseName: AtlasDatabaseName): string {
  return ATLAS_DATABASE_ID_MAP[databaseName];
}

/**
 * Determines if a database supports internal nesting (parent-child within same database).
 * Currently only 'Sections & Primary Docs' and 'Agent Scope Database' support this.
 */
export function databaseSupportsInternalNesting(databaseName: AtlasDatabaseName): boolean {
  return databaseName === 'Sections & Primary Docs' || databaseName === 'Agent Scope Database';
}

/**
 * Result of getting internal parent page ID from ancestry.
 * Contains both the Atlas UUID (for lookup purposes) and the Notion page ID (for API calls).
 */
export interface InternalParentInfo {
  /** The Atlas document UUID of the parent (used for database lookups) */
  atlasUuid: string;
  /** The Notion page ID of the parent (used for Notion API calls and relationship properties) */
  notionPageId: string;
}

/**
 * Gets the internal relationship parent page ID from ancestry array.
 * Returns the parent info (Atlas UUID + Notion page ID) if the parent is in the same Notion database, or null otherwise.
 *
 * This function filters out cross-database parents, as internal parent relationships
 * only exist within the same Notion database (e.g., Section → Core in "Sections & Primary Docs").
 *
 * Returns null in these cases (all valid):
 * - No ancestry provided
 * - Parent is in a different database (cross-database relationship)
 * - Page is a root-level item in its database
 *
 * This is for relationship properties (e.g., "Parent Doc", "Parent item"),
 * not the Notion API parent (which is always the Notion database itself).
 *
 * @param ancestry The ancestry array from the change (contains Atlas document UUIDs)
 * @param childDatabaseName The database name of the child document
 * @param uuidToDatabase Map of UUIDs to database names (from buildLookupMaps)
 * @param uuidMappings UUID mappings for converting Atlas UUIDs to Notion page IDs
 */
export function getInternalParentPageIdFromAncestry(
  ancestry: string[] | undefined,
  childDatabaseName: AtlasDatabaseName,
  uuidToDatabase: Map<string, AtlasDatabaseName>,
  uuidMappings: UuidMappings,
): InternalParentInfo | null {
  if (!ancestry || ancestry.length === 0) {
    return null;
  }

  // Get the immediate parent Atlas UUID (last element in ancestry array)
  const parentAtlasUuid = ancestry[ancestry.length - 1];

  // Derive parent's database name from the database tracking map
  const parentDatabaseName = uuidToDatabase.get(parentAtlasUuid);
  if (!parentDatabaseName) {
    throw new Error(`Parent database not found for document ${parentAtlasUuid}`);
  }

  // Only return parent ID if it's in the same database (internal hierarchy)
  // Cross-database relationships are handled differently (via child_* arrays)
  if (parentDatabaseName !== childDatabaseName) {
    return null;
  }

  // Convert Atlas UUID to Notion page ID
  const notionPageId = uuidMappings.atlasUUIDsToNotionPageIds.get(parentAtlasUuid);
  if (!notionPageId) {
    throw new Error(
      `No Notion page ID mapping found for parent Atlas UUID ${parentAtlasUuid}. ` +
        `This may indicate the parent page hasn't been created yet or the UUID mapping is missing.`,
    );
  }

  // Parent is in the same database - return both IDs for relationship property
  return { atlasUuid: parentAtlasUuid, notionPageId };
}

/**
 * Gets the hierarchy level for an Atlas database based on the Atlas Database Hierarchy.
 * Lower numbers indicate higher position in the hierarchy (Scopes = 0, Scenario Variations = 5).
 *
 * Hierarchy from README.md:
 * - Level 0: Scopes
 * - Level 1: Articles
 * - Level 2: Sections & Primary Docs, Agent Scope Database
 * - Level 3: Annotations, Tenets, Active Data
 * - Level 4: Scenarios
 * - Level 5: Scenario Variations
 * - Needed Research: Special case - uses parent's level + 1
 *
 * @param databaseName The Atlas database name
 * @param parentDatabaseName Optional parent database name (required for Needed Research)
 */
export function getDatabaseHierarchyLevel(
  databaseName: AtlasDatabaseName,
  parentDatabaseName?: AtlasDatabaseName,
): number {
  // Needed Research can be nested under any document type, so use parent's level + 1
  if (databaseName === 'Needed Research') {
    if (parentDatabaseName) {
      return getDatabaseHierarchyLevel(parentDatabaseName) + 1;
    }
    // If no parent, treat as lowest position (for safety)
    return 6;
  }

  // Standard hierarchy levels
  const hierarchyLevels: Record<AtlasDatabaseName, number> = {
    Scopes: 0,
    Articles: 1,
    'Sections & Primary Docs': 2,
    'Agent Scope Database': 2,
    Annotations: 3,
    Tenets: 3,
    'Active Data': 3,
    Scenarios: 4,
    'Scenario Variations': 5,
    'Needed Research': 6, // Fallback if no parent provided
  };

  if (!(databaseName in hierarchyLevels)) {
    throw new Error(`No hierarchy level found for database: ${databaseName}`);
  }

  return hierarchyLevels[databaseName];
}

/**
 * Gets the nesting depth from an ancestry array.
 * Returns 0 for root-level documents (no ancestry), 1 for direct children, etc.
 *
 * @param ancestry The ancestry array (parent UUIDs from immediate parent to root)
 */
export function getAncestryDepth(ancestry: string[] | undefined): number {
  return ancestry?.length ?? 0;
}
