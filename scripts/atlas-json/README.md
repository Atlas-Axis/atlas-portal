# Atlas Tree-Based Document Numbering System

This directory contains the new tree-based document numbering system for Atlas documents, which replaces the previous sequential approach with a more efficient and robust tree traversal system.

## Overview

The new system provides:

- **Efficient Tree Construction**: Uses lookup maps for O(1) access to nodes and relationships
- **Robust Error Handling**: Detects circular references, orphaned nodes, and missing references
- **Tree Traversal**: Multiple traversal algorithms (pre-order, post-order, level-order)
- **Document Numbering**: Hierarchical numbering using tree traversal instead of sequential processing
- **Comprehensive Validation**: Built-in validation for tree integrity and document number uniqueness

## Key Files

### Core System

- **`atlas-tree-types.ts`** - Type definitions for tree nodes and interfaces
- **`atlas-tree-builder.ts`** - Main tree construction logic with efficient lookup maps
- **`atlas-tree-traversal.ts`** - Tree traversal utilities and algorithms
- **`atlas-tree-numbering.ts`** - Document numbering using tree traversal
- **`atlas-tree-errors.ts`** - Comprehensive error handling and validation
- **`atlas-tree-system.ts`** - High-level API and convenience functions

### Testing

- **`__tests__/atlas-tree-builder.test.ts`** - Comprehensive test suite

## Quick Start

```typescript
import { loadAtlasFromSupabaseWithNestingAgentsUnderSection } from '@/app/server/services/atlas/load-atlas-from-supabase';
import { buildAtlasTreeWithValidation } from './atlas-tree-system';

// Load Atlas data
const atlasData = await loadAtlasFromSupabaseWithNestingAgentsUnderSection();

// Build tree structure with document numbering and validation
const result = await buildAtlasTreeWithValidation(atlasData, {
  assignDocumentNumbers: true,
  verbose: true,
  validateIntegrity: true,
});

// Access the results
console.log(`Built ${result.scopeTrees.length} scope trees`);
console.log(`Found ${result.orphanedNodes.length} orphaned nodes`);
console.log(`Generated ${result.documentNumbers.size} document numbers`);

// Check for validation errors
if (result.validationSummary.criticalErrors > 0) {
  console.error('Critical errors found:', result.validationSummary);
}
```

## API Reference

### Main Functions

#### `buildAtlasTreeWithValidation(pagesByDatabase, options)`

High-level function that builds the tree structure with comprehensive validation and error handling.

**Parameters:**

- `pagesByDatabase`: Pages organized by database name from `loadAtlasFromSupabaseWithNestingAgentsUnderSection()`
- `options`: Configuration options (see below)

**Returns:**

- `scopeTrees`: Array of root scope trees
- `orphanedNodes`: Array of orphaned documents
- `errors`: Array of construction errors
- `validationSummary`: Summary of validation results
- `documentNumbers`: Map of page ID to document number

#### `buildAtlasTree(pagesByDatabase, options)`

Core function that builds the tree structure.

**Options:**

- `assignDocumentNumbers?: boolean` - Whether to assign document numbers during construction
- `verbose?: boolean` - Whether to log detailed construction information
- `maxDepth?: number` - Maximum tree depth to prevent infinite recursion (default: 50)

### Tree Traversal

#### `preOrderTraversal(root, callback, maxDepth)`

Performs pre-order traversal (parent before children).

#### `postOrderTraversal(root, callback, maxDepth)`

Performs post-order traversal (children before parent).

#### `levelOrderTraversal(root, callback, maxDepth)`

Performs level-order traversal (breadth-first).

#### `findNodeByDocumentID(root, generatedDocID)`

Finds a node by its generated document ID.

#### `getNodeCount(root)`

Gets the total number of nodes in the tree.

### Document Numbering

#### `assignDocumentNumbersToTrees(scopeTrees)`

Assigns document numbers to all nodes in the tree structures.

**Returns:** Map of page ID to generated document number

### Document Name Formatting

#### `getDocumentTitle(treeNode)`

Rewrites Notion document titles for 'Sections & Primary Docs' and 'Agent Scope Database' documents by only keeping the last part of the title after the last `-` separator

### Error Handling

#### `validateTreeIntegrity(scopeTrees, orphanedNodes, pagesByDatabase)`

Validates the integrity of the tree structure.

#### `detectCircularReferences(pagesByDatabase)`

Detects circular references in the document hierarchy.

#### `findOrphanedNodes(pagesByDatabase, rootScopeIds)`

Finds orphaned nodes not connected to any root tree.

## Document Numbering Rules

The system follows the Atlas Document Numbering Rules. For comprehensive documentation of all numbering rules and patterns, see **[ATLAS_DOCUMENT_NUMBERING_RULES.md](../../docs/ATLAS_DOCUMENT_NUMBERING_RULES.md)**.

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

## Error Handling

The system provides comprehensive error handling for:

### Circular References

Detects when documents reference themselves directly or through a chain of relationships.

```typescript
const errors = detectCircularReferences(pagesByDatabase);
if (errors.length > 0) {
  console.error('Circular references detected:', errors);
}
```

### Orphaned Nodes

Finds documents that exist in the database but are not connected to any root tree.

```typescript
const orphanedNodes = findOrphanedNodes(pagesByDatabase, rootScopeIds);
if (orphanedNodes.length > 0) {
  console.warn(`Found ${orphanedNodes.length} orphaned nodes`);
}
```

### Missing Child References

Detects when child IDs referenced in relationship arrays don't exist in the database.

```typescript
const missingErrors = detectMissingChildren(pagesByDatabase);
if (missingErrors.length > 0) {
  console.error('Missing child references:', missingErrors);
}
```

## Performance Characteristics

The new system is optimized for handling ~6000 Atlas documents with deep nesting:

- **Tree Construction**: O(n) where n is the number of documents
- **Lookup Operations**: O(1) using efficient lookup maps
- **Tree Traversal**: O(n) for complete tree traversal
- **Document Numbering**: O(n) using tree traversal instead of sequential processing

## Migration from Old System

The new system is designed to be a drop-in replacement for the old sequential system:

```typescript
// Old system
import { generateDocumentNumbers } from './document-numbering';
const docNumbers = generateDocumentNumbers(pagesByDatabase);

// New system
import { buildAtlasTreeWithValidation } from './atlas-tree-system';
const result = await buildAtlasTreeWithValidation(pagesByDatabase, { assignDocumentNumbers: true });
const docNumbers = result.documentNumbers;
```

## Testing

Run the test suite to verify the system works correctly:

```bash
npm test -- scripts/atlas-json/__tests__/atlas-tree-builder.test.ts
```

The test suite covers:

- Tree construction with various document types
- Circular reference detection
- Orphaned node detection
- Document numbering accuracy
- Tree traversal algorithms
- Error handling scenarios

## Troubleshooting

### Common Issues

1. **Circular Reference Errors**: Check for documents that reference themselves in their child arrays
2. **Orphaned Nodes**: Ensure all documents are connected to root scopes through proper relationships
3. **Missing Child References**: Verify that all child IDs in relationship arrays exist in the database
4. **Invalid Document Numbers**: Check that document numbers follow the correct patterns

### Debug Mode

Enable verbose logging to see detailed construction information:

```typescript
const result = buildAtlasTreeWithValidation(atlasData, { verbose: true });
```

This will log:

- Tree construction progress
- Error details
- Validation results
- Performance metrics

## Future Enhancements

Planned improvements include:

- Integration with `/atlas` page
