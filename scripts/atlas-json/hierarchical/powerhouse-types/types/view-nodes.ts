import type { RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints.js';
import type { TDocType, TNodeContent, TProcessedFile, TSectionDocType } from './processed-data.js';

/**
 * Raw view node containing the original Notion data with incorrect numbering
 * This type preserves the initial state from Notion, including:
 * - Original document hierarchy and relationships
 * - Content with Notion's incorrect numbering in links and mentions
 * - Navigation structure based on slugs
 */
export type RawViewNode = {
  id: string;
  type: TDocType;
  title: ViewNodeTitle;
  content: TNodeContent;
  rawContent: RichTextItemResponse[];
  slugSuffix: string;
  parentSlugSuffix: string | null;
  ancestorSlugSuffixes: string[];
  descendantSlugSuffixes: string[];
  subDocuments: RawViewNode[];
  globalTags: string[];
  originalContextData: string[];
  masterStatus: string | null;
  files: TProcessedFile[];
};

/**
 * Extended view node type with additional properties
 * - markdownContent: Markdown content string
 * - globalTags: Global tags
 */
export type ViewNodeExtended = Omit<RawViewNode, 'content' | 'subDocuments' | 'rawContent'> & {
  content: TProcessedNodeContentItem[];
  subDocuments: ViewNodeExtended[];
  markdownContent: string;
};

/**
 * Processed view node with content updated to use our correct numbering system
 * This type transforms the raw Notion data by:
 * - Replacing all Notion references with correct names based on our numbering system
 * - Processing content into a structured format suitable for display
 * - Maintaining the document hierarchy with corrected references
 * - Preserving navigation and relationship data
 */
export type ViewNode = Omit<
  ViewNodeExtended,
  'subDocuments' | 'globalTags' | 'originalContextData' | 'markdownContent' | 'masterStatus'
> & {
  subDocuments: ViewNode[];
};

/**
 * Map of raw view nodes by ID
 */
export type RawViewNodeMap = Record<string, RawViewNode | undefined>;

/**
 * Map of processed view nodes by ID
 */
export type ViewNodeMap = Record<string, ViewNodeExtended | undefined>;

/**
 * Tree structure of processed view nodes
 */
export type ViewNodeTree = ViewNode[];

/**
 * Title information for a view node
 * Includes formal ID with prefix and number path, display title, and optional type suffix
 */
export type ViewNodeTitle = {
  formalId: {
    prefix: string;
    numberPath: (number | string)[];
  };
  title: string;
  typeSuffix?: string;
};

/**
 * Common properties shared by all items
 * Forms the base for both default and section items
 */
export type CommonNotionDataProperties = {
  id: string;
  docNo: string;
  name: string;
  content: TNodeContent;
  rawContent: RichTextItemResponse[];
  children: string[];
  files: TProcessedFile[];
  globalTags: string[];
  originalContextData: string[];
  masterStatus: string | null;
};

/**
 * Default item type for documents without special processing
 * Extends common properties without section-specific fields
 */
export type DefaultNotionDataItem = CommonNotionDataProperties & {
  type: TDocType;
  parents?: undefined;
  number?: undefined;
  isAgentArtifact?: undefined;
  isSkyPrimitive?: undefined;
};

/**
 * Section item type with additional fields for hierarchy and special flags
 * Used for documents that require special processing
 */
export type SectionNotionDataItem = CommonNotionDataProperties & {
  type: TSectionDocType;
  parents: string[];
  number: number | null;
  isAgentArtifact?: boolean;
  isSkyPrimitive?: boolean;
};

/**
 * Union type of all possible item types
 */
export type NotionDataItem = DefaultNotionDataItem | SectionNotionDataItem;

/**
 * Map of items by ID
 */
export type NotionDataItemsById = Record<string, NotionDataItem>;

/**
 * Utility type to make complex types more readable in IDEs
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * Content type for links in processed view nodes
 */
export type LinkViewNodeContent = {
  type: 'link';
  text: string;
  href: string;
  external: boolean;
};

/**
 * Content type for mentions in processed view nodes
 */
export type MentionViewNodeContent = {
  type: 'mention';
  text: string;
  href: string;
};

/**
 * Content type for equations in processed view nodes
 * Supports both inline and block equations for KaTeX rendering
 */
export type EquationViewNodeContent = {
  type: 'equation';
  variant: 'inline' | 'block';
  text: string;
};

/**
 * Content type for code blocks in processed view nodes
 */
export type CodeViewNodeContent = {
  type: 'code';
  text: string;
};

/**
 * Content type for tables in processed view nodes
 */
export type TableViewNodeContent = {
  type: 'table';
  text: string;
};

/**
 * Content type for paragraphs in processed view nodes
 */
export type ParagraphsViewNodeContent = {
  type: 'paragraphs';
  text: string;
};

/**
 * Union type of all possible processed view node content types
 */
export type TProcessedViewNodeContent =
  | LinkViewNodeContent
  | MentionViewNodeContent
  | EquationViewNodeContent
  | CodeViewNodeContent
  | TableViewNodeContent
  | ParagraphsViewNodeContent;

/**
 * Processed content item with optional heading and array of content elements
 */
export type TProcessedNodeContentItem = {
  heading?: string | null;
  text: TProcessedViewNodeContent[];
};
