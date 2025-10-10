/**
 * Atlas Markdown Importer
 *
 * Converts a Markdown document produced by `buildAtlasMarkdown()` into
 * `StandardizedAtlasScopeTrees` (the standardized Atlas tree shape grouped by
 * Atlas database/child collection names).
 *
 * Input format (per document):
 * - A title line: `#### A.1.2 - Name [Type]  <!-- UUID: x-y-z -->`
 *   - The number of `#` indicates depth in the tree (parent before children).
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
 * - For each new document, resolve its Atlas database:
 *   - Most types map directly (e.g., Scope→Scopes, Article→Articles).
 *   - Core and Active Data Controller are disambiguated using ancestry: if any
 *     ancestor UUID matches one of the known agent root section UUIDs, they
 *     belong to the `Agent Scope Database`; otherwise to `Sections & Primary Docs`.
 * - Use a stack keyed by heading depth to attach new documents as children of
 *   the nearest shallower parent. Children are inserted into the correct
 *   collection using the allowed parent→child database mapping.
 * - When finalizing a document, extract structured extra fields (when
 *   applicable) and trim only one leading and one trailing separator blank line
 *   from the content segment, preserving author-intended whitespace.
 */
import {
  AGENT_ROOT_SECTION_UUIDS,
  AGENT_ROOT_SECTION_UUID_FOR_NESTING,
  type AtlasDatabaseName,
  type AtlasDocumentType,
} from '@/app/server/atlas/constants';
import {
  SCENARIO_PROPERTY_MAPPING,
  SCENARIO_VARIATION_PROPERTY_MAPPING,
  TYPE_SPECIFICATION_PROPERTY_MAPPING,
} from '../notion-database-properties-and-relationships';
import {
  type ActiveDataDocument,
  type AgentScopeDatabaseDocument,
  type AnnotationsDocument,
  type ArticlesDocument,
  type BaseAtlasDocument,
  type ChildCollectionName,
  type NeededResearchDocument,
  type ScenarioVariationsDocument,
  type ScenariosDocument,
  type ScopesDocument,
  type SectionsAndPrimaryDocsDocument,
  type StandardizedAtlasDocument,
  type StandardizedAtlasScopeTrees,
  type TenetsDocument,
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
  node: StandardizedAtlasDocument;
  database: AtlasDatabaseName;
  uuid: string | null;
  depth: number;
}

export function parseAtlasMarkdown(markdown: string): StandardizedAtlasScopeTrees {
  // High-level: convert a single Markdown string into an in-memory tree of standardized Atlas documents
  const lines = markdown.split(/\r?\n/);

  const rootScopes: StandardizedAtlasScopeTrees = [];
  const stack: StackItem[] = [];

  let currentItem: StackItem | null = null;
  let contentBuffer: string[] = [];

  // Precompute mapping from parent DB to the allowed child collection name for each child DB
  const dbToChild: DatabaseToChildCollections = buildDatabaseChildCollectionLookup();

  const flushCurrent = () => {
    if (!currentItem) return;
    // Trim trailing blank lines
    const parsed = extractContentAndExtraFields((currentItem.node as unknown as BaseAtlasDocument).type, contentBuffer);
    (currentItem.node as unknown as BaseAtlasDocument).content = parsed.content;
    if (parsed.extra) {
      const asRecord = currentItem.node as unknown as Record<string, unknown>;
      for (const [k, v] of Object.entries(parsed.extra)) asRecord[k] = v;
    }
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

    // Determine database from type and ancestry
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

    // Re-stack to proper parent level
    while (stack.length > 0 && stack[stack.length - 1].depth >= header.depth) {
      stack.pop();
    }

    if (stack.length === 0) {
      rootScopes.push(item.node);
    } else {
      const parent = stack[stack.length - 1];
      const collection = getChildCollectionName(parent.database, database, dbToChild);
      if (!collection) {
        throw new Error(
          `No child collection mapping from parent database '${parent.database}' to child database '${database}' for doc ${header.docNo} (${header.type}).`,
        );
      }
      pushChildIntoCollection(parent.node, collection, item.node);
    }

    stack.push(item);
    currentItem = item;
  }

  // Finalize last doc
  flushCurrent();

  return rootScopes;
}

function parseHeaderLine(line: string): ParsedHeader | null {
  const matches = line.match(HEADER_REGEX);
  if (!matches) return null;
  const [, hashes, docNo, name, typeStr, uuidStr] = matches;
  const depth = hashes.length; // '#' → 1 for roots
  const type = typeStr as AtlasDocumentType;
  const uuid = uuidStr && uuidStr.length > 0 ? uuidStr : null;
  return { depth, docNo, name, type, uuid };
}

function trimOneLeadingBlankLine(lines: string[]): string[] {
  if (lines.length > 0 && lines[0].trim() === '') {
    return lines.slice(1);
  }
  return lines;
}

function trimOneTrailingBlankLine(lines: string[]): string[] {
  if (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    return lines.slice(0, lines.length - 1);
  }
  return lines;
}

function trimSeparators(lines: string[], opts: { leading?: boolean; trailing?: boolean } = {}): string {
  let out = lines;
  if (opts.leading) out = trimOneLeadingBlankLine(out);
  if (opts.trailing) out = trimOneTrailingBlankLine(out);
  return out.join('\n');
}

// Normalize separators to ensure: at most one blank line at the start; ensure content ends with a newline
function normalizeContentSeparators(lines: string[]): string {
  // Remove all leading blank lines and then add exactly one leading blank separator
  let start = 0;
  while (start < lines.length && lines[start].trim() === '') start++;
  // Remove all trailing blank lines
  let end = lines.length - 1;
  while (end >= start && lines[end].trim() === '') end--;
  const middle = lines.slice(start, end + 1);
  // Compose with exactly one leading blank and exactly one trailing newline
  const composed = [''].concat(middle).join('\n');
  return composed.endsWith('\n') ? composed : composed + '\n';
}

type ExtraMap = Partial<Record<string, string | null>>;

function extractContentAndExtraFields(
  type: AtlasDocumentType,
  rawLines: string[],
): { content: string; extra: ExtraMap | null } {
  // We only parse extra fields for these types
  const typeToMapping: Record<string, Record<string, string>> = {
    'Type Specification': TYPE_SPECIFICATION_PROPERTY_MAPPING,
    Scenario: SCENARIO_PROPERTY_MAPPING,
    'Scenario Variation': SCENARIO_VARIATION_PROPERTY_MAPPING,
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

  // Detect the first line that matches "**Label**: value" with a known label
  const lines = rawLines.slice();
  let firstIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const { label } = parseLabeledLine(lines[i]);
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
  const extra: ExtraMap = {};

  for (let i = firstIdx; i < lines.length; i++) {
    const { label, value } = parseLabeledLine(lines[i]);
    if (!label) continue;
    const key = labelToFieldKey.get(label);
    if (!key) continue; // ignore unknown labels
    extra[key] = value ?? '';
  }

  return { content, extra };
}

const LABELED_LINE_REGEX = /^\*\*(.+?)\*\*:\s*(.*)$/;

function parseLabeledLine(line: string): { label: string | null; value: string | null } {
  const m = line.match(LABELED_LINE_REGEX);
  if (!m) return { label: null, value: null };
  const [, rawLabel, rawValue] = m;
  return { label: rawLabel.trim(), value: (rawValue ?? '').trim() };
}

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
      // Disambiguate by ancestry: if descendant of agent root section, it belongs to Agent Scope Database
      const isUnderAgentRoot = ancestors.some(
        (a) => !!a.uuid && (AGENT_ROOT_SECTION_UUIDS.has(a.uuid) || a.uuid === AGENT_ROOT_SECTION_UUID_FOR_NESTING),
      );
      return isUnderAgentRoot ? 'Agent Scope Database' : 'Sections & Primary Docs';
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

function getChildCollectionName(
  parentDb: AtlasDatabaseName,
  childDb: AtlasDatabaseName,
  lookup: DatabaseToChildCollections,
): ChildCollectionName | undefined {
  const byChild = lookup[parentDb];
  return byChild ? byChild[childDb] : undefined;
}

function pushChildIntoCollection(
  parent: StandardizedAtlasDocument,
  collection: ChildCollectionName,
  child: StandardizedAtlasDocument,
) {
  type ParentWithCollections = StandardizedAtlasDocument &
    Partial<Record<ChildCollectionName, StandardizedAtlasDocument[]>>;
  const p = parent as ParentWithCollections;
  if (!Array.isArray(p[collection])) p[collection] = [];
  p[collection]!.push(child);
}

function createNodeForDatabase(
  base: { type: AtlasDocumentType; doc_no: string; name: string; uuid: string | null },
  database: AtlasDatabaseName,
): StandardizedAtlasDocument {
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
      return { ...common, articles: [] } as ScopesDocument;
    case 'Articles':
      return {
        ...common,
        sections_and_primary_docs: [],
        annotations: [],
        needed_research: [],
      } as ArticlesDocument;
    case 'Sections & Primary Docs':
      return {
        ...common,
        sections_and_primary_docs: [],
        agent_scope_database: [],
        annotations: [],
        tenets: [],
        active_data: [],
        needed_research: [],
      } as SectionsAndPrimaryDocsDocument;
    case 'Annotations':
      return { ...common, needed_research: [] } as AnnotationsDocument;
    case 'Tenets':
      return { ...common, scenarios: [], needed_research: [] } as TenetsDocument;
    case 'Scenarios':
      return { ...common, scenario_variations: [], needed_research: [] } as ScenariosDocument;
    case 'Scenario Variations':
      return { ...common, needed_research: [] } as ScenarioVariationsDocument;
    case 'Active Data':
      return { ...common, needed_research: [] } as ActiveDataDocument;
    case 'Agent Scope Database':
      return {
        ...common,
        agent_scope_database: [],
        annotations: [],
        tenets: [],
        active_data: [],
        needed_research: [],
      } as AgentScopeDatabaseDocument;
    case 'Needed Research':
      return { ...common } as NeededResearchDocument;
    default:
      throw new Error(`Unsupported Atlas database: ${database}`);
  }
}
