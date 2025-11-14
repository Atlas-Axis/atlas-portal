# Atlas Tree System: Data Structures and Algorithms

This directory contains the core Atlas tree system that provides data structures and algorithms for building, traversing, processing, and validating hierarchical Atlas document structures.

## Overview

The Atlas tree system provides comprehensive functionality for working with Atlas documents:

- **Efficient Tree Construction**: Uses lookup maps for O(1) access to nodes and relationships
- **Tree Traversal Algorithms**: Pre-order, post-order, and level-order traversal implementations
- **Hierarchical Document Numbering**: Assigns document numbers using tree traversal
- **Helper Utilities**: Document name formatting, sorting, and data structure helpers
- **Rich Text Mention Correction**: Automatically updates outdated document numbers in Notion mentions
- **Robust Error Handling**: Detects circular references, orphaned nodes, and missing references
- **Comprehensive Validation**: Built-in validation for tree integrity and document number uniqueness

## Key Files

### Core System

Located in `app/server/atlas/tree/`:

- **`atlas-tree-types.ts`** - Type definitions for tree nodes and interfaces
- **`atlas-tree-builder.ts`** - Main tree construction logic with efficient lookup maps
- **`atlas-tree-system.ts`** - High-level API and convenience functions
- **`atlas-tree-traversal.ts`** - Tree traversal utilities and algorithms
- **`atlas-tree-numbering.ts`** - Document numbering using tree traversal
- **`atlas-tree-helpers.ts`** - Helper functions for sorting and name formatting
- **`atlas-tree-errors.ts`** - Comprehensive error handling and validation

### Testing

Located in `app/server/atlas/tree/__tests__/`:

- **`atlas-tree-builder.test.ts`** - Tree construction, circular references, orphaned nodes
- **`atlas-tree-numbering.test.ts`** - Document numbering patterns and accuracy
- **`atlas-tree-helpers.test.ts`** - Helper functions (sorting, name formatting)
- **`atlas-tree-builder-mentions.test.ts`** - Rich Text mention updates

## Quick Start

```typescript
import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/atlas/load-atlas-from-supabase';
import { loadUuidMappings } from '@/app/server/atlas/load-uuid-mapping';
import { buildAtlasTree } from './tree/atlas-tree-system';

// Load Atlas data
const atlasData = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();
const uuidMappings = await loadUuidMappings();

// Build tree structure with document numbering
const result = await buildAtlasTree(atlasData, { uuidMappings });

// Access the results
console.log(`Built ${result.scopeTrees.length} scope trees`);
console.log(`Found ${result.orphanedNodes.length} orphaned nodes`);
```

## API Reference

### Tree Construction

#### `buildAtlasTree(pagesByDatabase, options)`

Core function that builds the tree structure. Document numbers are automatically assigned during tree construction.

**Process Steps:**

1. Create lookup maps for O(1) access
2. Generate normalized document names
3. Find root Scope documents
4. Build tree structures for each root scope
5. Find orphaned nodes
6. Assign document numbers
7. Generate Atlas UUID maps (document numbers and names)
8. Update Rich Text mentions with correct document numbers and names
9. Generate duplicated nodes list

**Options:**

- `uuidMappings: UuidMappings` - UUID mappings for generating Atlas UUID maps (required)
- `verbose?: boolean` - Whether to log detailed construction information (default: true)
- `maxDepth?: number` - Maximum tree depth to prevent infinite recursion (default: 50)
- `reportMissingChildNodes?: boolean` - Whether to report missing child nodes as errors (default: false)
- `reportOrphanedNodes?: boolean` - Whether to report orphaned nodes in detail (default: false)
- `reportDuplicatedNodes?: boolean` - Whether to report duplicated nodes (default: false)

**Returns:**

- `scopeTrees`: Array of root scope trees with document numbers assigned
- `orphanedNodes`: Array of orphaned documents
- `orphanedNodesAsTreeNodes`: Orphaned nodes as AtlasTreeNode format
- `errors`: Array of construction errors
- `duplicatedNodes`: List of nodes appearing in multiple locations
- `atlasUUIDsToGeneratedDocNumbers`: Map from Atlas UUID to generated document number
- `atlasUUIDsToDocNames`: Map from Atlas UUID to generated document name

**Example:**

```typescript
const atlasData = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();
const uuidMappings = await loadUuidMappings();
const result = await buildAtlasTree(atlasData, { uuidMappings });

// Access the first scope tree
const firstScope = result.scopeTrees[0];
console.log(`Scope: ${firstScope.generatedDocID}`);

// Access its articles
firstScope.articles.forEach((article) => {
  console.log(`  Article: ${article.generatedDocID}`);
});
```

### Tree Traversal

#### `preOrderTraversal(root, callback, maxDepth)`

Performs pre-order traversal (parent before children), ideal for:

- Document numbering (parent numbers must be assigned before children)
- Building hierarchical structures
- Top-down processing

**Parameters:**

- `root: AtlasTreeNode` - The root node to start traversal from
- `callback: TraversalCallback` - Function to call for each visited node
- `maxDepth?: number` - Maximum depth to traverse (default: 50)

**Returns:** Array of all visited nodes in pre-order

**Example:**

```typescript
const nodes: AtlasTreeNode[] = [];
preOrderTraversal(scopeTree, (node, depth) => {
  console.log(`${'  '.repeat(depth)}${node.generatedDocID} - ${node.plain_text_name}`);
  nodes.push(node);
  return true; // Continue traversal
});
```

#### `postOrderTraversal(root, callback, maxDepth)`

Performs post-order traversal (children before parent), ideal for:

- Cleanup operations
- Bottom-up processing
- Aggregating child data

#### `levelOrderTraversal(root, callback, maxDepth)`

Performs level-order traversal (breadth-first), ideal for:

- Processing by depth level
- Finding nearest nodes
- Level-based analysis

#### `findNodeByDocumentID(root, generatedDocID)`

Finds a node by its generated document ID.

**Example:**

```typescript
const node = findNodeByDocumentID(scopeTree, 'A.1.2.3');
if (node) {
  console.log(`Found: ${node.plain_text_name} (${node.generatedDocID})`);
}
```

#### `getNodeCount(root)`

Returns the total number of nodes in the tree.

#### `validateTree(root, maxDepth)`

Validates tree structure for circular references and depth constraints.

### Document Numbering

#### `assignDocumentNumbersToTreesRecursively(scopeTrees)`

Assigns document numbers to all nodes in the tree structures using the Atlas Document Numbering Rules. This function is automatically called by `buildAtlasTree()` during tree construction, so you typically don't need to call it directly.

**Returns:** Map of page ID to generated document number

**Document Numbering Patterns:**

See **[docs/ATLAS_DOCUMENT_NUMBERING_RULES.md](../../docs/ATLAS_DOCUMENT_NUMBERING_RULES.md)** for comprehensive documentation.

Quick reference:

- **Scopes**: `A.0`, `A.1`, `A.2`, ...
- **Articles**: `A.0.1`, `A.0.2`, ... (under scope A.0)
- **Sections**: `A.0.1.1`, `A.0.1.2`, ... (under article A.0.1)
- **Annotations**: `A.0.1.0.3.1`, `A.0.1.0.3.2`, ... (targeting section A.0.1)
- **Tenets**: `A.0.1.0.4.1`, `A.0.1.0.4.2`, ... (targeting section A.0.1)
- **Scenarios**: `A.0.1.0.4.1.1`, `A.0.1.0.4.1.2`, ... (under tenet A.0.1.0.4.1)
- **Scenario Variations**: `A.0.1.0.4.1.1.var1`, `A.0.1.0.4.1.1.var2`, ... (under scenario A.0.1.0.4.1.1)
- **Active Data**: `A.0.1.0.6.1`, `A.0.1.0.6.2`, ... (targeting Active Data Controller A.0.1)
- **Needed Research**: `NR-1`, `NR-2`, ... (global numbering)

### Helper Functions

#### `getDocumentTitle(treeNode)`

Formats document titles by extracting the relevant part of the Notion title based on the document's database.

For `Sections & Primary Docs` and `Active Data` databases, it returns only the last part after the final `" - "` separator. For other databases, it returns the full title.

**Example:**

- Input: `"A.1.6 - Facilitators - Budgets"` (Sections & Primary Docs)
- Output: `"Budgets"`

#### `sortAtlasDocuments(documents)`

Sorts Atlas documents by their sort_order and document number using natural ordering.

Different databases use different sorting strategies:

- **Sections & Primary Docs**: Sort by `sort_order` first, then by document number
- **Other databases**: Sort by document number only

**Example:**

```typescript
const sortedChildren = sortAtlasDocuments(node.sectionsAndPrimaryDocs);
```

### Data Structures

#### `AtlasTreeNode` Interface

The main tree node type that represents an Atlas document with embedded child relationships.

**Key Fields:**

```typescript
interface AtlasTreeNode {
  // Notion database fields
  notion_page_id: string;
  atlas_document_type: AtlasDocumentType;
  atlas_database_name: AtlasDatabaseName;
  plain_text_name?: string | null;
  json_name: Json | null;
  plain_text_content?: string | null;
  json_content: Json | null;

  // Tree-specific fields
  generatedDocID?: string; // Generated document number (e.g., "A.1.2.3")
  generatedDocName?: string; // Generated document name

  // Embedded child relationships (instead of ID arrays)
  scopes: AtlasTreeNode[];
  articles: AtlasTreeNode[];
  sectionsAndPrimaryDocs: AtlasTreeNode[];
  annotations: AtlasTreeNode[];
  tenets: AtlasTreeNode[];
  scenarios: AtlasTreeNode[];
  scenarioVariations: AtlasTreeNode[];
  activeData: AtlasTreeNode[];
  agentScopeDocs: AtlasTreeNode[];
  neededResearch: AtlasTreeNode[];
}
```

#### `AtlasTreeResult` Interface

Result of building the Atlas tree structure.

```typescript
interface AtlasTreeResult {
  scopeTrees: AtlasTreeNode[]; // Root scope trees
  orphanedNodes: NotionDatabasePage[]; // Disconnected documents
  orphanedNodesAsTreeNodes: AtlasTreeNode[]; // Orphaned nodes as tree format
  errors: TreeConstructionError[]; // Construction errors
  duplicatedNodes: DuplicatedNodeEntry[]; // Nodes in multiple locations
  atlasUUIDsToGeneratedDocNumbers: Map<string, string>; // UUID → doc number
  atlasUUIDsToDocNames: Map<string, string>; // UUID → doc name
}
```

#### `TreeConstructionOptions` Interface

Configuration options for tree construction.

```typescript
interface TreeConstructionOptions {
  uuidMappings: UuidMappings; // Required: UUID mappings
  verbose?: boolean; // Log construction details (default: true)
  maxDepth?: number; // Max tree depth (default: 50)
  reportMissingChildNodes?: boolean; // Report missing children (default: false)
  reportOrphanedNodes?: boolean; // Report orphaned nodes details (default: false)
  reportDuplicatedNodes?: boolean; // Report duplicated nodes (default: false)
}
```

#### `AtlasLookupMaps` Interface

Efficient lookup maps used internally during tree construction for O(1) access.

```typescript
interface AtlasLookupMaps {
  nodeMapByPageId: Map<string, AtlasTreeNode>; // Page ID → node
  originalPageMap: Map<string, NotionDatabasePage>; // Page ID → original page
  parentIdMap: Map<string, string>; // Child ID → parent ID
  childrenIdsMap: Map<string, string[]>; // Page ID → child IDs
  processedIds: Set<string>; // Processed page IDs
  nodeToParentsMap: Map<string, Set<string>>; // Node ID → parent IDs
}
```

## Rich Text Mention Updates

During tree construction (Step 8), the system automatically updates Rich Text mention objects in the `json_content` fields of all Atlas documents. This feature corrects outdated or incorrect document numbers that Notion stores in mention `plain_text` fields.

### Why This Is Necessary

When Atlas documents reference other documents using Notion's mention feature, Notion stores both:

1. The actual Notion page ID (in `mention.page.id`) - always correct
2. A display text (in `plain_text`) - often outdated or incorrect

The display text can become stale when documents are renumbered or reorganized, but the page ID remains valid. To ensure consistency, the system:

1. Extracts the Notion page ID from each mention object
2. Looks up the corresponding Atlas UUID via the UUID mapping table
3. Retrieves the current document number from the `atlasUUIDsToGeneratedDocNumbers` map
4. Retrieves the current document name from the `atlasUUIDsToDocNames` map
5. Updates the `plain_text` field with the format: `"{number} - {name}"` (e.g., `"A.0.1 - General Provisions"`)

### Handling Missing Mappings

If a mention references a document that:

- Has no UUID mapping, or
- Has no assigned document number

The system replaces the `plain_text` with `"[Unknown]"` and logs a warning for investigation.

If the document name is not available but the document number exists, only the document number is used (e.g., `"A.0.1"`).

### Example

Original mention object from Notion:

```json
{
  "type": "mention",
  "plain_text": "A.2.4",
  "mention": {
    "type": "page",
    "page": { "id": "1b2f2ff0-8d73-8095-bb8f-ed052141f936" }
  }
}
```

After processing:

```json
{
  "type": "mention",
  "plain_text": "A.1.3 - General Provisions",
  "mention": {
    "type": "page",
    "page": { "id": "1b2f2ff0-8d73-8095-bb8f-ed052141f936" }
  }
}
```

This happens automatically in Step 8 of `buildAtlasTree()`, after document numbers are assigned and the UUID-to-document-number map is generated.

## Error Handling

The system provides comprehensive error handling for common tree construction issues.

### `validateTreeIntegrity(scopeTrees, orphanedNodes, pagesByDatabase)`

Validates the overall integrity of the tree structure, checking for:

- Circular references
- Orphaned nodes
- Missing child references
- Document number uniqueness

**Example:**

```typescript
const validationErrors = validateTreeIntegrity(result.scopeTrees, result.orphanedNodes, pagesByDatabase);

if (validationErrors.length > 0) {
  console.error('Tree validation failed:', validationErrors);
}
```

### `detectCircularReferences(pagesByDatabase)`

Detects when documents reference themselves directly or through a chain of relationships.

**Example:**

```typescript
const errors = detectCircularReferences(pagesByDatabase);
if (errors.length > 0) {
  console.error('Circular references detected:', errors);
}
```

### `findOrphanedNodes(pagesByDatabase, rootScopeIds)`

Finds documents that exist in the database but are not connected to any root tree.

**Example:**

```typescript
const orphanedNodes = findOrphanedNodes(pagesByDatabase, rootScopeIds);
if (orphanedNodes.length > 0) {
  console.warn(`Found ${orphanedNodes.length} orphaned nodes`);
}
```

### Missing Child References

The system detects when child IDs referenced in relationship arrays don't exist in the database. This is controlled by the `reportMissingChildNodes` option (false by default, as many missing references are intentional due to database filters).

### Error Types

```typescript
interface TreeConstructionError {
  type: 'missing_child' | 'circular_reference' | 'orphaned_node';
  message: string;
  pageId: string;
  context?: Json;
}
```

## Performance Characteristics

The Atlas tree system is optimized for handling ~6000 Atlas documents with deep nesting:

- **Tree Construction**: O(n) where n is the number of documents
- **Lookup Operations**: O(1) using efficient lookup maps
- **Tree Traversal**: O(n) for complete tree traversal
- **Document Numbering**: O(n) using tree traversal

The system uses lookup maps extensively to achieve O(1) access times for nodes and relationships during construction, enabling fast processing of large document hierarchies.

## Testing

Run the test suite to verify the system works correctly:

```bash
# Run all tree system tests
npm test -- app/server/atlas/tree/__tests__

# Run specific test files
npm test -- app/server/atlas/tree/__tests__/atlas-tree-builder.test.ts
npm test -- app/server/atlas/tree/__tests__/atlas-tree-numbering.test.ts
npm test -- app/server/atlas/tree/__tests__/atlas-tree-helpers.test.ts
npm test -- app/server/atlas/tree/__tests__/atlas-tree-builder-mentions.test.ts
```

### Test Coverage

- **`atlas-tree-builder.test.ts`** - Tree construction with various document types, circular reference detection, orphaned node detection, duplicate node handling
- **`atlas-tree-numbering.test.ts`** - Document numbering patterns, hierarchical numbering accuracy, special case handling (Needed Research, Scenario Variations)
- **`atlas-tree-helpers.test.ts`** - Helper functions (document title formatting, sorting by document number and sort_order)
- **`atlas-tree-builder-mentions.test.ts`** - Rich Text mention updates, handling missing mappings, UUID resolution

## Troubleshooting

### Common Issues

1. **Circular Reference Errors**: Check for documents that reference themselves in their child arrays. Use `detectCircularReferences()` to identify the cycle.

2. **Orphaned Nodes**: Ensure all documents are connected to root scopes through proper relationships. Use `findOrphanedNodes()` to identify disconnected documents.

3. **Missing Child References**: Verify that all child IDs in relationship arrays exist in the database. This is often intentional due to database filters, so enable `reportMissingChildNodes` only when debugging.

4. **Invalid Document Numbers**: Check that document numbers follow the correct patterns defined in `ATLAS_DOCUMENT_NUMBERING_RULES.md`. Use `validateDocumentNumbers()` to verify.

### Debug Mode

Enable verbose logging to see detailed construction information:

```typescript
const result = await buildAtlasTree(atlasData, {
  uuidMappings,
  verbose: true,
  reportMissingChildNodes: true,
  reportOrphanedNodes: true,
  reportDuplicatedNodes: true,
});
```

This will log:

- Tree construction progress
- Nesting fix mappings applied
- Document number generation
- Error details with context
- Validation results
- Performance metrics

## Integration

The Atlas tree system is currently integrated with:

- **`/atlas` page** (`app/atlas/page.tsx`) - Uses `buildAtlasTree()` to render the Atlas hierarchy
- **Atlas Export Scripts** (`scripts/atlas-export/`) - Uses tree structures for JSON and Markdown export
- **UUID Mapping System** (`docs/UUID_MAPPING.md`) - Provides bidirectional UUID mappings for document number and name generation

## Related Documentation

- **[docs/ATLAS_DOCUMENT_NUMBERING_RULES.md](../../docs/ATLAS_DOCUMENT_NUMBERING_RULES.md)** - Comprehensive rules for Atlas document numbering
- **[docs/UUID_MAPPING.md](../../docs/UUID_MAPPING.md)** - UUID mapping system documentation
- **[docs/ATLAS_DIFFING.md](../../docs/ATLAS_DIFFING.md)** - Tree diffing algorithms
- **[app/server/atlas/export/README.md](../export/README.md)** - Atlas export system (planned)
