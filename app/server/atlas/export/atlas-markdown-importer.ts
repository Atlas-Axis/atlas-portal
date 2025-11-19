/**
 * Atlas Markdown Importer
 *
 * Converts a Markdown document produced by `buildAtlasMarkdown()` into
 * `ExportAtlasTreeScopeTrees` (the Export Atlas tree shape grouped by
 * Atlas database/child collection names).
 *
 * Input format (per document):
 * - A title line: `#### A.1.2 - Name [Type]  <!-- UUID: x-y-z -->`
 *   - The number of `#` indicates heading level (capped at 6), NOT semantic depth.
 *   - Includes document number, name, Atlas document type, and UUID comment.
 * - Body lines until the next title line belong to that document.
 * - Certain types (Type Specification, Scenario, Scenario Variation) may include
 *   structured extra fields below the content using bold labels like
 *   `**Finding**: ...`. Only labels defined in the type-specific mappings are
 *   recognized and extracted; all other lines remain in `content`.
 *
 * Algorithm:
 * - Scan the file line-by-line. A title line starts a new document; all other
 *   lines are appended to the current document body buffer.
 * - For each new document, resolve its Atlas database using `mapTypeToDatabase()`:
 *   - Most types map directly (e.g., Scope→Scopes, Article→Articles).
 *   - Core and Active Data Controller require disambiguation between "Sections & Primary Docs"
 *     and "Agent Scope Database":
 *     1. If immediate parent's name matches AGENT_ROOT_DOCUMENT_NAME → Agent Scope Database
 *     2. If any ancestor in the chain is from Agent Scope Database → Agent Scope Database
 *     3. Otherwise → Sections & Primary Docs
 *   - This is the ONLY place in the codebase where Agent Scope Database detection occurs.
 *     Once determined, the database is encoded as a collection name in the Export Tree.
 *     Downstream code (diff algorithms, sync library) simply reads these collection names.
 * - Use document numbers (not heading depth) to determine parent-child relationships.
 *   Stack management uses findParentDocNumber() to match documents by doc_no patterns.
 *   Children are inserted into the correct collection using the allowed parent→child
 *   database mapping. This approach handles heading levels capped at 6 correctly.
 * - When finalizing a document, extract structured extra fields (when
 *   applicable) and trim only one leading and one trailing separator blank line
 *   from the content segment, preserving author-intended whitespace.
 */
import { type AtlasDatabaseName, type AtlasDocumentType } from '@/app/server/atlas/atlas-types';
import { AGENT_ROOT_DOCUMENT_NAME } from '@/app/server/atlas/constants';
import {
  NEEDED_RESEARCH_PROPERTY_MAPPING,
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '../notion-mapping/notion-database-properties-and-relationships';
import { findParentDocNumber } from './atlas-markdown-depth-utils';
import {
  type ChildCollectionName,
  type ExportAtlasTreeActiveDataDocument,
  type ExportAtlasTreeAgentScopeDatabaseDocument,
  type ExportAtlasTreeAnnotationsDocument,
  type ExportAtlasTreeArticlesDocument,
  type ExportAtlasTreeBaseDocument,
  type ExportAtlasTreeDocument,
  type ExportAtlasTreeNeededResearchDocument,
  type ExportAtlasTreeScenarioVariationsDocument,
  type ExportAtlasTreeScenariosDocument,
  type ExportAtlasTreeScopeTrees,
  type ExportAtlasTreeScopesDocument,
  type ExportAtlasTreeSectionsAndPrimaryDocsDocument,
  type ExportAtlasTreeTenetsDocument,
  allowedChildCollectionNamesPerDatabase,
  childCollectionNameToDatabaseName,
} from './types';

type DatabaseToChildCollections = Record<AtlasDatabaseName, Record<AtlasDatabaseName, ChildCollectionName | undefined>>;

const HEADER_REGEX = /^(#+)\s+([^\s]+)\s+-\s+(.*?)\s+\[(.+?)\]\s+<!--\s*UUID:\s*([a-f0-9-]*)\s*-->\s*$/i;

interface ParsedHeader {
  depth: number;
  docNo: string;
  name: string;
  type: AtlasDocumentType;
  uuid: string | null;
}

interface StackItem {
  node: ExportAtlasTreeDocument;
  database: AtlasDatabaseName;
  uuid: string | null;
  depth: number;
}

/**
 * Main entry point: Parse Atlas Markdown into a structured tree of Export Atlas documents.
 *
 * Algorithm overview:
 * 1. Scan line-by-line: title lines start new documents, other lines are content
 * 2. Use document numbers (not heading depth) to determine parent-child relationships
 *    - This allows heading levels to be capped at 6 while maintaining correct hierarchy
 *    - Stack management based on matching doc_no patterns via findParentDocNumber()
 * 3. Disambiguate document database using type and ancestry (Core/ADC check agent roots)
 * 4. Insert children into correct typed collections based on parent→child database mappings
 * 5. Extract structured extra fields for specific types (Type Spec, Scenario, etc.)
 */
export function parseAtlasMarkdown(markdown: string): ExportAtlasTreeScopeTrees {
  // High-level: convert a single Markdown string into an in-memory tree of export Atlas documents
  const lines = markdown.split(/\r?\n/);

  const rootScopes: ExportAtlasTreeScopeTrees = [];
  const stack: StackItem[] = [];

  let currentItem: StackItem | null = null;
  let contentBuffer: string[] = [];

  // Precompute mapping from parent DB to the allowed child collection name for each child DB
  const dbToChild: DatabaseToChildCollections = buildDatabaseChildCollectionLookup();

  /**
   * Finalize the current document: extract structured extra fields (if applicable),
   * normalize content separators, and attach them to the node.
   */
  const flushCurrent = () => {
    if (!currentItem) return;
    // Trim trailing blank lines
    const parsed = extractContentAndExtraFields(
      (currentItem.node as unknown as ExportAtlasTreeBaseDocument).type,
      contentBuffer,
    );
    if (parsed.extra) {
      const asRecord = currentItem.node as unknown as Record<string, unknown>;
      for (const [k, v] of Object.entries(parsed.extra)) asRecord[k] = v;
    }
    (currentItem.node as unknown as ExportAtlasTreeBaseDocument).content = parsed.content;
    contentBuffer = [];
  };

  for (const line of lines) {
    // Titles start new documents; anything else is part of the current document content
    const header = parseHeaderLine(line);
    if (!header) {
      // Accumulate content for current doc
      contentBuffer.push(line);
      continue;
    }

    // New document starts; finalize previous
    flushCurrent();

    // Determine database from type and ancestry (Core/ADC: check parent database)
    const database = mapTypeToDatabase(header.type, stack);

    // Create a node shape consistent with the resolved database (correct child collections present)
    const node = createNodeForDatabase(
      {
        type: header.type,
        doc_no: header.docNo,
        name: header.name,
        uuid: header.uuid,
      },
      database,
    );

    const item: StackItem = { node, database, uuid: header.uuid, depth: header.depth };

    // Find the correct parent using document numbers instead of heading depth
    // This allows us to cap heading levels at 6 while maintaining correct hierarchy
    const parentDocNo = findParentDocNumber(header.docNo, header.type);

    // Pop stack to find the parent document by doc_no
    // For Needed Research (parentDocNo is null), use the top of stack as parent
    if (parentDocNo === null && header.type === 'Needed Research') {
      // Needed Research: attach to the most recent document in stack
      // Don't pop anything, just use current stack top as parent
    } else if (parentDocNo === null) {
      // Root-level document (Scope) - clear the stack
      while (stack.length > 0) {
        stack.pop();
      }
    } else {
      // Find the parent by matching doc_no
      // Pop until we find the parent or reach a shallower level
      while (stack.length > 0) {
        const top = stack[stack.length - 1];
        if ((top.node as ExportAtlasTreeBaseDocument).doc_no === parentDocNo) {
          // Found the parent, stop popping
          break;
        }
        // If we've gone too shallow (popped past where parent should be), stop
        // This handles malformed input gracefully
        const topDocNo = (top.node as ExportAtlasTreeBaseDocument).doc_no;
        if (parentDocNo.startsWith(topDocNo + '.')) {
          // Parent should be between here and top, but it's missing
          // Keep this item and attach as child (best effort)
          console.warn(`Parent document ${topDocNo} is missing for child ${header.docNo} (${header.type}).`);
          break;
        }
        stack.pop();
      }
    }

    if (stack.length === 0) {
      // This is a root-level Scope document
      rootScopes.push(item.node);
    } else {
      // Attach as child to parent using the appropriate typed collection name
      const parent = stack[stack.length - 1];
      const collection = getChildCollectionName(parent.database, database, dbToChild);
      if (!collection) {
        throw new Error(
          `No child collection mapping from parent database '${parent.database}' to child database '${database}' for doc ${header.docNo} (${header.type}).`,
        );
      }
      pushChildIntoCollection(parent.node, collection, item.node);

      // Post-insert cleanup: remove empty cross-database collections to avoid misleading empty arrays
      // - If parent is 'Sections & Primary Docs' and agent_scope_database stays empty, omit it
      // - If parent is 'Agent Scope Database', never keep sections_and_primary_docs on parent
      if (parent.database === 'Sections & Primary Docs') {
        const p = parent.node as unknown as { agent_scope_database?: unknown[] };
        if (Array.isArray(p.agent_scope_database) && p.agent_scope_database.length === 0) {
          delete (p as Record<string, unknown>).agent_scope_database;
        }
      } else if (parent.database === 'Agent Scope Database') {
        const p = parent.node as unknown as { sections_and_primary_docs?: unknown[] };
        if (Array.isArray(p.sections_and_primary_docs) && p.sections_and_primary_docs.length === 0) {
          delete (p as Record<string, unknown>).sections_and_primary_docs;
        }
      }
    }

    stack.push(item);
    currentItem = item;
  }

  // Finalize last doc
  flushCurrent();

  return rootScopes;
}

/**
 * Parse a title line in Atlas Markdown format.
 *
 * Expected format: `#### A.1.2 - Name [Type]  <!-- UUID: x-y-z -->`
 * - Number of `#` symbols indicates depth (more `#` = deeper in tree)
 * - Document number (e.g., "A.1.2")
 * - Name
 * - Atlas document type in brackets
 * - UUID in HTML comment
 *
 * Returns null if the line doesn't match the expected format.
 */
function parseHeaderLine(line: string): ParsedHeader | null {
  const matches = line.match(HEADER_REGEX);
  if (!matches) return null;
  const [, hashes, docNo, name, typeStr, uuidStr] = matches;
  const depth = hashes.length; // '#' → 1 for roots
  const type = typeStr as AtlasDocumentType;
  const uuid = uuidStr && uuidStr.length > 0 ? uuidStr : null;
  return { depth, docNo, name, type, uuid };
}

/**
 * Normalize content separators: remove all leading/trailing blank lines,
 * but preserve internal spacing exactly as authored.
 */
function normalizeContentSeparators(lines: string[]): string {
  let start = 0;
  while (start < lines.length && lines[start].trim() === '') start++;
  let end = lines.length - 1;
  while (end >= start && lines[end].trim() === '') end--;
  const middle = lines.slice(start, end + 1);
  return middle.join('\n');
}

type ExtraMap = Partial<Record<string, string | null>>;

/**
 * Extract content and structured extra fields from document body lines.
 *
 * Only certain document types have structured extra fields (Type Specification,
 * Scenario, Scenario Variation, Needed Research). For these types:
 * - Content ends at the first recognized labeled line like `**Label**:`
 * - All following labeled lines and their values become extra fields
 * - All expected fields are initialized to empty strings even if not present
 *
 * For other types, returns all lines as content with no extra fields.
 */
function extractContentAndExtraFields(
  type: AtlasDocumentType,
  rawLines: string[],
): { content: string; extra: ExtraMap | null } {
  // We only parse extra fields for these types
  const typeToMapping: Record<string, Record<string, string>> = {
    'Type Specification': TYPE_SPECIFICATION_PROPERTY_MAPPING,
    Scenario: SCENARIO_PROPERTY_MAPPING,
    'Scenario Variation': SCENARIO_VARIATION_PROPERTY_MAPPING,
    'Needed Research': NEEDED_RESEARCH_PROPERTY_MAPPING,
  };

  const mapping = typeToMapping[type];
  if (!mapping) {
    // No structured fields for this type; normalize to keep exactly one leading separator
    const content = normalizeContentSeparators(rawLines);
    return { content, extra: null };
  }

  // Build reverse lookup: label -> fieldKey
  const labelToFieldKey = new Map<string, string>();
  for (const [fieldKey, label] of Object.entries(mapping)) {
    labelToFieldKey.set(label, fieldKey);
  }

  // Detect the first line that matches "**Label**:" with a known label
  const lines = rawLines.slice();
  let firstIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const label = parseLabeledLine(lines[i]);
    if (label && labelToFieldKey.has(label)) {
      firstIdx = i;
      break;
    }
  }

  if (firstIdx === -1) {
    // No structured fields found; normalize separators
    const content = normalizeContentSeparators(lines);
    return { content, extra: null };
  }

  const content = normalizeContentSeparators(lines.slice(0, firstIdx));

  // Initialize all expected fields to empty strings
  const extra: ExtraMap = {};
  for (const fieldKey of Object.keys(mapping)) {
    extra[fieldKey] = '';
  }

  // Parse extra fields: accumulate all lines for each field until the next labeled line
  let currentFieldKey: string | null = null;
  let currentFieldLines: string[] = [];

  const flushField = () => {
    if (currentFieldKey && currentFieldLines.length > 0) {
      // Normalize the field value: trim leading/trailing blank lines
      let start = 0;
      while (start < currentFieldLines.length && currentFieldLines[start].trim() === '') start++;
      let end = currentFieldLines.length - 1;
      while (end >= start && currentFieldLines[end].trim() === '') end--;
      const trimmedLines = currentFieldLines.slice(start, end + 1);
      extra[currentFieldKey] = trimmedLines.join('\n');
    }
  };

  for (let i = firstIdx; i < lines.length; i++) {
    const label = parseLabeledLine(lines[i]);
    if (label && labelToFieldKey.has(label)) {
      // New field starts; flush previous
      flushField();
      currentFieldKey = labelToFieldKey.get(label)!;
      currentFieldLines = [];
    } else {
      // Continuation of current field (value content)
      if (currentFieldKey) {
        currentFieldLines.push(lines[i]);
      }
    }
  }

  // Flush last field
  flushField();

  return { content, extra };
}

const LABELED_LINE_REGEX = /^\*\*(.+?)\*\*:\s*$/;

/**
 * Parse a labeled line in the format `**Label**:`
 * Returns the label text if matched, null otherwise.
 */
function parseLabeledLine(line: string): string | null {
  const m = line.match(LABELED_LINE_REGEX);
  if (!m) return null;
  const [, rawLabel] = m;
  return rawLabel.trim();
}

/**
 * Map an Atlas document type to its Atlas database name.
 *
 * Most types map directly to a specific database (e.g., Scope→Scopes, Article→Articles).
 *
 * CRITICAL DISAMBIGUATION: Core and Active Data Controller can belong to either:
 * - "Sections & Primary Docs"
 * - "Agent Scope Database" (if parent is from Agent Scope Database)
 *
 * This parent database check is essential because Core documents appear in both databases
 * but must be routed correctly based on their hierarchical context.
 *
 * @param type - The Atlas document type from the title line
 * @param ancestors - Stack of parent documents to check parent database
 * @returns The Atlas database name where this document belongs
 */
function mapTypeToDatabase(type: AtlasDocumentType, ancestors: StackItem[]): AtlasDatabaseName {
  switch (type) {
    case 'Scope':
      return 'Scopes';
    case 'Article':
      return 'Articles';
    case 'Section':
    case 'Type Specification':
      return 'Sections & Primary Docs';
    case 'Core':
    case 'Active Data Controller': {
      // Check if parent is the agent root section by name
      const parentIsAgentRoot =
        ancestors.length > 0 && ancestors[ancestors.length - 1].node.name === AGENT_ROOT_DOCUMENT_NAME;

      if (parentIsAgentRoot) {
        return 'Agent Scope Database';
      }

      // Also check if ANY ancestor in the chain is from Agent Scope Database
      // This handles nested Core → Core → Core under the agent root
      const hasAgentAncestor = ancestors.some((a) => a.database === 'Agent Scope Database');
      if (hasAgentAncestor) {
        return 'Agent Scope Database';
      }

      // Default to Sections & Primary Docs
      return 'Sections & Primary Docs';
    }
    case 'Annotation':
      return 'Annotations';
    case 'Action Tenet':
      return 'Tenets';
    case 'Scenario':
      return 'Scenarios';
    case 'Scenario Variation':
      return 'Scenario Variations';
    case 'Active Data':
      return 'Active Data';
    case 'Needed Research':
      return 'Needed Research';
    default:
      // Exhaustiveness guard
      throw new Error(`Unsupported AtlasDocumentType: ${type}`);
  }
}

/**
 * Build lookup table: for each parent database, map child database names to
 * the correct typed child collection name.
 *
 * Example: When a "Sections & Primary Docs" parent has an "Annotation" child,
 * the child must be inserted into the parent's "Annotations" collection.
 *
 * This precomputed lookup enables fast O(1) resolution during tree building.
 */
function buildDatabaseChildCollectionLookup(): DatabaseToChildCollections {
  const out = {} as DatabaseToChildCollections;
  (Object.keys(allowedChildCollectionNamesPerDatabase) as AtlasDatabaseName[]).forEach((parentDb) => {
    const allowedCollections = allowedChildCollectionNamesPerDatabase[parentDb];
    const map: Record<AtlasDatabaseName, ChildCollectionName | undefined> = {
      Scopes: undefined,
      Articles: undefined,
      'Sections & Primary Docs': undefined,
      Annotations: undefined,
      Tenets: undefined,
      Scenarios: undefined,
      'Scenario Variations': undefined,
      'Active Data': undefined,
      'Agent Scope Database': undefined,
      'Needed Research': undefined,
    } as Record<AtlasDatabaseName, ChildCollectionName | undefined>;

    for (const coll of allowedCollections) {
      const childDb = childCollectionNameToDatabaseName[coll];
      map[childDb] = coll;
    }
    out[parentDb] = map;
  });
  return out;
}

/**
 * Get the child collection name for inserting a child document into its parent.
 *
 * Uses the precomputed lookup to find which typed collection field
 * (e.g., "articles", "sections_and_primary_docs") should receive the child.
 */
function getChildCollectionName(
  parentDb: AtlasDatabaseName,
  childDb: AtlasDatabaseName,
  lookup: DatabaseToChildCollections,
): ChildCollectionName | undefined {
  const byChild = lookup[parentDb];
  return byChild ? byChild[childDb] : undefined;
}

/**
 * Insert a child document into its parent's appropriate typed collection.
 *
 * Ensures the collection array exists before pushing.
 */
function pushChildIntoCollection(
  parent: ExportAtlasTreeDocument,
  collection: ChildCollectionName,
  child: ExportAtlasTreeDocument,
) {
  type ParentWithCollections = ExportAtlasTreeDocument &
    Partial<Record<ChildCollectionName, ExportAtlasTreeDocument[]>>;
  const p = parent as ParentWithCollections;
  if (!Array.isArray(p[collection])) p[collection] = [];
  p[collection]!.push(child);
}

/**
 * Create a document node with the correct shape for its Atlas database.
 *
 * Each database type has specific child collection fields:
 * - Scopes: articles[]
 * - Articles: sections_and_primary_docs[], annotations[], needed_research[]
 * - Sections & Primary Docs: sections_and_primary_docs[], annotations[], tenets[], active_data[], needed_research[]
 * - Agent Scope Database: agent_scope_database[], annotations[], tenets[], active_data[], needed_research[]
 * - And so on...
 *
 * This ensures type safety and correct structure for the Export Atlas tree.
 */
function createNodeForDatabase(
  base: { type: AtlasDocumentType; doc_no: string; name: string; uuid: string | null },
  database: AtlasDatabaseName,
): ExportAtlasTreeDocument {
  const common = {
    type: base.type,
    doc_no: base.doc_no,
    name: base.name,
    uuid: base.uuid,
    last_modified: '',
    content: '',
  } as const;

  switch (database) {
    case 'Scopes':
      return { ...common, articles: [] } as ExportAtlasTreeScopesDocument;
    case 'Articles':
      return {
        ...common,
        sections_and_primary_docs: [],
        annotations: [],
        needed_research: [],
      } as ExportAtlasTreeArticlesDocument;
    case 'Sections & Primary Docs':
      return {
        ...common,
        sections_and_primary_docs: [],
        annotations: [],
        tenets: [],
        active_data: [],
        needed_research: [],
      } as ExportAtlasTreeSectionsAndPrimaryDocsDocument;
    case 'Annotations':
      return { ...common, needed_research: [] } as ExportAtlasTreeAnnotationsDocument;
    case 'Tenets':
      return { ...common, scenarios: [], needed_research: [] } as ExportAtlasTreeTenetsDocument;
    case 'Scenarios':
      return { ...common, scenario_variations: [], needed_research: [] } as ExportAtlasTreeScenariosDocument;
    case 'Scenario Variations':
      return { ...common, needed_research: [] } as ExportAtlasTreeScenarioVariationsDocument;
    case 'Active Data':
      return { ...common, needed_research: [] } as ExportAtlasTreeActiveDataDocument;
    case 'Agent Scope Database':
      return {
        ...common,
        agent_scope_database: [],
        annotations: [],
        tenets: [],
        active_data: [],
        needed_research: [],
      } as ExportAtlasTreeAgentScopeDatabaseDocument;
    case 'Needed Research':
      return { ...common } as ExportAtlasTreeNeededResearchDocument;
    default:
      throw new Error(`Unsupported Atlas database: ${database}`);
  }
}
