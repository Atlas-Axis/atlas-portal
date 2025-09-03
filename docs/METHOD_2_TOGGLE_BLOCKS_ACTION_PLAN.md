# Method #2: Toggle Blocks Implementation Action Plan

## Overview

This document outlines the complete action plan for implementing Method #2: creating a single Notion page with hierarchical toggle blocks from Atlas documents stored in the `notion_database_pages` table.

## Background Context

### The Problem

We have hierarchical Atlas documents stored in the `notion_database_pages` Supabase table. We need two export methods:

1. **Method #1 (COMPLETED)**: `createNotionEditPagesAndDatabase` - Creates a new Notion database with separate pages for each document
2. **Method #2 (IN PROGRESS)**: `createNotionPageWithToggleBlocks` - Creates a single Notion page with nested toggle blocks

### Requirements for Method #2

- Create a single Notion page using the Notion API
- Include all Atlas documents as hierarchical toggle blocks
- Each toggle block title = `canonical_document_title` from database pages
- Each toggle block content = rich text from `json_content` + child toggle blocks
- Store created blocks in `notion_blocks` table with proper mapping
- Preserve parent-child relationships and sort order
- Support change detection by mapping blocks back to original database pages

## Technical Decisions Made

### Questions Asked and Answers Received

#### 1. Toggle Block Structure

**Q**: Should toggle content contain BOTH rich text from `json_content` AND child toggle blocks?

**A**: Yes, the hierarchy should look like:

```
📁 A.1 - Main Document
  ├── Rich text content from json_content...
  └── 📁 A.1.1 - Child Document
      ├── Rich text content from child's json_content...
      └── 📁 A.1.1.1 - Grandchild Document
```

#### 2. Database Mapping

**Q**: Should we add a new field to `notion_blocks` to map back to source database pages?

**A**: No, use existing `edit_page_original_notion_page_id` field to reference the source `notion_database_pages` entry.

#### 3. Function Interface

**Q**: Should the function have a similar signature to Method #1?

**A**: Yes, but with `CreatePageParameters['parent']` instead of `CreateDatabaseParameters['parent']`. Expected parent format: `{ type: 'database_id', database_id: 'some-database-id' }`

#### 4. Page Title Format

**Q**: What should be the page title format?

**A**: Use the root document's `canonical_document_title`

#### 5. Return Type

**Q**: Should return type be similar to Method #1?

**A**: No, return simpler type:

```typescript
interface CreateEditPageResult {
  newNotionPageId: string;
  blocksCreatedCount: number;
}
```

#### 6. Rich Text Content

**Q**: How to handle rich text content from `json_content`?

**A**: Directly use it without conversion - it's already in `TextRichTextItemRequest[]` format. Create one paragraph block with all the rich text content.

#### 7. API Strategy

**Q**: Create all blocks at once or level by level?

**A**: Level by level (Option B) for better reliability and mapping accuracy, even though it requires more API calls.

#### 8. Error Handling

**Q**: What to do if creation fails partway through?

**A**: Store successfully created blocks with mappings, update page description to indicate partial creation, return success=false with partial results.

#### 9. Mapping Timing

**Q**: How to ensure mapping information is available?

**A**: Use Option A - Track during creation by maintaining a mapping during the block creation process.

## Implementation Status

### ✅ COMPLETED

1. **Main function file created**: `app/server/services/notion/create-toggle-page.ts`
   - Function signature implemented
   - Basic structure in place
   - Tree building and subtree extraction logic
   - Toggle block creation logic (partial)

2. **Test page created**: `app/test-toggle-page/page.tsx`
   - UI for testing the functionality
   - Form to trigger toggle page creation
   - Success/error handling

3. **API route created**: `app/api/test-toggle-page/route.ts`
   - Server action to call the main function
   - Error handling and response formatting

### 🚧 IN PROGRESS / TODO

#### Critical Missing Implementation

1. **Block storage to Supabase** - The most important missing piece
   - After creating toggle blocks in Notion, we need to fetch them back and store in `notion_blocks` table
   - Must set proper mapping: `edit_page_original_notion_page_id` → source database page ID
   - Must set `belongs_to_edit_page = true`
   - Must maintain parent-child relationships and sort order

2. **Complete toggle block creation**
   - Current implementation creates toggle blocks but doesn't handle children properly
   - Need to implement recursive children creation for nested toggles
   - Need to ensure proper ordering and nesting

3. **Error handling improvements**
   - Partial success handling
   - Page description updates on errors
   - Better logging and diagnostics

#### Secondary Tasks

4. **Type checking and cleanup**
   - Fix any remaining TypeScript errors
   - Add proper error types
   - Improve function documentation

5. **Testing and validation**
   - Test with real data
   - Validate toggle block structure in Notion
   - Verify change detection works correctly

## Detailed Implementation Guide

### Current File Structure

```
app/server/services/notion/create-toggle-page.ts  # Main function
app/test-toggle-page/page.tsx                     # Test UI
app/api/test-toggle-page/route.ts                 # API route
```

### Key Technical Details

#### Database Schema

The `notion_blocks` table has these relevant fields:

- `notion_block_id` (PRIMARY KEY) - Notion's block ID
- `parent_notion_block_id` - Parent block for hierarchy
- `root_notion_block_id` - The Notion page ID containing this block
- `block_type` - Should be 'toggle' for toggle blocks, 'paragraph' for content
- `belongs_to_edit_page` - Should be `true`
- `edit_page_original_notion_page_id` - **CRITICAL**: Maps to source database page ID
- `canonical_document_title` - Atlas document identifier
- `sort_order` - Position within parent (0-indexed)

#### Notion API Structure for Toggle Blocks

```typescript
{
  type: 'toggle',
  toggle: {
    rich_text: [{ type: 'text', text: { content: canonicalDocumentTitle } }],
    children: [
      // Content paragraph
      {
        type: 'paragraph',
        paragraph: { rich_text: jsonContent as TextRichTextItemRequest[] }
      },
      // Child toggle blocks (added separately via API calls)
    ]
  }
}
```

#### Critical Implementation Steps Missing

1. **Block Fetching and Storage** (HIGHEST PRIORITY)

```typescript
// After creating all toggle blocks, fetch them back from Notion
const createdBlocks = await fetchBlocksRecursively({
  notionBlockId: newPageId,
  parentNotionBlockId: null,
  rootNotionBlockId: newPageId,
  notionBlockType: 'page',
  editPage: {
    belongsToEditPage: true,
    editPageOriginalNotionBlockId: '', // Not applicable for this use case
    editPageOriginalNotionPageId: '', // Will be set per block during mapping
  },
});

// Map blocks back to database pages and update mapping
for (const block of createdBlocks) {
  // Use the mapping created during block creation to determine
  // which database page this block corresponds to
  const sourceDatabasePageId = blockToPageMapping.get(block.notion_block_id);

  if (sourceDatabasePageId) {
    // Update the block record with proper mapping
    await supabase
      .from('notion_blocks')
      .update({
        edit_page_original_notion_page_id: sourceDatabasePageId,
      })
      .eq('notion_block_id', block.notion_block_id);
  }
}
```

2. **Mapping Maintenance During Creation**

```typescript
// Maintain this mapping throughout the creation process
const blockToPageMapping = new Map<string, string>(); // block_id -> database_page_id

// During toggle creation:
const toggleBlockResponse = await notion('write').blocks.children.append({
  block_id: parentBlockId,
  children: [toggleBlock],
});

// Store the mapping
const newBlockId = toggleBlockResponse.results[0].id;
blockToPageMapping.set(newBlockId, databasePage.notion_page_id);
```

### Dependencies and Imports Needed

```typescript
import { supabase } from '@/app/server/services/supabase/supabase-client';
import { fetchBlocksRecursively } from './fetch-blocks-recursively';
import { TextRichTextItemRequest } from './types';
```

### Environment Variables Required

- `NOTION_SECRET_WRITE` - For creating pages and blocks

### Testing Strategy

1. Use demo data from `_demo-data.ts`
2. Test via `/test-toggle-page` UI
3. Verify created structure in Notion
4. Check Supabase records for proper mapping
5. Test change detection by running diff algorithms

## Potential Issues and Solutions

### Issue 1: Notion API Rate Limiting

**Problem**: Level-by-level creation requires many API calls
**Solution**: The `notion()` helper already implements rate limiting and all the required measurements, no need to change anything in this part

### Issue 2: Block Ordering

**Problem**: Sort order might not be preserved across API calls
**Solution**: Create blocks in the correct order and verify sort_order in Supabase

### Issue 3: Deep Nesting

**Problem**: Very deep hierarchies might hit Notion limits
**Solution**: Test with real data and implement depth limits if needed, in this case stop before creating the Notion page and report the issue

### Issue 4: Large Content

**Problem**: Rich text content might be very large
**Solution**: Don't truncate content, preserve all content

## Success Criteria

1. **Functional Requirements**
   - ✅ Single Notion page created with hierarchical toggle blocks
   - ✅ Toggle titles show `canonical_document_title`
   - ✅ Toggle content shows rich text from `json_content`
   - ✅ Proper nesting preserves parent-child relationships
   - ❌ **CRITICAL**: All blocks stored in Supabase with correct mapping

2. **Technical Requirements**
   - ❌ **CRITICAL**: `edit_page_original_notion_page_id` correctly maps blocks to source pages
   - ✅ `belongs_to_edit_page = true` for all created blocks
   - ❌ Sort order preserved from original database pages
   - ❌ Error handling for partial failures

3. **Integration Requirements**
   - ❌ Change detection works with created toggle blocks
   - ❌ Compatible with existing diff algorithms
   - ✅ Test UI allows easy testing and validation

## Next Steps for Implementation

### Immediate Priority (Critical)

1. **Complete the block storage implementation** in `create-toggle-page.ts`
2. **Add proper mapping logic** to connect blocks back to database pages
3. **Test the complete workflow** end-to-end

### Medium Priority

1. Fix any remaining TypeScript errors
2. Improve error handling and logging
3. Add comprehensive testing

### Future Enhancements

1. Performance optimizations
2. Support for very large hierarchies
3. Better progress reporting during creation

## Code Examples and References

### Existing Patterns to Follow

- Study `createNotionEditPagesAndDatabase` for similar patterns
- Use `fetchBlocksRecursively` for block fetching
- Follow `importDatabasePagesFromNotionToSupabase` for Supabase integration

### Key Files to Reference

- `app/server/services/notion/create-edit-pages-and-edit-database.ts` - Similar implementation
- `app/server/services/notion/fetch-blocks-recursively.ts` - Block fetching patterns
- `app/server/services/notion/import-database-to-supabase.ts` - Supabase integration
- `docs/CREATE_EDIT_DATABASE.md` - Documentation for Method #1

This action plan provides a complete roadmap for finishing the toggle blocks implementation. The most critical missing piece is the block storage and mapping logic that connects the created Notion blocks back to their source database pages for change detection.
