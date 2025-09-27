import { Json } from '@/app/server/services/supabase/database.types';
import { NotionDatabasePage } from '../../app/server/database/notion-database-page';
import { AtlasDatabaseName, AtlasDocumentType } from '../../app/server/services/atlas/constants';

/**
 * Represents a node in the Atlas document tree structure.
 *
 * This type is almost the same as NotionDatabasePage, but with embedded child relationships,
 * making it suitable for tree traversal and hierarchical operations.
 * Unlike the flat NotionDatabasePage structure that uses ID arrays for children,
 * AtlasTreeNode embeds the actual child nodes for efficient tree operations.
 */
export interface AtlasTreeNode {
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

  // Embedded child relationships (replacing ID arrays with actual nodes)
  /** Child Scope documents */
  scopes: AtlasTreeNode[];
  /** Child Article documents */
  articles: AtlasTreeNode[];
  /** Child Section and Primary Doc documents */
  sectionsAndPrimaryDocs: AtlasTreeNode[];
  /** Child Annotation documents */
  annotations: AtlasTreeNode[];
  /** Child Tenet documents */
  tenets: AtlasTreeNode[];
  /** Child Scenario documents */
  scenarios: AtlasTreeNode[];
  /** Child Scenario Variation documents */
  scenarioVariations: AtlasTreeNode[];
  /** Child Active Data documents */
  activeData: AtlasTreeNode[];
  /** Child Agent Scope documents */
  agentScopeDocs: AtlasTreeNode[];
  /** Child Needed Research documents */
  neededResearch: AtlasTreeNode[];
}

export type AtlasTreeNodeRelationship = keyof Pick<
  AtlasTreeNode,
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

/**
 * Result of building the Atlas tree structure.
 * Contains the tree roots and any orphaned documents that couldn't be connected.
 */
export interface AtlasTreeResult {
  /** Array of root Scope trees, one for each top-level Scope document */
  scopeTrees: AtlasTreeNode[];
  /** Documents that exist in the database but are not connected to any root tree */
  orphanedNodes: NotionDatabasePage[];
  /** Any errors encountered during tree construction */
  errors: TreeConstructionError[];
}

/**
 * Represents an error encountered during tree construction.
 */
export interface TreeConstructionError {
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
 * Efficient lookup maps for tree construction and traversal.
 * These maps provide O(1) access to nodes and relationships.
 */
export interface AtlasLookupMaps {
  /** Map from page ID to AtlasTreeNode for O(1) node access */
  nodeMapByPageId: Map<string, AtlasTreeNode>;
  /** Map from page ID to original NotionDatabasePage for efficient O(1) lookups */
  originalPageMap: Map<string, NotionDatabasePage>;
  /** Map from child page ID to parent page ID for efficient parent lookup */
  parentIdMap: Map<string, string>;
  /** Map from page ID to all its child page IDs for efficient child lookup */
  childrenIdsMap: Map<string, string[]>;
  /** Set of all page IDs that have been processed to detect circular references */
  processedIds: Set<string>; // TODO: Some exceptions are allowed: Needed Research
}

/**
 * Configuration options for tree construction.
 */
export interface TreeConstructionOptions {
  /** Whether to assign document numbers during tree construction */
  assignDocumentNumbers?: boolean;
  /** Whether to log detailed construction information */
  verbose?: boolean;
  /** Maximum tree depth to prevent infinite recursion */
  maxDepth?: number;
  /** Whether to report missing child nodes as errors (false by default since they're often filtered by NOTION_DATABASE_FILTERS) */
  reportMissingChildNodes?: boolean;
}
