# Atlas Tree Data Structures

## Overview

The Atlas system uses two distinct tree data structures to represent the hierarchical document corpus of the Atlas:

1. **Notion Tree** - Internal Atlas Representation for Notion pages loaded from Supabase
2. **Export Tree** - External Atlas Representation for exports, APIs, and public interfaces

This dual-tree architecture separates internal implementation details (Notion integration, database schema) from external concerns (markdown export, JSON APIs, public documentation). The Notion Tree is rich with metadata and Notion-specific fields, while the Export Tree is minimal and platform-agnostic.

### Why Two Structures?

**Separation of Concerns**: The Notion Tree handles internal operations (tree building, document numbering, UI rendering) while the Export Tree provides a clean interface for external consumption (JSON/Markdown export, public APIs, some public pages and UIs).

**Decoupling from Notion**: The Export Tree is completely independent of Notion and Supabase, using Atlas document UUIDs instead of Notion page IDs and markdown strings instead of Notion rich text.

**Data Minimization**: External consumers don't need internal metadata (database timestamps, validation status, Notion-specific fields). The Export Tree contains only essential fields.

**Format Compatibility**: The Export Tree uses underscore_case naming and simple data types suitable for JSON export and markdown generation.

### When Each Structure is Used

**Notion Tree** is used for:

- Tree construction and document numbering algorithms
- Internal tree traversal and manipulation
- Rich text mention updates
- Document validation
- Intermediate processing before conversion to Export Tree

**Export Tree** is used for:

- UI rendering (`/atlas` page, sidebar, content tree, search)
- JSON export (atlas.json API endpoint)
- Markdown export (atlas.md generation)
- Public API endpoints
- External integrations
- Search indexing

## Notion Tree (Internal Atlas Representation)

### Purpose

The Notion Tree represents Atlas documents as loaded from the `notion_database_pages` Supabase table. It preserves all database fields, metadata, and Notion-specific structures while organizing documents into a hierarchical tree with embedded child relationships.

### Key Types

- `NotionAtlasTreeNode` - Individual document node with embedded children
- `NotionAtlasTreeResult` - Complete tree build result with roots, orphans, and errors
- `NotionAtlasTreeLookupMaps` - Efficient O(1) lookup maps used during construction
- `NotionAtlasTreeConstructionOptions` - Configuration for tree building

### Type Structure

```typescript
interface NotionAtlasTreeNode {
  // Notion database fields
  notion_page_id: string; // Notion page UUID
  atlas_document_type: AtlasDocumentType; // Document type enum
  atlas_document_number: string; // Document number from Notion
  atlas_database_name: AtlasDatabaseName; // Database name enum
  has_children: boolean;
  archived: boolean;
  in_trash: boolean;
  plain_text_name?: string | null; // Plain text title
  json_name: Json | null; // Notion rich text title
  plain_text_content?: string | null; // Plain text content
  json_content: Json | null; // Notion rich text content
  extra_fields: Json; // Extra fields (Type Specs, Scenarios, etc.)

  // Metadata
  parent_notion_page_id: string | null;
  sort_order: number | null;
  last_edited_by_user_id?: string | null;
  created_at: string;
  updated_at: string;
  date_valid_from?: string | null; // Temporal validity (versioning)
  date_valid_to?: string | null;
  canonical_document_title?: string | null;
  atlas_document_number_sortable?: string;

  // Tree-specific generated fields
  generatedDocID?: string; // Generated document number (e.g., "A.1.2.3")
  generatedDocName?: string; // Generated document name

  // Embedded child relationships (database-grouped)
  scopes: NotionAtlasTreeNode[];
  articles: NotionAtlasTreeNode[];
  sectionsAndPrimaryDocs: NotionAtlasTreeNode[];
  annotations: NotionAtlasTreeNode[];
  tenets: NotionAtlasTreeNode[];
  scenarios: NotionAtlasTreeNode[];
  scenarioVariations: NotionAtlasTreeNode[];
  activeData: NotionAtlasTreeNode[];
  agentScopeDocs: NotionAtlasTreeNode[];
  neededResearch: NotionAtlasTreeNode[];
}

interface NotionAtlasTreeResult {
  scopeTrees: NotionAtlasTreeNode[]; // Root scope trees
  orphanedNodes: NotionDatabasePage[]; // Disconnected documents
  orphanedNodesAsTreeNodes: NotionAtlasTreeNode[]; // Orphaned nodes as tree format
  errors: NotionAtlasTreeConstructionError[]; // Construction errors
  duplicatedNodes: NotionAtlasTreeDuplicatedNodeEntry[]; // Nodes in multiple locations
  atlasUUIDsToGeneratedDocNumbers: Map<string, string>; // UUID → doc number
  atlasUUIDsToDocNames: Map<string, string>; // UUID → doc name
}
```

### Key Characteristics

**Rich Metadata**:

- Contains all Notion database fields and metadata
- Includes temporal validity fields for versioning
- Preserves Notion rich text structures (json_content, json_name)
- Stores database timestamps and edit history

**Notion Identifiers**:

- Uses `notion_page_id` (Notion page UUID) as primary identifier
- Child relationships reference Notion page IDs
- Tied to Notion's data model

**Generated Fields**:

- `generatedDocID`: Document number assigned during tree traversal (e.g., "A.1.2.3")
- `generatedDocName`: Document name extracted from title
- Generated during tree construction using hierarchical numbering rules

**Embedded Children**:

- Children are embedded as typed arrays (not ID arrays)
- Organized by Atlas database (articles, sections, tenets, etc.)
- Enables efficient tree traversal without additional lookups

**Internal Operations**:

- Used for all tree algorithms (traversal, numbering, validation)
- Contains fields needed for UI rendering and internal processing
- Preserves all data for bidirectional Notion sync

### Usage Patterns

**Tree Construction** (`atlas-tree-builder.ts`):

```typescript
const atlasData = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();
const uuidMappings = await loadUuidMappings();
const result = await buildNotionAtlasTree(atlasData, { uuidMappings });

// Access the Notion Tree
const scopeTrees = result.scopeTrees; // Array of NotionAtlasTreeNode roots
```

**Document Numbering** (`atlas-tree-numbering.ts`):

```typescript
// Assign document numbers to Notion Tree nodes
assignDocumentNumbersToTreesRecursively(scopeTrees);
```

**Tree Traversal** (`atlas-tree-traversal.ts`):

```typescript
preOrderTraversal(scopeTree, (node, depth) => {
  console.log(`${node.generatedDocID} - ${node.plain_text_name}`);
  return true;
});
```

**Rich Text Mention Updates** (`atlas-tree-mentions.ts`):

```typescript
// Updates outdated document numbers in Notion mentions
updateRichTextMentions(scopeTrees, uuidMappings, docNumberMaps);
```

## Export Tree (External Atlas Representation)

### Purpose

The Export Tree is a minimal, Export Tree representation of Atlas documents designed for external consumption. It is completely decoupled from Notion and Supabase, using Atlas document UUIDs and markdown strings instead of Notion-specific structures.

### Key Types

- `ExportAtlasTreeDocument` - Union type of all database-specific document types
- `ExportAtlasTreeScopeTrees` - Array of root scope documents
- `ExportAtlasTreeBaseDocument` - Base fields shared by all document types
- Database-specific types: `ExportAtlasTreeScopesDocument`, `ExportAtlasTreeArticlesDocument`, `ExportAtlasTreeSectionsAndPrimaryDocsDocument`, etc.

### Type Structure

```typescript
interface ExportAtlasTreeBaseDocument {
  type: AtlasDocumentType; // Document type enum (Scope, Article, Section, etc.)
  doc_no: string; // Document number (e.g., "A.1.2.3")
  name: string; // Document name
  uuid: string | null; // Atlas document UUID (NOT Notion page UUID)
  last_modified: string; // ISO timestamp
  content: string; // Content as markdown string
}

// Example: Sections & Primary Docs document
interface ExportAtlasTreeSectionsAndPrimaryDocsDocument extends ExportAtlasTreeBaseDocument {
  // Optional extra fields for Type Specifications
  type_spec_field1?: string | null;
  type_spec_field2?: string | null;

  // Children grouped by Atlas database
  sections_and_primary_docs: ExportAtlasTreeSectionsAndPrimaryDocsDocument[];
  agent_scope_database?: ExportAtlasTreeAgentScopeDatabaseDocument[];
  annotations: ExportAtlasTreeAnnotationsDocument[];
  tenets: ExportAtlasTreeTenetsDocument[];
  active_data: ExportAtlasTreeActiveDataDocument[];
  needed_research: ExportAtlasTreeNeededResearchDocument[];
}

// Example: Scenarios document with extra fields
interface ExportAtlasTreeScenariosDocument extends ExportAtlasTreeBaseDocument {
  // Extra fields for Scenarios
  scenario_field1?: string | null;
  scenario_field2?: string | null;

  // Children
  scenario_variations: ExportAtlasTreeScenarioVariationsDocument[];
  needed_research: ExportAtlasTreeNeededResearchDocument[];
}

// Root array type
type ExportAtlasTreeScopeTrees = ExportAtlasTreeDocument[];
```

### Key Characteristics

**Minimal Fields**:

- Only essential fields: type, doc_no, name, uuid, content
- No Notion-specific metadata (notion_page_id, created_at, json_content)
- No internal fields (sort_order, parent_notion_page_id, date_valid_from)

**Atlas UUIDs**:

- Uses `uuid` field with Atlas document UUIDs (not Notion page IDs)
- Enables stable references across Notion page recreations
- Supports markdown-first workflows

**Markdown Content**:

- `content` field is markdown string (not Notion rich text JSON)
- Portable and human-readable format
- Suitable for version control and external editing

**Extra Fields**:

- Document types with extra fields include them directly in the interface
- Type Specifications, Scenarios, Scenario Variations, Needed Research
- Fields are converted to markdown strings

**Database-Grouped Children**:

- Children organized by Atlas database using underscore_case
- `sections_and_primary_docs`, `agent_scope_database`, `scenario_variations`, etc.
- Matches the Export Tree structure pattern

**Platform Independence**:

- No references to Notion, Supabase, or internal systems
- Can be serialized to JSON or Markdown
- Suitable for external APIs and integrations

### Usage Patterns

**UI Rendering** (`app/atlas/page.tsx`, `sidebar.tsx`, `content-tree.tsx`):

```typescript
// Build Notion Tree
const { scopeTrees } = await buildNotionAtlasTree(atlasData, { uuidMappings });

// Convert to Export Tree for UI
const exportScopeTrees = scopeTrees.map((node) =>
  notionTreeNodeToExportTreeNode(node, uuidMappings)
);

// Render UI components with Export Tree
<Sidebar scopeTrees={exportScopeTrees} uuidMappings={uuidMappings} />
<ContentTree scopeTrees={exportScopeTrees} uuidMappings={uuidMappings} />
```

**JSON Export** (`atlas-json-exporter.ts`):

```typescript
const atlasData = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();
const uuidMappings = await loadUuidMappings();
const { scopeTrees } = await buildNotionAtlasTree(atlasData, { uuidMappings });

// Convert to Export Tree
const exportTrees = scopeTrees.map((node) => notionTreeNodeToExportTreeNode(node, uuidMappings));

// Serialize to JSON
const jsonOutput = JSON.stringify(exportTrees, null, 2);
```

**Markdown Export** (`atlas-markdown-exporter.ts`):

```typescript
// Export Tree to Markdown conversion
const markdownOutput = exportAtlasTreeToMarkdown(exportTrees);
```

**Public API** (`app/api/atlas.json/route.ts`):

```typescript
// Serve Export Tree via JSON API
export async function GET() {
  const exportTrees = await buildExportAtlasTreeJSON();
  return Response.json(exportTrees);
}
```

**Markdown Import** (`atlas-markdown-importer.ts`):

```typescript
// Parse markdown into Export Tree structure
const exportTrees = parseAtlasMarkdown(markdownContent);
```

## Tree Conversion Process

### Conversion Function

The `notionTreeNodeToExportTreeNode()` function in `app/server/atlas/export/notion-tree-to-export-tree.ts` converts Notion Tree nodes to Export Tree documents.

### Conversion Flow

```
Notion Tree (NotionAtlasTreeNode)
          ↓
  notionTreeNodeToExportTreeNode()
          ↓
Export Tree (ExportAtlasTreeDocument)
```

### Process Steps

1. **Map Base Fields**
   - `generatedDocID` → `doc_no`
   - `generatedDocName` → `name`
   - `atlas_document_type` → `type`
   - `updated_at` → `last_modified`

2. **Convert UUID**
   - Look up Atlas document UUID from Notion page UUID
   - Use `uuidMappings.notionPageIDsToAtlasUUIDs` map
   - Set `uuid` field with Atlas UUID

3. **Convert Content to Markdown**
   - Transform `json_content` (Notion rich text) to markdown string
   - Use `atlasDatabasePageToMarkdown()` formatter
   - Set `content` field with markdown

4. **Extract Extra Fields**
   - For Type Specifications, Scenarios, Scenario Variations, Needed Research
   - Convert rich text extra fields to markdown strings
   - Include in output document

5. **Recursively Convert Children**
   - For each child collection (articles, sections, tenets, etc.)
   - Call `notionTreeNodeToExportTreeNode()` recursively
   - Build database-grouped child collections

### Code Example

```typescript
export function notionTreeNodeToExportTreeNode(
  node: NotionAtlasTreeNode,
  uuidMappings: UuidMappings,
): ExportAtlasTreeDocument {
  // Step 1: Map base fields
  const base: ExportAtlasTreeBaseDocument = {
    type: node.atlas_document_type,
    doc_no: node.generatedDocID ?? '',
    name: node.generatedDocName ?? '',
    uuid: null, // Set in step 2
    last_modified: node.updated_at,
    content: '', // Set in step 3
  };

  // Step 2: Convert Notion page UUID to Atlas document UUID
  const notionPageId = uuidToHyphens(node.notion_page_id);
  base.uuid = uuidMappings.notionPageIDsToAtlasUUIDs.get(notionPageId) ?? null;

  // Step 3: Convert rich text content to markdown
  base.content = atlasDatabasePageToMarkdown(node, uuidMappings).trim();

  // Step 4: Extract extra fields (if applicable)
  const extraFields = pickExtraFields(node, uuidMappings);

  // Step 5: Recursively convert children based on database
  switch (node.atlas_database_name) {
    case 'Scopes':
      return {
        ...base,
        articles: node.articles.map((c) => notionTreeNodeToExportTreeNode(c, uuidMappings)),
      } as ExportAtlasTreeScopesDocument;

    case 'Sections & Primary Docs':
      return {
        ...base,
        ...extraFields, // Type Specification fields
        sections_and_primary_docs: node.sectionsAndPrimaryDocs.map((c) =>
          notionTreeNodeToExportTreeNode(c, uuidMappings),
        ),
        annotations: node.annotations.map((c) => notionTreeNodeToExportTreeNode(c, uuidMappings)),
        tenets: node.tenets.map((c) => notionTreeNodeToExportTreeNode(c, uuidMappings)),
        active_data: node.activeData.map((c) => notionTreeNodeToExportTreeNode(c, uuidMappings)),
        needed_research: node.neededResearch.map((c) => notionTreeNodeToExportTreeNode(c, uuidMappings)),
      } as ExportAtlasTreeSectionsAndPrimaryDocsDocument;

    // ... other database cases
  }
}
```

### Field Mappings

| Notion Tree Field        | Export Tree Field           | Transformation                |
| ------------------------ | --------------------------- | ----------------------------- |
| `notion_page_id`         | `uuid`                      | Converted via UUID mapping    |
| `atlas_document_type`    | `type`                      | Direct copy                   |
| `generatedDocID`         | `doc_no`                    | Direct copy                   |
| `generatedDocName`       | `name`                      | Direct copy                   |
| `updated_at`             | `last_modified`             | Direct copy                   |
| `json_content`           | `content`                   | Notion rich text → Markdown   |
| `extra_fields`           | Extra field properties      | Rich text → Markdown strings  |
| `articles`               | `articles`                  | Recursive conversion          |
| `sectionsAndPrimaryDocs` | `sections_and_primary_docs` | Recursive conversion + naming |
| `scenarioVariations`     | `scenario_variations`       | Recursive conversion + naming |
| `agentScopeDocs`         | `agent_scope_database`      | Recursive conversion + naming |

**Fields Excluded from Export Tree**:

- `notion_page_id` (internal identifier)
- `plain_text_name`, `json_name` (replaced by `name`)
- `plain_text_content`, `json_content` (replaced by `content`)
- `parent_notion_page_id` (internal relationship)
- `sort_order` (internal ordering)
- `created_at`, `date_valid_from`, `date_valid_to` (internal metadata)
- `archived`, `in_trash`, `has_children` (internal flags)
- `last_edited_by_user_id` (internal metadata)
- `canonical_document_title`, `atlas_document_number`, `atlas_document_number_sortable` (internal numbering)

## UUID Handling

### Notion Page UUID vs Atlas Document UUID

The tree conversion process involves a critical UUID transformation:

**Notion Tree** uses **Notion page UUIDs** (`notion_page_id`):

- Generated by Notion when pages are created
- Stored in `notion_database_pages` table
- Used for internal operations and database queries

**Export Tree** uses **Atlas document UUIDs** (`uuid`):

- Generated internally or externally (markdown import)
- Stored in `uuid_mapping` table
- Stable across Notion page recreations

### UUID Mapping System

The `UuidMappings` interface provides bidirectional O(1) lookup:

```typescript
interface UuidMappings {
  notionPageIDsToAtlasUUIDs: Map<string, string>; // Notion → Atlas
  atlasUUIDsToNotionPageIds: Map<string, string>; // Atlas → Notion
}
```

### Conversion Process

```typescript
// Load UUID mappings
const uuidMappings = await loadUuidMappings();

// Convert Notion page UUID to Atlas document UUID
const notionPageId = node.notion_page_id;
const atlasUUID = uuidMappings.notionPageIDsToAtlasUUIDs.get(notionPageId);

// Use Atlas UUID in Export Tree
const exportDoc: ExportAtlasTreeDocument = {
  uuid: atlasUUID ?? null,
  // ... other fields
};
```

### Benefits

1. **Decoupling**: Atlas documents can exist independently of Notion pages
2. **Stability**: UUIDs remain stable even if Notion pages are recreated
3. **Markdown-First**: Documents can be added to markdown before Notion pages exist
4. **External Editing**: External actors can reference documents using stable UUIDs

See **[UUID_MAPPING.md](./UUID_MAPPING.md)** for comprehensive documentation.

## Child Relationship Patterns

### Notion Tree: Embedded Arrays

In the Notion Tree, children are embedded as typed arrays within the parent node:

```typescript
interface NotionAtlasTreeNode {
  // Children are embedded objects
  articles: NotionAtlasTreeNode[];
  sectionsAndPrimaryDocs: NotionAtlasTreeNode[];
  annotations: NotionAtlasTreeNode[];
  tenets: NotionAtlasTreeNode[];
  // ... more child collections
}
```

**Characteristics**:

- Children are actual `NotionAtlasTreeNode` objects (not IDs)
- Enables efficient traversal without additional lookups
- Organized by Atlas database using camelCase naming
- Built during tree construction from child ID arrays

### Export Tree: Database-Grouped Collections

The Export Tree maintains the same database-grouped structure with different naming:

```typescript
interface ExportAtlasTreeSectionsAndPrimaryDocsDocument {
  // Children grouped by Atlas database
  sections_and_primary_docs: ExportAtlasTreeSectionsAndPrimaryDocsDocument[];
  agent_scope_database?: ExportAtlasTreeAgentScopeDatabaseDocument[];
  annotations: ExportAtlasTreeAnnotationsDocument[];
  tenets: ExportAtlasTreeTenetsDocument[];
  active_data: ExportAtlasTreeActiveDataDocument[];
  needed_research: ExportAtlasTreeNeededResearchDocument[];
}
```

**Characteristics**:

- Children are typed document objects (database-specific)
- Uses underscore_case naming
- Organized by Atlas database (same structure as Notion Tree)
- Optional collections use `?` (e.g., `agent_scope_database?`)

### Naming Conventions

| Notion Tree (camelCase)  | Export Tree (underscore_case) |
| ------------------------ | ----------------------------- |
| `articles`               | `articles`                    |
| `sectionsAndPrimaryDocs` | `sections_and_primary_docs`   |
| `annotations`            | `annotations`                 |
| `tenets`                 | `tenets`                      |
| `scenarios`              | `scenarios`                   |
| `scenarioVariations`     | `scenario_variations`         |
| `activeData`             | `active_data`                 |
| `agentScopeDocs`         | `agent_scope_database`        |
| `neededResearch`         | `needed_research`             |

### Database Hierarchy

Both structures respect the Atlas Database Hierarchy:

```
Scopes
└── Articles
    ├── Sections & Primary Docs
    │   ├── Sections & Primary Docs (nested)
    │   ├── Agent Scope Database
    │   ├── Annotations
    │   ├── Tenets
    │   │   └── Scenarios
    │   │       └── Scenario Variations
    │   ├── Active Data
    │   └── Needed Research
    └── Agent Scope Database
        ├── Agent Scope Database (nested)
        ├── Annotations
        ├── Tenets
        │   └── Scenarios
        │       └── Scenario Variations
        ├── Active Data
        └── Needed Research

Needed Research may nest under any document type
```

## Integration Points

### Systems Using Notion Tree

**Tree Construction** (`app/server/atlas/notion-tree/`):

- `atlas-tree-builder.ts` - Builds Notion Trees from database pages
- `atlas-tree-numbering.ts` - Assigns document numbers to Notion Tree nodes
- `atlas-tree-traversal.ts` - Traverses Notion Trees
- `atlas-tree-mentions.ts` - Updates rich text mentions in Notion Trees

**UI Components** (`app/atlas/`):

- `page.tsx` - Main Atlas page (builds Notion Tree, converts to Export Tree for UI)
- `sidebar.tsx` - Sidebar rendering from Export Tree
- `content-tree.tsx` - Content tree rendering from Export Tree
- `search-modal.tsx` - Search functionality using Export Tree
- `mobile-top-bar.tsx` - Mobile navigation using Export Tree

### Systems Using Export Tree

**Export Scripts** (`scripts/atlas-export/`):

- `generate-atlas-json.ts` - Generates Export Tree and serializes to JSON
- `generate-atlas-markdown.ts` - Generates Export Tree and converts to Markdown
- `convert-atlas-markdown-to-json.ts` - Parses Markdown into Export Tree
- `validate-atlas-json.ts` - Validates Export Tree structure

**API Endpoints** (`app/api/`):

- `atlas.json/route.ts` - Serves Export Tree as JSON
- `atlas.md/route.ts` - Serves Export Tree as Markdown
- `atlas.yaml/route.ts` - Serves Export Tree as YAML

**Markdown Sync** (`app/atlas/sync/`):

- Uses Export Tree for bidirectional Notion ↔ Markdown synchronization
- Parses Markdown into Export Tree
- Converts Export Tree to Notion pages

### Conversion Happens At

**UI Rendering** (`/atlas` page):

```
Load from Supabase → Build Notion Tree → Convert to Export Tree → Render UI Components
```

**Export Operations**:

```
Load from Supabase → Build Notion Tree → Convert to Export Tree → Serialize to JSON/Markdown
```

**API Requests**:

```
API Request → Load cached Notion Tree → Convert to Export Tree → Return JSON response
```

**Markdown Import**:

```
Parse Markdown → Build Export Tree → Validate → Convert to Notion Pages
```

### Data Flow Diagram

```
┌─────────────────┐
│  Supabase DB    │
│ notion_database │
│     _pages      │
└────────┬────────┘
         │ Load
         ↓
┌─────────────────────────┐
│  Notion Tree            │
│ NotionAtlasTreeNode     │
│ NotionAtlasTreeResult   │
└────────┬────────────────┘
         │ Convert (notionTreeNodeToExportTreeNode)
         ↓
┌──────────────────────────────┐
│  Export Tree                 │
│ ExportAtlasTreeDocument      │
└────────┬─────────────────────┘
         │ Serialize / Render
         ↓
┌─────────────────┐
│ Output          │
│ - UI Components │
│ - JSON/Markdown │
│ - APIs          │
└─────────────────┘
```

## Comparison Summary

| Aspect                 | Notion Tree                        | Export Tree                          |
| ---------------------- | ---------------------------------- | ------------------------------------ |
| **Purpose**            | Internal operations                | External consumption & UI rendering  |
| **Identifiers**        | Notion page UUIDs                  | Atlas document UUIDs                 |
| **Content Format**     | Notion rich text (JSON)            | Markdown strings                     |
| **Metadata**           | Rich (timestamps, validity, flags) | Minimal (essential only)             |
| **Field Naming**       | camelCase                          | underscore_case                      |
| **Platform Coupling**  | Coupled to Notion/Supabase         | Platform-independent                 |
| **Use Cases**          | Tree algorithms, internal          | UI rendering, export, APIs, external |
| **Type Complexity**    | High (many fields)                 | Low (6 base fields)                  |
| **Child Organization** | Embedded arrays by database        | Typed collections by database        |
| **Extra Fields**       | JSONB in `extra_fields`            | Top-level properties (markdown)      |

## Related Documentation

- **[Atlas Tree System (AGENTS.md)](../app/server/atlas/notion-tree/AGENTS.md)** - Comprehensive guide to tree building algorithms, traversal, document numbering, and the Notion Tree system
- **[UUID Mapping System](./UUID_MAPPING.md)** - Bidirectional UUID mappings between Notion page UUIDs and Atlas document UUIDs
- **[Atlas Markdown Import/Export](./ATLAS_MARKDOWN_IMPORT_EXPORT.md)** - Markdown format specification and conversion workflows
- **[Atlas Document Numbering Rules](./ATLAS_DOCUMENT_NUMBERING_RULES.md)** - Hierarchical document numbering system used in both tree structures
- **[Atlas Extra Fields](./ATLAS_EXTRA_FIELDS.md)** - Extra fields for Type Specifications, Scenarios, Scenario Variations, and Needed Research

## Best Practices

### 1. Choose the Right Structure

Use **Notion Tree** when:

- Performing internal tree operations (traversal, numbering)
- Building UI components that need metadata
- Working with Notion-specific features (rich text, mentions)
- Need O(1) lookups with Notion page IDs

Use **Export Tree** when:

- Generating JSON/Markdown exports
- Building public APIs
- Creating external integrations
- Need platform-independent representation

### 2. Always Convert Through UUID Mappings

Never convert UUIDs manually. Always use the `UuidMappings` interface:

```typescript
// ✅ Correct
const atlasUUID = uuidMappings.notionPageIDsToAtlasUUIDs.get(notionPageId);

// ❌ Wrong - no direct conversion exists
const atlasUUID = convertNotionToAtlasUUID(notionPageId);
```

### 3. Load Mappings Once

Load UUID mappings once at the start of operations and pass them through:

```typescript
// ✅ Correct
const uuidMappings = await loadUuidMappings();
const exportTree = notionTreeNodeToExportTreeNode(notionTree, uuidMappings);

// ❌ Wrong - reloading mappings repeatedly
for (const node of nodes) {
  const uuidMappings = await loadUuidMappings(); // Expensive!
  const exportTree = notionTreeNodeToExportTreeNode(node, uuidMappings);
}
```

### 4. Preserve Tree Structure During Conversion

The conversion process is recursive and structure-preserving. Don't flatten or reorganize:

```typescript
// ✅ Correct - preserves hierarchy
const exportTree = notionTreeNodeToExportTreeNode(rootNode, uuidMappings);

// ❌ Wrong - loses hierarchy
const flatList = nodes.map((n) => notionTreeNodeToExportTreeNode(n, uuidMappings));
```

### 5. Validate Export Trees

Always validate Export Trees before serialization:

```typescript
import { validateExportAtlasTree } from '@/app/server/atlas/export/validate-export-atlas-tree';

const exportTrees = scopeTrees.map((node) => notionTreeNodeToExportTreeNode(node, uuidMappings));

const errors = validateExportAtlasTree(exportTrees);
if (errors.length > 0) {
  console.error('Export Tree validation failed:', errors);
}
```

### 6. Handle Missing UUIDs Gracefully

Not all documents have Atlas UUIDs (new documents, deleted pages). Handle nulls:

```typescript
const atlasUUID = uuidMappings.notionPageIDsToAtlasUUIDs.get(notionPageId);
if (!atlasUUID) {
  console.warn(`Missing Atlas UUID for Notion page: ${notionPageId}`);
  // Use null or skip the document
}
```
