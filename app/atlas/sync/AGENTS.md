# Atlas Sync - Markdown to Notion

## Purpose

Synchronize changes from the Atlas Markdown export back to Notion database pages. This tool enables a Markdown-first workflow where changes can be made in Markdown format and then pushed back to the source Notion database.

## How It Works

### 1. Change Detection

The sync page automatically diffs the Atlas Markdown file (`exported-atlas/atlas.md`) against the current Atlas data stored in Supabase, identifying all differences between the two versions.

Changes are grouped into five categories:

- **Added**: New documents in the Markdown that don't exist in Supabase
- **Changed**: Documents with modified content, name, type, or extra fields
- **Deleted**: Documents removed from the Markdown
- **Parent Changed**: Documents moved to different parents (not synced - will be implemented later)
- **Sibling Order Changed**: Documents reordered among siblings (not synced - will be implemented later)

### 2. Change Review

All detected changes are displayed in a visual diff format with:

- Inline text diffs for content changes
- Before/after comparison for field modifications
- Parent document context for additions and deletions
- Checkboxes to selectively include/exclude changes

### 3. Synchronization

When you click "Sync Changes to Notion", the system processes changes in a specific order for safety:

1. **Content Changes** (safest - no relationship changes)
2. **Additions** (validates parent pages exist first, sorted by hierarchy)
3. **Deletions** (validates no children exist first)

**Hierarchical Sorting for Additions**: New pages are sorted by Atlas database hierarchy level and nesting depth before creation. This ensures that parent pages are created before their children, preventing relationship errors when both parent and child are being added simultaneously. For example:

- Scope pages are created first (level 0)
- Then Article pages (level 1)
- Then Section pages (level 2)
- Within each database, root-level pages are created before nested pages

**Note**: Structural changes (parent_changed, sibling_order_changed) are **not synced** yet. These will be implemented in a future iteration to handle moved documents.

## Safety Features

### Parent Validation

Before creating a new page, the system validates that parent pages exist:

#### Internal Parent Validation (same-database)

For internally nested databases (Sections & Primary Docs, Agent Scope Database):

1. Checks if a relationship parent is specified in the document's ancestry
2. **Filters to same-database parents only**: Internal parent relationships only exist within the same Notion database
   - Cross-database parents (e.g., Article → Section) are filtered out
   - Only same-database parents (e.g., Section → Core in "Sections & Primary Docs") are validated
3. **If a same-database parent IS specified**: Validates that the parent page exists using Notion API
   - If parent doesn't exist, skips creation and returns a warning
   - Prevents orphaned pages and broken relationships
4. **If NO same-database parent exists**: Creates the page normally as a root-level item in the database
   - This is perfectly valid - includes cross-database children and root items

Note: The Notion API `parent` is always set to the database ID. Parent validation only checks the relationship parent (via "Parent Doc" or "Parent item" properties) when a same-database parent is found in the ancestry.

#### Inter-Database Parent Validation (cross-database)

For inter-database relationships (e.g., Article → Section, Section → Annotation):

1. Identifies the immediate parent from the document's ancestry
2. Determines if the parent is in a different database
3. **If a cross-database parent IS found**: Validates that the parent page exists using Notion API
   - If parent doesn't exist, skips creation and returns a warning
   - Sets the relationship property to link child to parent (e.g., "Parent Article" property on Section)
4. **Only immediate parent relationships are set**, not relationships to all ancestors
   - Notion automatically updates the reverse relationship (parent's child array)

### Child Validation (Deletions)

Before deleting a page, the system:

1. Queries the child relationship property (only for databases where there is internal hierarchy)
2. If any children exist, skips deletion and logs a warning
3. Prevents bad end states for relationships, and data loss

### Graceful Stopping

- Click "Stop" button to halt sync gracefully
- Current operation completes before stopping
- Remaining changes are skipped
- Progress details are preserved in local state (not persisted)

### Detailed Logging

Real-time operation log shows:

- Phase transitions (Content → Additions → Deletions)
- Individual document processing
- Success/failure status for each operation
- Reason for skipped operations
- Timestamps for all events

## Configuration

### Markdown File Path

Currently: `exported-atlas/atlas.md`

This path is configurable in `app/atlas/sync/page.tsx` (will be made user-configurable in future to use the Markdown Atlas stored in GitHub in production).

### Notion API Access

Uses `notion('write')` client for write operations, which requires `NOTION_SECRET_WRITE` environment variable.

Read operations (validation, checks) use `notion('write')` client with `NOTION_SECRET_WRITE`.

## Database Support

### Internally Nested Databases

Two Notion databases support parent-child relationships within the same database:

1. **Sections & Primary Docs**
   - Parent property: "Parent Doc"
   - Child property: "Subdocs"
   - Atlas document types: Section, Core, Type Specification, Active Data Controller

2. **Agent Scope Database**
   - Parent property: "Parent item"
   - Child property: "Sub-item"
   - Atlas document types: Core, Active Data Controller

When creating pages in these Notion databases with a parent in the same database, the system:

- Sets the parent object to the database itself (`parent.database_id`)
- Sets the parent relationship property (e.g., "Parent Doc", "Parent item") to establish internal hierarchy

#### Notion Parent vs. Relationship Properties

**Important**: When creating pages in Notion databases:

- The `parent` property in Notion API calls is **always** set to the database ID (`parent.database_id`)
- Internal hierarchy between pages (e.g., Section → Core → Core) is managed **only** through relationship properties (e.g., "Parent Doc", "Parent item", "Subdocs")
- The Notion API `parent.page_id` is **never** used in this system

This distinction is critical for maintaining proper database structure in Notion.

### Extra Fields

The system handles extra fields for specific document types:

- **Type Specification**: Components, Doc Identifier Rules, Additional Logic, Type Category, Type Name, Type Overview
- **Scenario**: Description, Finding, Additional Guidance
- **Scenario Variation**: Description, Finding, Additional Guidance
- **Needed Research**: Content

See [ATLAS_EXTRA_FIELDS.md](../../../docs/ATLAS_EXTRA_FIELDS.md) to understand how extra fields work.

## Technical Architecture

### Components

```
app/atlas/sync/
├── page.tsx                       # Server component - diffs and fetches data
├── content.tsx                    # Client component - UI and sync orchestration
├── _actions/
│   └── sync-actions.ts            # Server actions for Notion API calls
├── _lib/
│   ├── sync-orchestrator.ts       # Coordinates sync process
│   ├── notion-property-builder.ts # Builds Notion property objects
│   └── atlas-database-mapper.ts   # Derives database names from document types
└── README.md                      # This file
```

### Data Flow

1. **Server** (page.tsx): `diffAtlasScopeTreeLists()` → AtlasDiffResult
2. **Client** (content.tsx): User clicks "Sync Changes"
3. **Orchestrator**: `syncChangesToNotion()` processes changes in order
   - Receives full AtlasDiffResult with document lookup maps
   - Passes document maps to all server actions for Notion database derivation
4. **Server Actions**: Make Notion API calls (update, create, delete)
   - Derive Notion database names from Atlas document type and ancestry
   - Handle Core/Active Data Controller disambiguation using ancestry
5. **Client**: Updates UI with progress and logs

### Testing

All components have comprehensive unit tests using a mock Notion API client:

```bash
# Run all sync tests
npm run test:run -- app/atlas/sync

# Run with coverage
npm run test:coverage -- app/atlas/sync
```

Mock implementation: `app/server/services/notion/__tests__/notion-client.mock.ts`

## Limitations

### Current Version

- **No moved document detection**: Structural changes (parent_changed, sibling_order_changed) are detected but not yet synced - will be implemented in a future iteration
- **No batch operations**: Pages are processed one at a time
- **No background processing**: Progress stops on page refresh
- **No undo/rollback**: Operations cannot be reversed
- **Limited property types**: Supports rich_text, title, select, and number properties; other types (multi-select, date, checkbox, etc.) are not yet supported
- **Document number not synced**: The doc_no field is not currently synced to Notion
- **Sort order not synced**: The sort_order field ("No.") in "Sections & Primary Docs" database is not currently synced
- **Relationship updates not synced**: Updating inter-database relationships for existing pages is not yet implemented
- When a non-Scope Atlas document doesn't have a parent, its parent relationship change will not be synced to Notion.
- Inter-database parent relationships for documents in Agent Scope Database don't have parent relationships in Notion, even though it should be defined. These are skipped during the sync

### Future Enhancements

- Sync doc_no field (currently not synced)
- Log all changes made through the Notion API during sync to get an audit log
- Sync sort_order ("No.") field for "Sections & Primary Docs" database (currently not synced)
- User-selectable Markdown file path (will default to GitHub Atlas Markdown in production)
- Support for additional Notion property types (multi-select, date, checkbox, url, email, phone, etc.)
- Batch Notion API operations for better performance
- Automatic conflict resolution
- Automated sync triggers on Markdown file changes in GitHub
- Handle the case when a document doesn't have a parent document and it's not a Scope document
- Fix inter-database parent relationships for documents in Agent Scope Database. Currently, they don't have parent relationships in Notion, even though it should be defined

## Implementation Notes

### Database Derivation (No Supabase Dependency)

The sync system derives Atlas database names from document types and ancestry without querying Supabase:

- **Most types**: Direct mapping (e.g., Scope → Scopes, Article → Articles)
- **Core/Active Data Controller**: Disambiguated by checking ancestry against known agent root section UUIDs
  - If any ancestor matches agent roots → `Agent Scope Database`
  - Otherwise → `Sections & Primary Docs`

This approach:

- Works for both existing documents (in Supabase) and new documents (only in Markdown)
- Eliminates the performance overhead of loading page mappings from Supabase
- Matches the proven logic from `atlas-markdown-importer.ts`
- Enables correct synchronization of new documents being added from Markdown that don't exist in Supabase yet

## Related Documentation

- [Atlas Diffing](../../../docs/ATLAS_DIFFING.md) - How the diff algorithm works
- [Atlas Document Numbering](../../../docs/ATLAS_DOCUMENT_NUMBERING_RULES.md) - Document numbering rules
- [Atlas Markdown Syntax](../../../docs/ATLAS_MARKDOWN_SYNTAX.md) - Markdown format specification

## Troubleshooting

### "Parent page not found" errors

This error occurs when a document specifies a relationship parent (via ancestry) but that parent doesn't exist in Notion.

- Check that the specified parent document exists in Notion and hasn't been deleted or archived
- Verify parent UUIDs match between Markdown and Supabase
- Verify the correct UUID is used (Notion page UUID vs Atlas document UUID - See `uuid_mapping` table)
- Note: Having no parent is fine - this error only occurs when a parent IS specified but doesn't exist

### "Page has children" errors

- Delete or move child documents first
- Check all relationship properties (Subdocs, Annotations, Tenets, etc.)
- Use Notion UI to verify relationships

### Sync hangs or times out

- Check Notion API rate limits
- Verify network connectivity
- Check browser console for JavaScript errors
- Review server logs for API errors
- Review Sentry logs for errors

### Changes not appearing in Notion

- Verify Notion write API key is valid and has read-write access to the synced Notion databases
- Check page IDs match between Markdown and Notion
- Ensure database IDs are correct in configuration
- Review sync logs for specific error messages
- Verify the correct UUID is used (Notion page UUID vs Atlas document UUID - See `uuid_mapping` table)
