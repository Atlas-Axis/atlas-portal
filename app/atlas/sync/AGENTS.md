# Atlas Sync - Markdown to Notion

## Purpose

Synchronize changes from the Atlas Markdown export back to Notion database pages. This tool enables a Markdown-first workflow where changes can be made in Markdown format and then pushed back to the source Notion database.

## How It Works

### 1. Change Detection

The sync page automatically diffs the canonical Atlas Markdown file from GitHub against the current Atlas data stored in Supabase, identifying all differences between the two versions.

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

## Change Detection Algorithm

The sync system uses a sophisticated tree diffing algorithm to detect changes between the Atlas Markdown file and Supabase data.

### Change Type Details

The five change types have important behavioral characteristics:

- **Added**: New documents (UUID exists in Markdown only)
- **Deleted**: Removed documents (UUID exists in Supabase only)
- **Changed**: Field modifications to `type`, `name`, `content`, and type-specific extra fields
  - Note: `last_modified` changes are ignored
- **Parent Changed**: Document moved to different parent (ancestry array differs)
  - Note: When parent changes, `doc_no` typically changes too, but only `parent_changed` is recorded
  - Mutually exclusive with Sibling Order Changed
- **Sibling Order Changed**: Document reordered among siblings (`doc_no` changed, same ancestry)
  - Note: Mutually exclusive with Parent Changed

### Multiple Changes Per Document

A document can appear in multiple change arrays simultaneously:

- Field changes + parent change = 2 separate change records
- Field changes + sibling order change = 2 separate change records
- Each change type is logged separately for complete audit trail
- However, `parent_changed` and `sibling_order_changed` are mutually exclusive (only one per document)

### Ancestry Tracking Design

**Why track ancestry during tree traversal?**

The algorithm tracks ancestry during recursive tree traversal rather than parsing `doc_no` values. This design decision solves a critical problem:

**Problem with doc_no parsing:**

- Parsing hierarchical numbers like `"A.1.2.3"` → `["A", "A.1", "A.1.2"]` works for most documents
- However, Needed Research documents use global numbering (`NR-1`, `NR-2`) regardless of parent
- Moving `NR-1` between parents wouldn't be detected because the number stays the same

**Solution:**

- Build `uuidToAncestry` map during recursive tree traversal
- Each document stores its actual parent chain as an array of UUIDs
- Works correctly for all document types (hierarchical or global numbering)

**Example:**

```typescript
// Standard hierarchical document: A.1.2.3
ancestry: ['uuid-A.1.2', 'uuid-A.1', 'uuid-A'];

// Needed Research with global numbering: NR-1
ancestry: ['uuid-article', 'uuid-scope'];
```

### Change Detection Priority

The algorithm applies this priority logic when detecting changes:

1. If ancestry changed → `parent_changed` (takes priority)
2. Else if `doc_no` changed → `sibling_order_changed`
3. If fields changed → `changed` (independent check, can coexist with structural changes above)

### API Reference

The diff function is called during page load to prepare the sync UI:

```typescript
async function diffAtlasScopeTreeLists(): Promise<AtlasDiffResult>;

interface AtlasDiffResult {
  changes: GroupedAtlasChanges;
  originalIdsToDocuments: Map<string, ExportAtlasTreeBaseDocument>;
  newIdsToDocuments: Map<string, ExportAtlasTreeBaseDocument>;
}

interface GroupedAtlasChanges {
  added: AtlasDocumentChange[];
  deleted: AtlasDocumentChange[];
  changed: AtlasDocumentChange[];
  parent_changed: AtlasDocumentChange[];
  sibling_order_changed: AtlasDocumentChange[];
}
```

Example usage:

```typescript
import { diffAtlasScopeTreeLists } from '@/app/server/atlas/diff/markdown-supabase-diff';

const result = await diffAtlasScopeTreeLists();

console.log(`Added: ${result.changes.added.length}`);
console.log(`Deleted: ${result.changes.deleted.length}`);
console.log(`Changed: ${result.changes.changed.length}`);
console.log(`Parent changed: ${result.changes.parent_changed.length}`);
console.log(`Sibling order changed: ${result.changes.sibling_order_changed.length}`);
```

### Testing

The diff algorithm has comprehensive test coverage:

- **Test file**: `app/server/atlas/diff/__tests__/markdown-supabase-diff.ts`
- **Test count**: 28 test cases
- **Coverage**: All 5 change types, multiple simultaneous changes, mutual exclusivity rules, Needed Research global numbering, deeply nested documents (9+ levels), documents without UUIDs, data inconsistencies

Run tests:

```bash
npm run test:run -- app/server/atlas/diff/__tests__/markdown-supabase-diff.ts
```

### Performance Characteristics

- **Time Complexity**: O(n) - single pass per tree
- **Space Complexity**: O(n) - three lookup maps (UUID to document, UUID to ancestry, UUID to database)
- **Lookups**: O(1) - Map-based lookups for all operations

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

### Markdown File Source

The sync system loads the canonical Atlas Markdown file directly from GitHub:

- **Repository**: `pppdns/next-gen-atlas`
- **Branch**: `main`
- **File Path**: `Sky Atlas/Sky Atlas.md`
- **Raw URL**: Configured in `ATLAS_MARKDOWN_GITHUB_RAW_URL` constant

This ensures that the sync always operates against the authoritative source of truth for the Atlas.

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
│   └── sync-actions.ts            # Server actions for Notion API calls (with audit logging)
├── _lib/
│   ├── sync-orchestrator.ts       # Coordinates sync process
│   ├── notion-property-builder.ts # Builds Notion property objects
│   └── atlas-database-mapper.ts   # Derives database names from document types
└── AGENTS.md                      # This file
```

**Supporting Services:**

```
app/server/services/
├── supabase/
│   ├── audit-log-service.ts       # Audit logging for all Notion API operations
│   └── uuid-mapping-service.ts    # UUID mapping persistence for new pages
└── notion/
    └── reverse-nesting-overrides.ts # Reverses nesting bug fixes (not yet integrated)
```

### Data Flow

1. **Server** (page.tsx): `diffAtlasScopeTreeLists()` → AtlasDiffResult
2. **Client** (content.tsx): User clicks "Sync Changes"
3. **Orchestrator**: `syncChangesToNotion()` processes changes in order
   - Receives full AtlasDiffResult with document lookup maps
   - Passes document maps to all server actions for Notion database derivation
4. **Server Actions**: Make Notion API calls (update, create, delete)
   - Derive Notion database names from Atlas document type and database tracking maps
   - Handle Core/Active Data Controller disambiguation using database tracking
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

## Features Implemented

### Core Sync Capabilities ✅

- ✅ **Content changes**: Updates to document name, content, type, and extra fields
- ✅ **Document additions**: Create new documents with proper hierarchy and relationships
- ✅ **Document deletions**: Archive documents (with child validation)
- ✅ **Parent changes**: Sync parent relationship changes (same-database and cross-database)
- ✅ **Sibling order changes**: Sync document numbering and sort order changes
- ✅ **Document number sync**: doc_no field now synced to Notion
- ✅ **Sort order sync**: sort_order ("No.") field now synced for applicable databases
- ✅ **Audit logging**: Complete audit trail of all Notion API operations with request/response payloads
- ✅ **UUID mapping persistence**: Automatic storage of UUID mappings for newly created pages
- ✅ **Progress tracking**: Real-time progress updates and detailed operation logs
- ✅ **Error handling**: Graceful error handling with detailed error messages
- ✅ **Batch ID tracking**: All operations grouped by sync batch for easy tracking

### Sync Phases

The orchestrator processes changes in 5 sequential phases:

1. **Content Changes** - Safest operations (no relationship changes)
2. **Additions** - Creates new pages (sorted by hierarchy, parents before children)
3. **Deletions** - Archives pages (validates no children exist)
4. **Parent Changes** - Updates parent relationships (same-database and cross-database)
5. **Sibling Order Changes** - Updates document numbering and sort order

## Limitations

### Current Version

- **No batch operations**: Pages are processed one at a time (intentional for better error isolation)
- **No background processing**: Progress stops on page refresh
- **No undo/rollback**: Operations cannot be reversed (audit log provides history)
- **Limited property types**: Supports rich_text, title, select, and number properties; other types (multi-select, date, checkbox, etc.) are not yet supported
- **Reverse nesting overrides not integrated**: Function exists but not yet called in sync workflow (see [MARKDOWN_TO_NOTION_SYNC_REMAINING_TASKS.md](../../../docs/MARKDOWN_TO_NOTION_SYNC_REMAINING_TASKS.md))
- **Relationship updates not synced**: Updating inter-database relationships for existing pages is not yet implemented
- When a non-Scope Atlas document doesn't have a parent, its parent relationship change will not be synced to Notion

### Future Enhancements

- Integrate reverse nesting overrides for Notion bug workaround
- User-selectable Markdown file path (configurable source for Atlas Markdown)
- Support for additional Notion property types (multi-select, date, checkbox, url, email, phone, etc.)
- Batch Notion API operations for better performance (if needed)
- Automatic conflict resolution
- Automated sync triggers on Markdown file changes in GitHub
- UI for viewing audit logs
- Dry-run mode for previewing changes
- Handle the case when a document doesn't have a parent document and it's not a Scope document

## Implementation Notes

### Database Derivation (Database Tracking)

The sync system uses **database tracking from the Export Tree structure** for reliable database identification:

**How it works:**

1. **Markdown Import** (`atlas-markdown-importer.ts`): When parsing markdown into Export Tree format, the `mapTypeToDatabase()` function determines each document's database:
   - Most types map directly (e.g., Scope → Scopes, Article → Articles)
   - Core/ADC documents use parent detection:
     - If immediate parent name is `AGENT_ROOT_DOCUMENT_NAME` → Agent Scope Database
     - If any ancestor is from Agent Scope Database → Agent Scope Database
     - Otherwise → Sections & Primary Docs
   - Database information is encoded as collection names in the Export Tree

2. **Diff Stage** (`atlas-diff.ts`): During diffing, `buildLookupMaps()` simply reads the collection names from the Export Tree and creates a `uuidToDatabase` tracking map:
   - `getDatabaseFromCollectionName()` converts collection name to database name
   - No additional Agent Scope Database detection occurs here

3. **Sync Stage**: The sync library receives the `uuidToDatabase` map and uses direct UUID lookup to identify each document's database - no name checks or ancestry traversal needed

This architecture separates concerns properly:

- **Detection** happens once during markdown import
- **Tracking** happens during diff (reading pre-determined collection names)
- **Usage** happens during sync (simple map lookup)

This approach:

- Works for both existing documents (in Supabase) and new documents (only in Markdown)
- Eliminates the performance overhead of loading page mappings from Supabase
- Provides type-safe, reliable database identification based on tree structure
- Enables correct synchronization of new documents being added from Markdown that don't exist in Supabase yet
- Uses natural Notion relationships established via relationship properties

## Related Documentation

- [Atlas Document Numbering](../../../docs/ATLAS_DOCUMENT_NUMBERING_RULES.md) - Document numbering rules
- [Atlas Markdown Syntax](../../../docs/ATLAS_MARKDOWN_SYNTAX.md) - Markdown format specification
- [Atlas Tree Structures](../../../docs/ATLAS_TREE_STRUCTURES.md) - Export tree architecture
- Implementation: `app/server/atlas/diff/atlas-diff.ts` - Core diff algorithm
- Types: `app/server/atlas/export/types.ts` - TypeScript type definitions

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
