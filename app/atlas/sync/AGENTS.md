# Atlas Sync - Markdown to Notion

> **High-Level Overview**: For architecture and concepts, see [MARKDOWN_TO_NOTION_SYNC.md](../../../docs/MARKDOWN_TO_NOTION_SYNC.md).

## Purpose

Synchronize changes from the Atlas Markdown export back to Notion database pages. This tool enables a Markdown-first workflow where changes can be made in Markdown format and then pushed back to the source Notion database.

## How It Works

### 1. Change Detection

The sync page automatically diffs the canonical Atlas Markdown file from GitHub against the current Atlas data stored in Supabase, identifying all differences between the two versions.

Changes are grouped into four categories:

- **Added**: New documents in the Markdown that don't exist in Supabase
- **Changed**: Documents with modified content, name, type, or extra fields
- **Deleted**: Documents removed from the Markdown
- **Parent Changed**: Documents moved to different parents

### 2. Change Review

All detected changes are displayed in a visual diff format with:

- Inline text diffs for content changes
- Before/after comparison for field modifications
- Parent document context for additions and deletions

### 3. Synchronization

When you click "Sync to Notion", the system triggers a Trigger.dev background task that processes changes in a specific order for safety:

1. **Content Changes** (safest - no relationship changes)
2. **Additions** (validates parent pages exist first, sorted by hierarchy)
3. **Deletions** (validates no children exist first)
4. **Parent Changes** (updates relationship properties)

**Hierarchical Sorting for Additions**: New pages are sorted by Atlas database hierarchy level and nesting depth before creation. This ensures that parent pages are created before their children, preventing relationship errors when both parent and child are being added simultaneously. For example:

- Scope pages are created first (level 0)
- Then Article pages (level 1)
- Then Section pages (level 2)
- Within each database, root-level pages are created before nested pages

**Note**: Documents affected by the nesting bug (with mappings in `notion_nesting_bug_mapping`) will have their parent changes **skipped** to preserve manual corrections. See [NOTION_NESTING_BUG_FIX.md](../../../docs/NOTION_NESTING_BUG_FIX.md).

## Change Detection Algorithm

The sync system uses a sophisticated tree diffing algorithm to detect changes between the Atlas Markdown file and Supabase data.

### Change Type Details

The four change types have important behavioral characteristics:

- **Added**: New documents (UUID exists in Markdown only)
- **Deleted**: Removed documents (UUID exists in Supabase only)
- **Changed**: Field modifications to `type`, `name`, `content`, and type-specific extra fields
  - Note: `last_modified` changes are ignored
- **Parent Changed**: Document moved to different parent (ancestry array differs)
  - Note: When parent changes, `doc_no` typically changes too, but only `parent_changed` is recorded

### Multiple Changes Per Document

A document can appear in multiple change arrays simultaneously:

- Field changes + parent change = 2 separate change records
- Each change type is logged separately for complete audit trail

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

1. If ancestry changed → `parent_changed`
2. If fields changed → `changed` (independent check, can coexist with structural changes above)

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

- Click "Stop" button to request graceful stop of the background task
- Task checks stop flag between each document operation
- Current operation completes before stopping
- Progress is preserved in task metadata

### Detailed Logging

Real-time operation log shows:

- Phase transitions (Content → Additions → Deletions → Parent Changes)
- Individual document processing
- Success/failure status for each operation
- Reason for skipped operations
- Timestamps for all events

## Configuration

### Markdown File Source

The sync system loads Atlas Markdown from different sources depending on the environment:

**Production (NODE_ENV === 'production'):**

- Loads from GitHub repository (authoritative source)
- **Repository**: `pppdns/next-gen-atlas`
- **Branch**: `main`
- **File Path**: `Sky Atlas/Sky Atlas.md`
- **Raw URL**: Configured in `ATLAS_MARKDOWN_GITHUB_RAW_URL` constant

**Local Development (NODE_ENV !== 'production'):**

- Automatically uses `exported-atlas/truncated-atlas.md` if present
- Falls back to GitHub if truncated file not found
- Truncated file contains only documents at depth ≤4 (544 docs vs 7,680 full Atlas)
- Enables fast local testing without waiting hours for full Atlas processing

**Generating Truncated File:**

```bash
npx tsx scripts/atlas-export/generate-truncated-atlas-markdown.ts
```

This reduces sync time from hours to minutes while maintaining structural fidelity for testing.

### Notion API Access

Uses `notion()` client for all Notion API operations, which requires `NOTION_API_KEY` environment variable.

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

## UUID Mapping System

### Purpose

Maintains bidirectional mappings between:

- **Notion page UUIDs**: Internal identifiers used by Notion API
- **Atlas document UUIDs**: Stable identifiers used in markdown exports

### Mapping Storage

**Database Table**: `uuid_mapping`

```sql
CREATE TABLE uuid_mapping (
  notion_page_id UUID NOT NULL UNIQUE,
  atlas_document_uuid UUID NOT NULL UNIQUE,
  PRIMARY KEY (notion_page_id, atlas_document_uuid)
);
```

**Service**: `app/server/services/supabase/uuid-mapping-service.ts`

### Usage Patterns

**During Sync to Notion:**

```typescript
// Look up Notion page ID for existing document
const notionPageId = await getNotionPageIdByAtlasUuid(atlasUuid);

// Store mapping for newly created page
await storeUuidMapping({
  notionPageId: createdPage.id,
  atlasDocumentUuid: document.uuid,
});
```

**During Export to Markdown:**

```typescript
// Convert Notion page references to Atlas UUIDs
const atlasUuid = uuidMapping.get(notionPageId);
// Use Atlas UUID in markdown links: [text](atlas-uuid)
```

## Audit Logging

### Purpose

Tracks all Notion API operations for accountability, debugging, and compliance.

### Schema

**Database Table**: `notion_api_audit_log`

```sql
CREATE TABLE notion_api_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL, -- 'create', 'update', 'archive'
  notion_page_id UUID NOT NULL,
  atlas_document_uuid UUID,
  database_name TEXT NOT NULL,
  request_payload JSONB NOT NULL,
  response_payload JSONB,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_batch_id UUID
);
```

**Service**: `app/server/services/supabase/audit-log-service.ts`

### Data Stored

- Complete request payload sent to Notion API
- Complete response payload received
- Success/failure status
- Error messages if failed
- Timestamp and batch ID for grouping

### Usage

```typescript
// Log successful operation
await logNotionApiOperation({
  operationType: 'create',
  notionPageId: page.id,
  atlasDocumentUuid: document.uuid,
  databaseName: 'Sections & Primary Docs',
  requestPayload: {
    /* full request */
  },
  responsePayload: {
    /* full response */
  },
  success: true,
  syncBatchId: currentBatchId,
});

// Log failed operation
await logNotionApiOperation({
  operationType: 'update',
  // ... other fields ...
  success: false,
  errorMessage: error.message,
});
```

## User Interface

### Location

`/atlas/sync` - Main synchronization interface

### Features

**1. Markdown Source Selection**

- Load from GitHub repository (default)
- Upload local markdown file
- Displays last export timestamp

**2. Change Preview**

- Shows all detected changes categorized by type
- Displays document hierarchy
- Color-coded change indicators
- Expandable details for each change

**3. Change Type Filters**

Filter checkboxes allow selective syncing of specific change types:

- **Added** - Sync new documents (checked by default)
- **Deleted** - Sync document deletions (unchecked by default)
- **Content Changes** - Sync field/content modifications (unchecked by default)
- **Parent Changes** - Sync parent relationship changes (unchecked by default)

Filters apply to the sync operation. Checkboxes are disabled while sync is running.

**4. Conflict Detection**

- Warns if Notion documents modified after markdown export
- Requires user acknowledgment to proceed
- Prevents accidental overwrites

**5. Sync Execution**

- "Sync to Notion" button triggers background task
- Real-time progress tracking via Trigger.dev metadata
- Operation count display
- Success/error reporting
- Respects current filter checkbox selections

**6. Results Display**

- Summary of operations performed
- List of errors if any occurred
- Link to view full audit log
- Automatic page revalidation

## Error Handling

### Validation Errors

**When**: Before any Notion API calls

**Checks**:

- Markdown structure validity
- UUID uniqueness
- Document number patterns
- Relationship consistency

**Response**:

- Detailed error messages with line numbers
- Actionable suggestions for fixing
- Sync does not proceed

### Notion API Errors

**Types**:

- Rate limit errors (429)
- Invalid request errors (400)
- Not found errors (404)
- Server errors (500)

**Handling**:

- **Rate limit**: Exponential backoff and retry (handled by Notion client)
- **Invalid request**: Log details, skip document, continue
- **Not found**: Log warning, skip document, continue
- **Server error**: Retry with backoff, fail after 3 attempts

**Logging**: All errors logged to audit table with full context

### Partial Sync Failures

**Scenario**: Some documents synced successfully, others failed

**Behavior**:

- Successfully synced documents committed
- UUID mappings stored for new documents
- All errors logged with document identifiers
- Partial success report generated

**Recovery**:

- User shown summary with error details
- User can reload page to retry remaining changes
- Successful operations not repeated

## Performance Characteristics

### Background Task Processing

**Single Task**: All changes processed in one Trigger.dev background task

**Why Background Task**:

- No server action timeouts (tasks can run for hours)
- Reliable progress tracking via metadata
- Graceful stopping between operations
- Survives page refreshes

**Sequential Processing**: Documents processed one at a time

**Benefits**:

- Reliable error handling per document
- Better audit log of individual operations
- Better error isolation
- Clearer tracking of success vs failure

**Rate Limiting**: Handled by existing Notion client infrastructure

### Performance Targets

- **Validation**: < 5 seconds for full Atlas
- **Transformation**: < 10 seconds for full Atlas
- **Change detection**: < 5 seconds
- **Sync operations**: Limited by Notion API rate (3 req/sec average)
- **Total sync time**: Varies based on number of changes

### Progress Tracking

- Real-time progress via Trigger.dev metadata subscription
- Current phase indicator (Content → Additions → Deletions → Parent Changes)
- Document counter (e.g., "125/7000 documents synced")
- Stop button to request graceful stop

## Notion API Constraints

### Critical Constraints

**1. Parent Property for Database Pages**

```typescript
// CORRECT: Always use database_id for database pages
{
  parent: {
    type: 'database_id',
    database_id: 'database-uuid'
  }
}

// WRONG: Never use page_id for database pages
{
  parent: {
    type: 'page_id',
    page_id: 'some-page-uuid'  // This will fail!
  }
}
```

**2. Hierarchy via Relationship Properties**

Internal hierarchy within databases (e.g., Section → Core → Core) is managed through relationship properties:

- **Sections & Primary Docs**: "Parent Doc" / "Subdocs"
- **Agent Scope Database**: "Parent item" / "Sub-item"
- **Cross-database**: Various relationship properties (Articles, Annotations, Tenets, etc.)

### Platform Limitations

**Notion Sub-item Bug**:

- Notion's sub-item feature fails at deep nesting levels (10+ levels)
- Documents remain in incorrect parent locations due to platform bug
- Nesting override mappings correct this for display/export (forward direction)
- During sync, parent changes for affected documents are skipped to preserve manual corrections

See **[NOTION_NESTING_BUG_FIX.md](../../../docs/NOTION_NESTING_BUG_FIX.md)** for complete documentation.

### Rich Text Constraints

Notion's API enforces strict limits on rich text arrays that affect content-heavy documents:

**1. Character Limit Per Element (2000)**

Each `rich_text` element's `text.content` field cannot exceed 2000 characters. The converter automatically splits long text at word boundaries while preserving formatting annotations.

**2. Array Length Limit (100 elements)**

Each `rich_text` array cannot exceed 100 elements. This affects documents with many inline links (e.g., tables with multiple URLs per cell).

The converter handles this by:

1. Merging adjacent text elements with identical annotations
2. Truncating if still over limit (with visible marker)

**Impact**: Documents like large tables with many hyperlinks may be truncated. The truncation is visible in Notion as `[...content truncated due to Notion limit...]`.

**Implementation**: See `app/server/markdown/markdown-to-rich-text.ts` - exports `NOTION_RICH_TEXT_MAX_LENGTH` (2000) and `NOTION_RICH_TEXT_MAX_ELEMENTS` (100).

## Technical Architecture

### Components

```
app/atlas/sync/
├── page.tsx                       # Server component - diffs and fetches data
├── content.tsx                    # Client component - UI and realtime progress tracking
├── _actions/
│   ├── sync-actions.ts            # Server actions for triggering/stopping sync
│   └── trigger-auth.ts            # Server action for creating public access tokens
├── _lib/
│   ├── notion-property-builder.ts # Builds Notion property objects
│   └── atlas-database-mapper.ts   # Derives database names from document types
└── AGENTS.md                      # This file
```

**Background Task:**

```
app/server/services/trigger/
└── markdown-notion-sync-task.ts   # Trigger.dev task for sync operations
```

**Supporting Services:**

```
app/server/services/
├── supabase/
│   ├── audit-log-service.ts       # Audit logging for all Notion API operations
│   ├── uuid-mapping-service.ts    # UUID mapping persistence for new pages
│   ├── notion-nesting-bug-mappings.ts # Nesting bug mapping helpers
│   └── markdown-notion-sync-lock.ts # Sync lock management
```

### Data Flow

1. **Server** (page.tsx): `diffAtlasScopeTreeLists()` → AtlasDiffResult
2. **Client** (content.tsx): User clicks "Sync to Notion"
3. **Client**: Calls `triggerMarkdownNotionSync()` server action
4. **Server Action**: Triggers Trigger.dev task, returns run ID
5. **Client**: Subscribes to task progress via `useRealtimeRun` hook
6. **Background Task**: Processes all changes sequentially
   - Acquires sync lock
   - Checks stop flag between operations
   - Updates metadata with progress
   - Makes Notion API calls (update, create, delete)
   - Stores UUID mappings for new pages
   - Logs all operations to audit table
   - Releases lock on completion
7. **Client**: Displays real-time progress and final summary

## Testing

### Unit Tests

**Coverage**: 22 unit tests with 100% pass rate

**Test Files**:

- `app/server/services/supabase/__tests__/notion-nesting-bug-mappings.test.ts`
- `app/server/services/supabase/__tests__/uuid-mapping-service.test.ts`
- `app/server/services/supabase/__tests__/audit-log-service.test.ts`

**Test Scope**:

- UUID mapping service (create, lookup, batch operations)
- Audit log service (create, query operations)
- Reverse nesting overrides
- Change detection (all change types)
- Property building (all property types)

**Run Tests**:

```bash
# Run all sync tests
npm run test:run -- app/atlas/sync

# Run with coverage
npm run test:coverage -- app/atlas/sync
```

**Mock Implementation**: `app/server/services/notion/__tests__/notion-client.mock.ts`

### Integration Tests

**Status**: Not yet implemented

**Planned Tests**:

- End-to-end sync workflow (markdown → Notion → Supabase)
- Error recovery and partial failure handling
- Performance testing with large datasets
- Round-trip consistency validation

### Test Databases

Test Notion databases can be created using:

```bash
npx tsx scripts/create-test-notion-databases.ts
```

This creates test versions of all Atlas databases with `[TEST]` prefix for safe testing.

### Local Testing with Truncated Atlas

**Challenge**: The full production Atlas contains 7,680 documents and takes hours to process during sync operations, making local development and testing impractical.

**Solution**: A truncated Atlas markdown file is provided for local testing that contains only documents at depth ≤4 (544 documents, 9% of original size).

**Generating the Truncated File:**

```bash
npx tsx scripts/atlas-export/generate-truncated-atlas-markdown.ts
```

This script:

- Loads the canonical Atlas markdown from GitHub
- Parses it to Export Tree format
- Filters out all documents deeper than depth 4 using semantic depth calculation
- Exports the truncated tree to `exported-atlas/truncated-atlas.md`

**Automatic Local Loading:**

The sync system automatically uses the truncated file in local development:

```typescript
// In loadAtlasMarkdownForSync()
if (NODE_ENV !== 'production') {
  // Try to load truncated-atlas.md
  // Falls back to GitHub if not found
} else {
  // Production: always fetch from GitHub
}
```

**Benefits:**

- **Fast iteration**: Sync operations complete in minutes instead of hours
- **Same structure**: Maintains full hierarchical fidelity for testing
- **Automatic switching**: No code changes or environment variables needed
- **Production safety**: GitHub source always used in production

**File Details:**

- **Location**: `exported-atlas/truncated-atlas.md`
- **Size**: 246KB (vs 2.6MB original)
- **Documents**: 544 (vs 7,680 original)
- **Max depth**: 4 (Scope → Article → Section → Core/Type Spec/etc.)
- **Committed**: Yes, checked into repository for team use

**Console Logging:**

The system logs which source is being used:

```
[loadAtlasMarkdownForSync] Using local truncated Atlas file: /path/to/truncated-atlas.md
```

or

```
[loadAtlasMarkdownForSync] Fetching Atlas markdown from GitHub
```

## Features Implemented

### Core Sync Capabilities ✅

- ✅ **Content changes**: Updates to document name, content, type, and extra fields
- ✅ **Document additions**: Create new documents with proper hierarchy and relationships
- ✅ **Document deletions**: Archive documents (with child validation)
- ✅ **Parent changes**: Sync parent relationship changes (same-database and cross-database)
- ✅ **Document number sync**: doc_no field synced to Notion
- ✅ **Audit logging**: Complete audit trail of all Notion API operations with request/response payloads
- ✅ **UUID mapping persistence**: Automatic storage of UUID mappings for newly created pages
- ✅ **Progress tracking**: Real-time progress updates via Trigger.dev metadata
- ✅ **Error handling**: Graceful error handling with detailed error messages
- ✅ **Background processing**: Sync runs in Trigger.dev background task
- ✅ **Graceful stopping**: Stop button requests task to halt between operations

### Sync Phases

The task processes changes in 4 sequential phases:

1. **Content Changes** - Safest operations (no relationship changes)
2. **Additions** - Creates new pages (sorted by hierarchy, parents before children)
3. **Deletions** - Archives pages (validates no children exist)
4. **Parent Changes** - Updates parent relationships (skips nesting-bug-affected documents)

## Limitations

### Current Version

- **No undo/rollback**: Operations cannot be reversed (audit log provides history)
- **Limited property types**: Supports rich_text, title, select, and number properties; other types (multi-select, date, checkbox, etc.) are not yet supported
- **Nesting bug affected documents**: Parent changes skipped for documents with nesting bug mappings (see [NOTION_NESTING_BUG_FIX.md](../../../docs/NOTION_NESTING_BUG_FIX.md))
- **Relationship updates not synced**: Updating inter-database relationships for existing pages is not yet implemented
- When a non-Scope Atlas document doesn't have a parent, its parent relationship change will not be synced to Notion

### Future Enhancements

- User-selectable Markdown file path (configurable source for Atlas Markdown)
- Support for additional Notion property types (multi-select, date, checkbox, url, email, phone, etc.)
- Batch Notion API operations for better performance (if needed)
- Automatic conflict resolution
- Automated sync triggers on Markdown file changes in GitHub
- UI for viewing audit logs
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

## Implementation Files

### Core Sync Logic

- `app/atlas/sync/page.tsx` - Main UI page
- `app/atlas/sync/content.tsx` - Sync controls and realtime progress display
- `app/atlas/sync/_actions/sync-actions.ts` - Server actions for triggering/stopping sync
- `app/atlas/sync/_actions/trigger-auth.ts` - Server action for public access tokens
- `app/server/services/trigger/markdown-notion-sync-task.ts` - Background task implementation
- `app/atlas/sync/_lib/notion-property-builder.ts` - Notion property object builder

### Transformation Services

- `app/server/atlas/export/export-tree-to-notion-tree.ts` - Export Tree to Notion Tree conversion
- `app/server/services/supabase/notion-nesting-bug-mappings.ts` - Nesting bug mapping helpers
- `app/server/markdown/markdown-to-rich-text.ts` - Markdown to Notion Rich Text conversion

### Support Services

- `app/server/services/supabase/uuid-mapping-service.ts` - UUID mapping storage and lookup
- `app/server/services/supabase/audit-log-service.ts` - Audit log storage and queries
- `app/server/services/supabase/markdown-notion-sync-lock.ts` - Sync lock management
- `app/server/services/notion/notion-client.ts` - Notion API client with rate limiting

### Database Schema

- `app/server/database/008_create_notion_api_audit_log.sql` - Audit log table definition
- `app/server/database/007_create_uuid_mapping.sql` - UUID mapping table definition
- `app/server/database/009_create_markdown_notion_sync_lock.sql` - Sync lock table definition

### Test Files

- `app/server/services/supabase/__tests__/notion-nesting-bug-mappings.test.ts`
- `app/server/services/supabase/__tests__/uuid-mapping-service.test.ts`
- `app/server/services/supabase/__tests__/audit-log-service.test.ts`
- `app/server/atlas/diff/__tests__/markdown-supabase-diff.ts` - Diff algorithm tests

## Related Documentation

- [Markdown to Notion Sync](../../../docs/MARKDOWN_TO_NOTION_SYNC.md) - High-level sync workflow documentation
- [Atlas Data Pipeline](../../../docs/ATLAS_DATA_PIPELINE.md) - Complete pipeline overview
- [Notion Nesting Bug Fix](../../../docs/NOTION_NESTING_BUG_FIX.md) - Nesting bug context
- [UUID Mapping](../../../docs/UUID_MAPPING.md) - UUID mapping system
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
- Check Trigger.dev dashboard for task status
- Review server logs for API errors
- Review Sentry logs for errors

### Changes not appearing in Notion

- Verify Notion write API key is valid and has read-write access to the synced Notion databases
- Check page IDs match between Markdown and Notion
- Ensure database IDs are correct in configuration
- Review sync logs for specific error messages
- Verify the correct UUID is used (Notion page UUID vs Atlas document UUID - See `uuid_mapping` table)
