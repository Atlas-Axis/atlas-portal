import { AtlasDatabaseName, AtlasDocumentType } from '@/app/server/atlas/atlas-types';
import { AGENT_ROOT_SECTION_UUIDS_MAPPED, ATLAS_DATABASE_ID_MAP } from '@/app/server/atlas/constants';
import { ExportAtlasTreeBaseDocument } from '@/app/server/atlas/export/types';

/**
 * Gets the Atlas database name for a document based on its type and ancestry.
 *
 * Most document types map directly to a specific database (e.g., Scope→Scopes).
 * Core and Active Data Controller types require disambiguation based on ancestry:
 * - If any ancestor matches a known agent root section UUID, returns 'Agent Scope Database'
 * - Otherwise, returns 'Sections & Primary Docs'
 *
 * This approach mirrors the logic from atlas-markdown-importer.ts and works for both
 * existing documents (in Supabase) and new documents (only in Markdown).
 *
 * @param documentType The Atlas document type
 * @param ancestryUuids Array of ancestor UUIDs from immediate parent to root
 */
export function getDatabaseNameFromDocument(
  documentType: AtlasDocumentType,
  ancestryUuids: string[] | undefined,
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

  // Core and Active Data Controller need disambiguation by ancestry
  if (documentType === 'Core' || documentType === 'Active Data Controller') {
    // Check if any ancestor UUID matches a known agent root section
    const isUnderAgentRoot = ancestryUuids?.some((ancestorUuid) => {
      // Compare against mapped Atlas UUIDs of agent root sections
      for (const mapped of AGENT_ROOT_SECTION_UUIDS_MAPPED.values()) {
        if (ancestorUuid === mapped) return true;
      }
      return false;
    });

    return isUnderAgentRoot ? 'Agent Scope Database' : 'Sections & Primary Docs';
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
 * Gets the internal relationship parent page ID from ancestry array.
 * Returns the immediate parent UUID if it's in the same Notion database, or null otherwise.
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
 * @param ancestry The ancestry array from the change
 * @param childDatabaseName The database name of the child document
 * @param uuidToDocumentMap Map of UUIDs to document objects for deriving parent database
 */
export function getInternalParentPageIdFromAncestry(
  ancestry: string[] | undefined,
  childDatabaseName: AtlasDatabaseName,
  uuidToDocumentMap: Map<string, ExportAtlasTreeBaseDocument>,
): string | null {
  if (!ancestry || ancestry.length === 0) {
    return null;
  }

  // Get the immediate parent UUID (last element in ancestry array)
  const potentialParentId = ancestry[ancestry.length - 1];

  // Get parent document to determine its database
  const parentDoc = uuidToDocumentMap.get(potentialParentId);
  if (!parentDoc) {
    // Parent document not found - might be a new document or invalid reference
    return null;
  }

  // Derive parent's database name from its type and ancestry
  // Get parent's ancestry (all ancestors except the last one which is the parent itself)
  const parentAncestry = ancestry.slice(0, -1);
  const parentDatabaseName = getDatabaseNameFromDocument(parentDoc.type, parentAncestry);

  // Only return parent ID if it's in the same database (internal hierarchy)
  // Cross-database relationships are handled differently (via child_* arrays)
  if (parentDatabaseName !== childDatabaseName) {
    return null;
  }

  // Parent is in the same database - return it for relationship property
  return potentialParentId;
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
