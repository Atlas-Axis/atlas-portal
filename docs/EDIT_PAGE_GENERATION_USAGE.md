# Toggle Blocks Usage Guide

## Overview

The Toggle Blocks functionality (Method #2) creates a single Notion page containing hierarchical toggle blocks from Atlas documents stored in the `notion_database_pages` Supabase table. This provides an alternative to creating separate edit pages (Method #1) by consolidating all content into one page with expandable/collapsible sections.

## Quick Start

### 1. Access the Test Interface

Navigate to `/test-edit-page` in your browser to access the test interface.

### 2. Configure the Test

The test interface is pre-configured with demo values:

- **Database ID**: `25ef758464c580319597e2a98756bbc8`
- **Root Page ID**: `25ef758464c5808db8bbdb67351fa26f`
- **Parent Page ID**: `25ef758464c580b9a8c5ed7f9a94c76a`

### 3. Create Edit Page

Click the "Create Edit Page" button to start the process. The system will:

1. Load pages from the specified database
2. Build a hierarchical tree structure
3. Create a new Notion page
4. Generate toggle blocks for each document
5. Store the blocks in Supabase with proper mapping

## API Usage

### Endpoint

```
POST /test-edit-page/api/test-edit-page
```

### Request Body

```json
{
  "originalNotionDatabaseId": "your-database-id",
  "rootNotionPageId": "your-root-page-id",
  "parent": {
    "type": "page_id",
    "page_id": "parent-page-id"
  }
}
```

### Response

```json
{
  "newNotionPageId": "created-page-id",
  "blocksCreatedCount": 42,
  "duration": 1234.56,
  "details": {
    "originalNotionDatabaseId": "your-database-id",
    "rootNotionPageId": "your-root-page-id",
    "parent": { ... }
  }
}
```

## Programmatic Usage

### Import the Function

```typescript
import { createNotionPageWithToggleBlocks } from '@/app/server/services/notion/create-toggle-page';
```

### Call the Function

```typescript
const result = await createNotionPageWithToggleBlocks({
  originalNotionDatabaseId: 'your-database-id',
  rootNotionPageId: 'your-root-page-id',
  parent: {
    type: 'page_id',
    page_id: 'parent-page-id',
  },
});

console.log(`Created page: ${result.newNotionPageId}`);
console.log(`Blocks created: ${result.blocksCreatedCount}`);
```

## How It Works

### 1. Data Loading

- Loads all pages from the specified Notion database
- Validates that pages are original (not edit copies)
- Ensures the root page exists and is accessible

### 2. Tree Building

- Converts database pages to tree nodes
- Builds hierarchical structure based on parent-child relationships
- Extracts subtree starting from the specified root page

### 3. Page Creation

- Creates a new Notion page with title format: `{RootPageTitle} - Editable`
- Places the page under the specified parent

### 4. Toggle Block Creation

- Creates toggle blocks hierarchically, level by level
- Each toggle block represents a database page
- Toggle title = `canonical_document_title` or `plain_text_name`
- Toggle content = rich text from `json_content` or `plain_text_content`
- Maintains parent-child relationships and sort order

### 5. Database Storage

- Fetches all created blocks from Notion
- Stores blocks in `notion_blocks` table with:
  - `edit_page_original_notion_page_id` = source database page ID
  - Proper parent-child relationships
  - Sort order preservation

## Output Structure

### Notion Page Structure

```
📄 {RootPageTitle} - Editable
├── 📁 A.1 - Main Document
│   ├── Rich text content...
│   └── 📁 A.1.1 - Child Document
│       ├── Rich text content...
│       └── 📁 A.1.1.1 - Grandchild Document
└── 📁 A.2 - Another Document
    └── Rich text content...
```

### Database Records

Each toggle block is stored in `notion_blocks` with:

- **Block Type**: `toggle` for toggle blocks, `paragraph` for content
- **Mapping**: Links back to source database page via `edit_page_original_notion_page_id`
- **Hierarchy**: Maintains parent-child relationships via `parent_notion_block_id`
- **Order**: Preserves sort order from original database pages

## Validation and Error Handling

### Input Validation

- UUID format validation for all IDs
- Required parameter checking
- Parent reference validation

### Database Validation

- Page existence verification
- Archive/trash status checking
- Edit page detection

### Content Validation

- Rich text format validation
- Content length checking
- Title presence validation

### Structure Validation

- Parent reference integrity
- Sort order consistency
- Canonical document title format

## Error Scenarios

### Common Errors

1. **Invalid UUID**: Database or page ID not in correct format
2. **Page Not Found**: Specified page doesn't exist in database
3. **Edit Pages Detected**: Source database contains edit copies
4. **Empty Subtree**: No pages found in specified subtree
5. **Invalid Parent**: Parent page doesn't exist or is inaccessible

### Error Handling

- Detailed error messages with context
- Graceful fallback for non-critical failures
- Comprehensive logging for debugging
- Partial success handling where possible

## Performance Considerations

### Batch Processing

- Database operations use batch inserts (1000 blocks per batch)
- Efficient tree traversal algorithms
- Minimal API calls to Notion

### Rate Limiting

- Uses existing Notion API rate limiting
- Respects official API limits
- Supports multiple API keys for higher throughput

### Memory Usage

- Processes pages level by level
- Avoids loading entire hierarchy into memory
- Efficient data structures for large datasets

## Monitoring and Debugging

### Logging

- Step-by-step progress logging
- Validation result reporting
- Performance timing information
- Error context and details

### Sync Status

- Tracks operation progress in database
- Prevents concurrent operations
- Records success/failure status
- Maintains operation history

## Integration with Change Detection

### Mapping System

- Each toggle block maps to source database page
- Enables efficient change detection
- Supports existing diff algorithms
- Maintains data lineage

### Edit Page Properties

- All blocks marked as edit page content
- Compatible with existing change tracking
- Supports proposal generation
- Enables workflow integration

## Best Practices

### Database Preparation

- Ensure source database contains only original pages
- Verify canonical document titles are properly formatted
- Check parent-child relationships are consistent
- Validate sort orders are sequential

### Canonical Document Title Format

The system expects canonical document titles to follow this format:

```
A.1.2.3 - Document Title
```

**Examples of valid titles:**

- `A.3.2 - Core Stability Parameters - Parameters - Sky Savings Rate`
- `A.1.1 - Main Document`
- `A.2.3.1 - Subsection Title`

**Format rules:**

- Must start with a capital letter followed by a period
- Must contain at least one number after the first period
- Can have multiple levels separated by periods (e.g., A.1.2.3)
- Must end with a dash followed by a descriptive title
- The descriptive title can contain any characters

**Regex pattern:** `/^[A-Z]\.[0-9]+(\.[0-9]+)* - .+$/`

### Content Management

- Keep content within Notion API limits (2000 chars recommended)
- Use canonical document titles for consistent identification
- Maintain proper hierarchical structure
- Regular cleanup of unused pages

### Testing

- Test with small datasets first
- Verify output in both Notion and Supabase
- Check change detection functionality
- Monitor performance with large hierarchies

## Troubleshooting

### Common Issues

1. **"No pages found in database"**
   - Check database ID is correct
   - Verify database contains pages
   - Ensure pages are not archived/trashed

2. **"No subtree found"**
   - Verify root page ID exists
   - Check parent-child relationships
   - Ensure tree structure is valid

3. **"Edit pages detected"**
   - Source database should contain only original pages
   - Remove any edit page copies
   - Use clean source database

4. **"Failed to create toggle block"**
   - Check Notion API access
   - Verify parent page exists
   - Ensure content is within limits

### Debug Information

- Check browser console for detailed logs
- Review server logs for step-by-step progress
- Verify database records in Supabase
- Check Notion page structure

## Support

For issues or questions:

1. Check the logs for detailed error information
2. Verify all parameters are correct
3. Ensure database and Notion access is working
4. Review the implementation code for specific error handling

The toggle blocks functionality is now fully implemented and ready for production use!
