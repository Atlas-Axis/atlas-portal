import { AtlasDatabaseName, AtlasDocumentType } from '@/app/server/atlas/atlas-types';
import { NotionDatabasePage } from '@/app/server/database/notion-database-page';
import { Json } from '@/app/server/services/supabase/database.types';
import { UuidMappings } from '../load-uuid-mapping';

/**
 * Represents a node in the Notion Atlas Tree (Internal Atlas Representation).
 *
 * This type is almost the same as NotionDatabasePage, but with embedded child relationships,
 * making it suitable for tree traversal and hierarchical operations.
 * Unlike the flat NotionDatabasePage structure that uses ID arrays for children,
 * NotionAtlasTreeNode embeds the actual child nodes for efficient tree operations.
 *
 * This is the Internal Atlas Representation used for tree construction, document numbering,
 * and processing. For external consumption (JSON/Markdown export, APIs), use the
 * Export Tree types (ExportAtlasTreeDocument, etc.) instead.
 */
export interface NotionAtlasTreeNode {
  // All fields from NotionDatabasePage
  notion_page_id: string;
  canonical_document_title?: string | null;
  atlas_document_type: AtlasDocumentType;
  atlas_document_number: string;
  atlas_document_number_sortable?: string;
  atlas_database_name: AtlasDatabaseName;
  has_children: boolean;
  archived: boolean;
  in_trash: boolean;
  last_edited_by_user_id?: string | null;
  plain_text_name?: string | null;
  json_name: Json | null;
  plain_text_content?: string | null;
  json_content: Json | null;
  parent_notion_page_id: string | null;
  extra_fields: Json;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
  date_valid_from?: string | null;
  date_valid_to?: string | null;

  // Tree-specific fields
  /** Generated document number assigned during tree traversal */
  generatedDocID?: string;
  generatedDocName?: string; // TODO: Mimic `makeDocTitle` from PH (see my Raycast notes for logic... Create helper function based on Atlas db name)

  // Embedded child database relationships (replacing ID arrays with actual nodes)
  /** Child Scope documents */
  scopes: NotionAtlasTreeNode[];
  /** Child Article documents */
  articles: NotionAtlasTreeNode[];
  /** Child Section and Primary Doc documents */
  sectionsAndPrimaryDocs: NotionAtlasTreeNode[];
  /** Child Annotation documents */
  annotations: NotionAtlasTreeNode[];
  /** Child Tenet documents */
  tenets: NotionAtlasTreeNode[];
  /** Child Scenario documents */
  scenarios: NotionAtlasTreeNode[];
  /** Child Scenario Variation documents */
  scenarioVariations: NotionAtlasTreeNode[];
  /** Child Active Data documents */
  activeData: NotionAtlasTreeNode[];
  /** Child Agent Scope documents */
  agentScopeDocs: NotionAtlasTreeNode[];
  /** Child Needed Research documents */
  neededResearch: NotionAtlasTreeNode[];
}

// These are based on the Atlas database name, not the document type
export type NotionAtlasTreeNodeRelationship = keyof Pick<
  NotionAtlasTreeNode,
  | 'scopes'
  | 'articles'
  | 'sectionsAndPrimaryDocs'
  | 'annotations'
  | 'tenets'
  | 'scenarios'
  | 'scenarioVariations'
  | 'activeData'
  | 'agentScopeDocs'
  | 'neededResearch'
>;

export const notionAtlasTreeNodeRelationshipNames: NotionAtlasTreeNodeRelationship[] = [
  'scopes',
  'articles',
  'sectionsAndPrimaryDocs',
  'annotations',
  'tenets',
  'scenarios',
  'scenarioVariations',
  'activeData',
  'agentScopeDocs',
  'neededResearch',
];

/**
 * Represents a node that appears under multiple parent nodes in the Notion Atlas Tree.
 */
export interface NotionAtlasTreeDuplicatedNodeEntry {
  /** The ID of the parent node where this node appears */
  parentId: string;
  /** The tree node that appears in multiple locations */
  node: NotionAtlasTreeNode;
}

/**
 * Maps from Atlas UUIDs to document metadata (numbers and names) in the Notion Atlas Tree.
 */
export interface NotionAtlasTreeUUIDToDocNoAndDocNameMaps {
  /** Map from Atlas UUID to document number (`node.generatedDocID` field) */
  atlasUUIDsToGeneratedDocNumbers: Map<string, string>;
  /** Map from Atlas UUID to document name (`node.generatedDocName` field) */
  atlasUUIDsToDocNames: Map<string, string>;
}

/**
 * Result of building the Notion Atlas Tree structure (Internal Atlas Representation).
 * Contains the tree roots and any orphaned documents that couldn't be connected.
 */
export interface NotionAtlasTreeResult extends NotionAtlasTreeUUIDToDocNoAndDocNameMaps {
  /** Array of root Scope trees, one for each top-level Scope document */
  scopeTrees: NotionAtlasTreeNode[];
  /** Documents that exist in the database but are not connected to any root tree */
  orphanedNodes: NotionDatabasePage[]; // TODO: Delete
  /** Orphaned nodes converted to NotionAtlasTreeNode format for consistency */
  orphanedNodesAsTreeNodes: NotionAtlasTreeNode[];
  /** Any errors encountered during tree construction */
  errors: NotionAtlasTreeConstructionError[];
  /** List of nodes that appear in multiple locations with their parent relationships */
  duplicatedNodes: NotionAtlasTreeDuplicatedNodeEntry[];
}

/**
 * Represents an error encountered during Notion Atlas Tree construction.
 */
export interface NotionAtlasTreeConstructionError {
  /** Type of error */
  type: 'missing_child' | 'circular_reference' | 'orphaned_node';
  /** Human-readable error message */
  message: string;
  /** The page ID involved in the error */
  pageId: string;
  /** Additional context for debugging */
  context?: Json;
}

/**
 * Efficient lookup maps for Notion Atlas Tree construction and traversal.
 * These maps provide O(1) access to nodes and relationships.
 */
export interface NotionAtlasTreeLookupMaps {
  /** Map from page ID to NotionAtlasTreeNode for O(1) node access */
  nodeMapByPageId: Map<string, NotionAtlasTreeNode>;
  /** Map from page ID to original NotionDatabasePage for efficient O(1) lookups */
  originalPageMap: Map<string, NotionDatabasePage>;
  /** Map from child page ID to parent page ID for efficient parent lookup */
  parentIdMap: Map<string, string>;
  /** Map from page ID to all its child page IDs for efficient child lookup */
  childrenIdsMap: Map<string, string[]>;
  /** Set of all page IDs that have been processed to detect circular references */
  processedIds: Set<string>; // TODO: Some exceptions are allowed: Needed Research
  /** Map tracking all parent IDs for each node during tree traversal (for duplicate detection) */
  nodeToParentsMap: Map<string, Set<string>>;
}

/**
 * Configuration options for Notion Atlas Tree construction.
 */
export interface NotionAtlasTreeConstructionOptions {
  /** UUID mappings for generating Atlas UUID maps (document numbers and names) */
  uuidMappings: UuidMappings;
  /** Whether to log detailed construction information */
  verbose?: boolean;
  /** Maximum tree depth to prevent infinite recursion */
  maxDepth?: number;
  /** Whether to report missing child nodes as errors (false by default since they're often filtered by NOTION_DATABASE_FILTERS) */
  reportMissingChildNodes?: boolean;
  /** Whether to report orphaned nodes in detail (false by default, only shows count in summary) */
  reportOrphanedNodes?: boolean;
  /** Whether to report duplicated nodes (false by default) */
  reportDuplicatedNodes?: boolean;
}
