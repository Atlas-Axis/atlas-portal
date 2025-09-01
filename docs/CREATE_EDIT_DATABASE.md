# Create "Edit Database" Functionality

This document describes the new functionality for creating "edit databases" from existing Notion databases stored in Supabase.

## Overview

The `createNotionEditPagesAndDatabase` function allows you to create a duplicate Notion database containing a subset of pages from an existing database. This is used for creating "edit copies" that can be modified without affecting the original data.

## Key Features

- ✅ Creates a new Notion database with the same schema as the original
- ✅ Copies a subset of pages (specified root page and all descendants)
- ✅ Maintains parent-child relationships through Sub-item properties
- ✅ Imports the new database back to Supabase with proper edit page flags
- ✅ Handles rich text content and preserves formatting
- ✅ Provides comprehensive error handling and logging
- ✅ **Optimized performance**: Uses efficient O(n+k) tree traversal instead of O(n×k) linear search

## Function Signature

```typescript
export async function createNotionEditPagesAndDatabase({
  originalNotionDatabaseId,
  rootNotionPageId,
  taskRunId,
  propertyWhitelist,
  parent,
}: {
  originalNotionDatabaseId: string;
  rootNotionPageId: string;
  taskRunId: string;
  propertyWhitelist?: string[];
  parent: CreateDatabaseParameters['parent'];
}): Promise<CreateEditDatabaseResult>;
```

### Parameters

- `originalNotionDatabaseId`: The UUID of the original Notion database stored in Supabase
- `rootNotionPageId`: The UUID of the page that will serve as the root of the subtree to duplicate
- `taskRunId`: A unique identifier for tracking this operation in Trigger.dev
- `propertyWhitelist` (optional): Array of property names to include in the new database
- `parent`: The parent location where the new database will be created. Must be a valid Notion parent object (page or database)

### Return Value

```typescript
interface CreateEditDatabaseResult {
  newDatabaseId: string; // ID of the newly created Notion database
  pageIdMapping: Map<string, string>; // Mapping from new page IDs to original page IDs
  pagesCreatedCount: number; // Total number of pages created
  originalDatabaseTitle: string; // Title of the original database
  newDatabaseTitle: string; // Title of the new database
}
```

## Implementation Steps

1. **Load and Validate Data**: Loads pages from Supabase and validates inputs
2. **Build Tree Structure**: Converts pages to tree nodes and builds efficient tree structure using `buildTree`
3. **Extract Subtree**: Uses optimized O(k) tree traversal to extract only the needed pages
4. **Retrieve Database Schema**: Gets the original database configuration from Notion
5. **Create New Database**: Creates a new database with cloned schema and modified title
6. **Create Pages**: Creates pages in dependency order (parents before children)
7. **Update Relationships**: Sets Sub-item relationships by updating parent pages
8. **Import to Supabase**: Syncs the new database back to Supabase with edit flags

## Database Schema Handling

The function clones all properties from the original database, including:

- Title properties (Doc No)
- Rich text properties (Name, Content)
- Relation properties (Sub-item)
- Other custom properties

## Parent-Child Relationships

The Notion database uses a "Sub-item" relation property where:

- Parents contain references to their children in the Sub-item property
- The function maintains this structure by updating parent pages after creating children

## Supabase Integration

When importing back to Supabase, the function sets:

- `belongs_to_edit_page = true` for all pages
- `edit_page_original_notion_page_id` to link back to original pages
- `edit_page_original_notion_database_id` to link back to original database

## Error Handling

- Validates that the root page exists in the specified database
- Ensures all source pages are original pages (not edit copies)
- Handles Notion API rate limiting through the existing proxy
- Provides detailed logging throughout the process
- Attempts cleanup on failure (though Notion API doesn't support database deletion)

## Environment Variables

- `NOTION_SECRET_WRITE`: Required for creating databases and pages

## Usage Example

```typescript
import { createNotionEditPagesAndDatabase } from '@/app/server/services/notion/create-edit-pages-and-edit-database';

const result = await createNotionEditPagesAndDatabase({
  originalNotionDatabaseId: '25ef758464c580319597e2a98756bbc8',
  rootNotionPageId: '25ef758464c5808db8bbdb67351fa26f',
  taskRunId: '<Provided by Trigger.dev>',
  propertyWhitelist: ['Name', 'Content', 'Doc No (or Temp Name)', 'Sub-item'],
  parent: {
    type: 'page_id',
    page_id: 'your-parent-page-id-here',
  },
});

console.log(`Created database ${result.newDatabaseId} with ${result.pagesCreatedCount} pages`);
```

## Testing

A test page is available at `/test-edit-database` that provides a UI for testing the functionality with the demo data.

## Modified Files

1. **`create-edit-pages-and-edit-database.ts`**: Main implementation (renamed and optimized)
2. **`import-database-to-supabase.ts`**: Modified to support edit database mode via `editPageProps` parameter
3. **`test-edit-database/page.tsx`**: Test interface

## Function Signatures

### importDatabasePagesFromNotionToSupabase

```typescript
export async function importDatabasePagesFromNotionToSupabase({
  notionDatabaseId,
  taskRunId,
  editPageProps,
}: {
  notionDatabaseId: string;
  taskRunId: string;
  editPageProps?: {
    isEditDatabase: true;
    originalDatabaseId?: string;
    pageIdMapping?: Map<string, string>; // new page ID -> original page ID
  };
});
```

When `editPageProps` is provided:

- `isEditDatabase` is always `true`
- `originalDatabaseId` links back to the original database
- `pageIdMapping` maps new page IDs to original page IDs for proper relationship tracking

## Performance Optimizations

The implementation uses an optimized tree traversal algorithm for extracting subtrees:

### Algorithm Complexity

- **Previous approach**: O(n×k) - Linear search through all pages for each descendant
- **Current approach**: O(n + k) - Build tree once, then efficient traversal

### Performance Benefits

1. **Better Algorithmic Complexity**:
   - Builds the tree structure once using `buildTree()`
   - Uses direct parent-child relationships for traversal
   - Only visits nodes that are actually in the subtree

2. **Real-world Impact**:
   - For 1000 pages with 50-page subtree: ~47x faster (50,000 → 1,050 operations)
   - Performance gain increases with database size but small subtrees

3. **Memory Efficiency**:
   - Tree structure provides direct relationships
   - No repeated array filtering operations
   - Better CPU cache utilization

## Limitations

- Only supports plain text content (rich text formatting is converted to plain text)
- Cannot automatically clean up partially created databases on failure
- Requires the original database to be already synced to Supabase

## Future Enhancements

- Support for preserving rich text formatting
- Automatic parent page detection for database creation
- Support for creating edit pages from individual pages (not just databases)
- Batch operations for creating multiple edit databases
