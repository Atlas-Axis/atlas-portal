# Atlas Markdown → Notion Synchronization

## Overview

This document describes the Markdown → Notion synchronization workflow, which enables external editing of Atlas documents in markdown format with subsequent synchronization back to Notion databases. This is the reverse direction of the main Atlas data pipeline (Notion → Supabase → Markdown).

**Pipeline Context:**

The complete Atlas data pipeline consists of two workflows:

1. **Forward Pipeline** (Notion → Supabase → Markdown): Primary workflow where Atlas documents are imported from Notion, stored in Supabase, and exported to markdown/JSON formats
2. **Reverse Pipeline** (Markdown → Notion): This workflow - enables external markdown editing with sync back to Notion

See **[ATLAS_DATA_PIPELINE.md](./ATLAS_DATA_PIPELINE.md)** for complete pipeline architecture.

### Purpose

- Enable markdown-first editing workflow for Atlas documents
- Support external contributors without Notion access
- Facilitate bulk editing and refactoring operations
- Complete the bidirectional data flow (changes made in markdown can flow back to Notion)
- Enable collaboration between Notion-based and markdown-based editors

### Key Features

- ✅ **Change Detection**: Automatically detects new, modified, moved, and deleted documents
- ✅ **Structural Changes**: Syncs parent changes (cross-database and same-database) and sibling ordering
- ✅ **Dry-Run Preview**: Preview all operations before executing with "Preview Changes" button
- ✅ **Audit Logging**: Complete audit trail of all Notion API operations
- ✅ **UUID Mapping**: Automatic storage and lookup of UUID mappings for document references
- ✅ **Error Handling**: Graceful error handling with detailed logging and partial success tracking
- ✅ **Progress Tracking**: Real-time progress updates during sync operations (batch-level granularity)
- ✅ **Batch Processing**: Documents processed in batches of 25 to prevent server action timeouts
- ✅ **Stop Support**: Stop button halts sync between batches
- ✅ **Automatic Round-Trip**: Changes synced to Notion automatically flow back to Supabase via hourly import task

## Workflow Architecture

### High-Level Data Flow

This workflow takes an externally-edited Atlas markdown file and syncs all changes back to Notion databases.

```
┌──────────────────┐
│ Markdown File    │  ← Edited externally in GitHub repository
│ (GitHub Repo)    │    (pppdns/next-gen-atlas)
│ Sky Atlas.md     │
└────────┬─────────┘
         │
         │ [User triggers sync via /atlas/sync UI]
         │
         ▼
┌──────────────────┐
│ 1. VALIDATE      │◄── validate-atlas-markdown.ts
│    Markdown      │    • Structure validation
│                  │    • UUID uniqueness
│                  │    • Document numbering
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 2. PARSE TO      │◄── atlas-markdown-importer.ts
│    EXPORT TREE   │    • Line-by-line parsing
│                  │    • Extract metadata
│                  │    • Build hierarchy
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 3. TRANSFORM TO  │
│    NOTION FORMAT │
├──────────────────┤
│ a) Export Tree → │◄── export-tree-to-notion-tree.ts
│    Notion Tree   │    • Reconstruct Notion structure
│                  │
│ b) Nesting Bug   │◄── sync-orchestrator.ts (Phase 4)
│    Handling      │    • Skip parent changes for
│                  │      affected documents
│                  │
│ c) Markdown →    │◄── markdown-to-rich-text.ts
│    Rich Text     │    • Convert to Notion Rich Text
│                  │    • Rewrite mention UUIDs
│                  │
│ d) Atlas UUID →  │◄── uuid-mapping-service.ts
│    Notion UUID   │    • Lookup existing mappings
│                  │    • Prepare for new mappings
│                  │
│ e) Build Props & │◄── notion-property-builder.ts
│    Relations     │    • Construct Notion properties
│                  │    • Build relationship arrays
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 4. DETECT        │◄── detect-markdown-changes.ts
│    CHANGES       │    • Compare with Supabase data
│                  │    • Categorize changes
│                  │    • Generate change sets
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 5. SYNC TO       │◄── sync-orchestrator.ts
│    NOTION VIA    │◄── sync-actions.ts
│    API           │    • Sequential processing
├──────────────────┤    • Error handling
│ • Create pages   │    • Audit logging
│ • Update pages   │
│ • Archive pages  │
└────────┬─────────┘
         │
         │ [Changes now in Notion]
         │
         ▼
┌──────────────────┐
│ 6. AUTO-SYNC     │◄── notion-sync-task.ts (Trigger.dev)
│    BACK TO       │    • Hourly import task
│    SUPABASE      │    • Notion → Supabase sync
│                  │    • Changes appear in exports
└──────────────────┘
         │
         │ [Complete round-trip: Markdown → Notion → Supabase → Markdown]
         ▼
    [Updated exports available]
```

### Component Layers

The sync workflow is organized into five sequential layers, each with specific responsibilities:

**Layer 1: Validation & Parsing**

- **Purpose**: Ensure markdown is valid before processing
- **Input**: Raw markdown file content
- **Operations**:
  - Syntax validation (title format, heading levels)
  - Structure verification (nesting rules, hierarchy)
  - UUID uniqueness checks
  - Document number pattern validation
  - Relationship consistency verification
- **Output**: Export Tree (external representation)
- **Files**: `scripts/validate-atlas-markdown.ts`, `app/server/markdown/atlas-markdown-importer.ts`

**Layer 2: Transformation**

- **Purpose**: Convert Export Tree back to Notion's internal format
- **Input**: Export Tree from markdown parsing
- **Operations** (5 sequential steps):
  1. Export Tree → Notion Tree structure conversion
  2. Nesting bug handling (skip parent changes for affected documents)
  3. Markdown → Notion Rich Text with mention UUID rewriting
  4. Atlas UUID → Notion UUID mapping lookups
  5. Build Notion property objects and relationship arrays
- **Output**: Notion API-ready property objects
- **Files**:
  - `app/server/atlas/export/export-tree-to-notion-tree.ts`
  - `app/atlas/sync/_lib/sync-orchestrator.ts` (nesting bug handling in Phase 4)
  - `app/server/markdown/markdown-to-rich-text.ts`
  - `app/server/services/supabase/uuid-mapping-service.ts`
  - `app/atlas/sync/_lib/notion-property-builder.ts`

**Layer 3: Change Detection**

- **Purpose**: Identify what changed between markdown and current Notion state
- **Input**: Export Tree + Current Supabase data (representing current Notion state)
- **Operations**:
  - Deep comparison using Atlas UUIDs as stable identifiers
  - Categorize changes into 5 types: new, modified, deleted, parent_changed, sibling_order_changed
  - Generate detailed change sets with diff information
- **Output**: Categorized change sets
- **Files**: `app/atlas/sync/_lib/detect-markdown-changes.ts`

**Layer 4: Notion Sync**

- **Purpose**: Execute changes via Notion API
- **Input**: Change sets + Property objects
- **Operations**:
  - Create new pages (hierarchical order, parents first)
  - Update existing pages (only changed fields)
  - Archive deleted pages (leaf-first traversal)
  - Sequential processing (no batching)
  - Generate and store UUID mappings for new pages
  - Log all operations to audit table
- **Output**: Updated Notion pages + UUID mappings + Audit log entries
- **Files**:
  - `app/atlas/sync/_lib/sync-orchestrator.ts`
  - `app/atlas/sync/_actions/sync-actions.ts`
  - `app/server/services/supabase/audit-log-service.ts`

**Layer 5: Audit & Tracking**

- **Purpose**: Maintain complete history of all API operations
- **Input**: All Notion API operations (from Layer 4)
- **Operations**:
  - Store complete request/response payloads
  - Track success/failure status
  - Record timestamps and batch IDs
  - Enable debugging and compliance auditing
- **Output**: Complete change history in database
- **Storage**: `notion_api_audit_log` table in Supabase
- **Files**: `app/server/services/supabase/audit-log-service.ts`

## Change Detection

### Change Types

The system detects five types of changes:

1. **new**: Documents in markdown that don't exist in Notion
2. **modified**: Documents with content or property changes
3. **deleted**: Documents in Notion that no longer exist in markdown
4. **parent_changed**: Documents moved to a different parent (cross-database or same-database)
5. **sibling_order_changed**: Documents with changed position among siblings (doc_no or sort_order changes)

### Change Detection Algorithm

```typescript
// Load current state from Supabase
const currentPages = await loadNotionDatabasePagesFromSupabase();

// Parse markdown to Export Tree
const exportTree = parseAtlasMarkdown(markdownContent);

// Build lookup maps by Atlas UUID
const currentByUuid = new Map(currentPages.map((p) => [p.atlas_document_uuid, p]));
const exportByUuid = new Map(exportTree.map((d) => [d.uuid, d]));

// Detect new documents (in markdown but not in Supabase)
const newDocs = exportTree.filter((d) => !currentByUuid.has(d.uuid));

// Detect deleted documents (in Supabase but not in markdown)
const deletedDocs = currentPages.filter((p) => !exportByUuid.has(p.atlas_document_uuid));

// Detect modified, parent_changed, and sibling_order_changed
// by comparing properties and structure
```

## Sync Operations

### Create Pages

**Process:**

1. Sort documents by hierarchy (parents before children)
2. For each new document sequentially:
   - Build complete property object
   - Set parent to database ID (never page_id for database pages)
   - Call Notion API: `POST /pages`
   - Extract new Notion page UUID
   - Store UUID mapping immediately
   - Make new ID available for documents synced in same batch
   - Log to audit table

**Key Considerations:**

- Sequential processing (no batching) for better error handling
- Hierarchical dependencies respected
- UUID mappings stored immediately for same-sync references

### Update Pages

**Process:**

1. For each modified document:
   - Look up Notion page UUID from Atlas UUID
   - Build property update object (only changed fields)
   - Update properties: `PATCH /pages/{page_id}`
   - Update relationships separately if changed
   - Log to audit table

**Change Types Handled:**

- Content changes (markdown diff)
- Property changes (name, type, extra fields, doc_no, sort_order)
- Parent changes (cross-database and same-database)
- Sibling order changes (via doc_no and sort_order)

### Delete Pages

**Process:**

1. Start from leaf nodes, traverse up tree as parents become leaves
2. For each deleted document:
   - Look up Notion page UUID
   - Verify no children remain (prevent orphans)
   - Archive page: `PATCH /pages/{page_id}` with `{ archived: true }`
   - Keep UUID mapping (preserved forever for potential recovery)
   - Log to audit table

**Key Considerations:**

- Pages are archived, not permanently deleted
- UUID mappings preserved forever
- Children prevent parent deletion

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

**3. Conflict Detection**

- Warns if Notion documents modified after markdown export
- Requires user acknowledgment to proceed
- Prevents accidental overwrites

**4. Dry-Run Preview**

- "Preview Changes" button triggers dry-run mode
- Results written to `app/atlas/sync/dry-run-output.md` file
- Lists all Notion API calls that would be made with parameters
- Alert shows summary counts (operations that would execute vs skipped)
- No API calls, audit logs, or UUID mappings written during preview
- File is gitignored and overwritten on each dry-run

**5. Sync Execution**

- "Sync to Notion" button triggers sync
- Real-time progress tracking
- Operation count display
- Success/error reporting

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

- User shown modal with error summary
- User can reload page to retry remaining changes
- Successful operations not repeated

## Performance Characteristics

### Processing Strategy

**Batch Processing**: Documents processed in batches of 25

**Why Batching**:

- Prevents server action timeouts (60s on Vercel, 300s max)
- Enables progress updates between batches
- Allows stopping sync between batches
- Each batch takes ~10-25 seconds at Notion's rate limit

**Sequential Within Batch**: Documents within each batch processed one at a time

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
- **Sync operations**: ~25 documents per batch, limited by Notion API rate (3 req/sec average)
- **Per-batch time**: ~10-25 seconds depending on operation types
- **Total sync time**: Varies based on number of changes (e.g., 7000 changes ≈ 280 batches)

### Progress Tracking

- Real-time progress bar with percentage
- Current batch indicator (e.g., "Batch 5/280")
- Document counter (e.g., "125/7000 documents synced")
- Stop button to halt after current batch completes

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

See **[NOTION_NESTING_BUG_FIX.md](./NOTION_NESTING_BUG_FIX.md)** for complete documentation.

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

## Known Limitations

### 1. No Integration Tests

**Status**: Unit tests complete, but end-to-end tests not created

**Impact**: Full workflow reliability not validated with automated tests

**Mitigation**: Comprehensive manual testing needs to be performed

## Future Enhancements

### Webhook-Based Sync Triggers

**Current**: Manual sync or scheduled hourly task

**Future**: GitHub webhook triggers immediate sync after markdown commits

**Implementation**:

- GitHub webhook on `pppdns/next-gen-atlas` repository
- Next.js API route receives webhook
- Triggers Trigger.dev task for sync
- Reduces latency from hours to minutes

### Real-Time Collaboration

**Current**: Eventual consistency (hourly sync)

**Future**: Near real-time updates between Notion and markdown

**Implementation**:

- Notion webhook on database changes
- Immediate Supabase update
- Regenerate markdown exports
- Push to GitHub automatically

### Conflict Resolution

**Current**: Markdown always wins (with warning)

**Future**: Intelligent merge strategies

**Options**:

- Three-way merge using common ancestor
- User-selectable conflict resolution
- Per-field merge policies

### Incremental Sync

**Current**: Full Atlas comparison on each sync

**Future**: Track changes and sync only modified documents

**Implementation**:

- Store last sync timestamp
- Query Supabase for changes since timestamp
- Parse markdown and compare only changed sections
- Significant performance improvement

## Related Documentation

### Pipeline Context

- **[ATLAS_DATA_PIPELINE.md](./ATLAS_DATA_PIPELINE.md)** - ⭐ Complete Atlas data pipeline overview showing how this Markdown → Notion workflow fits into the bidirectional sync architecture
- **[ATLAS_TREE_STRUCTURES.md](./ATLAS_TREE_STRUCTURES.md)** - Dual tree architecture (Notion Tree vs Export Tree) that this workflow transforms between

### Input/Output Formats

- **[ATLAS_MARKDOWN_SYNTAX.md](./ATLAS_MARKDOWN_SYNTAX.md)** - Markdown syntax specification for Atlas documents
- **[ATLAS_MARKDOWN_IMPORT_EXPORT.md](./ATLAS_MARKDOWN_IMPORT_EXPORT.md)** - Markdown parsing and Export Tree generation
- **[ATLAS_EXTRA_FIELDS.md](./ATLAS_EXTRA_FIELDS.md)** - Extra fields for Type Specifications, Scenarios, Scenario Variations, Needed Research

### Notion Integration

- **[NOTION_IMPORT_PROCESS.md](./NOTION_IMPORT_PROCESS.md)** - Reverse workflow (Notion → Supabase) that runs after this sync completes
- **[NOTION_PROPERTY_MAPPING.md](./NOTION_PROPERTY_MAPPING.md)** - Property and relationship mappings used during transformation
- **[NOTION_NESTING_BUG_FIX.md](./NOTION_NESTING_BUG_FIX.md)** - Nesting bug workaround (parent changes skipped for affected documents)

### Supporting Systems

- **[UUID_MAPPING.md](./UUID_MAPPING.md)** - UUID mapping system for stable document references
- **[ATLAS_DOCUMENT_NUMBERING_RULES.md](./ATLAS_DOCUMENT_NUMBERING_RULES.md)** - Document numbering rules used during hierarchy reconstruction

## Implementation Files

### Core Sync Logic

- `app/atlas/sync/page.tsx` - Main UI page
- `app/atlas/sync/content.tsx` - Sync controls, batch orchestration, and status display
- `app/atlas/sync/_actions/sync-actions.ts` - Server actions for sync operations (including `runSyncBatch`)
- `app/atlas/sync/_lib/batch-sync-types.ts` - Batch sync types, constants (`SYNC_BATCH_SIZE`), and helper functions
- `app/atlas/sync/_lib/sync-orchestrator.ts` - Main orchestrator coordinating all phases (used by `runRealSync`)
- `app/atlas/sync/_lib/detect-markdown-changes.ts` - Change detection logic
- `app/atlas/sync/_lib/notion-property-builder.ts` - Notion property object builder

### Transformation Services

- `app/server/atlas/export/export-tree-to-notion-tree.ts` - Export Tree to Notion Tree conversion
- `app/server/services/supabase/notion-nesting-bug-mappings.ts` - Nesting bug mapping helpers
- `app/server/markdown/markdown-to-rich-text.ts` - Markdown to Notion Rich Text conversion

### Support Services

- `app/server/services/supabase/uuid-mapping-service.ts` - UUID mapping storage and lookup
- `app/server/services/supabase/audit-log-service.ts` - Audit log storage and queries
- `app/server/services/notion/notion-client.ts` - Notion API client with rate limiting

### Database Schema

- `app/server/database/008_create_notion_api_audit_log.sql` - Audit log table definition
- `app/server/database/007_create_uuid_mapping.sql` - UUID mapping table definition

### Testing

- `app/server/services/supabase/__tests__/notion-nesting-bug-mappings.test.ts`
- `app/server/services/supabase/__tests__/uuid-mapping-service.test.ts`
- `app/server/services/supabase/__tests__/audit-log-service.test.ts`

## Conclusion

The Atlas Markdown → Notion synchronization workflow completes the bidirectional data pipeline by enabling external markdown editing with sync back to Notion. With comprehensive error handling, audit logging, UUID mapping, and change detection, this workflow enables markdown-first editing while ensuring changes flow back into the Notion-based Atlas system.

**Implementation Status: Complete (not tested yet)**

The core sync functionality is implemented but not tested yet. It is supposed to be successfully handling all change types including structural changes (parent moves and sibling reordering). Nesting bug handling is complete (parent changes for affected documents are skipped).

**Round-Trip Data Flow:**

Once synced to Notion, changes automatically flow through the complete pipeline:

1. Markdown → Notion (this workflow)
2. Notion → Supabase (hourly import task via Trigger.dev)
3. Supabase → Export Tree → Markdown/JSON (export generation)

This ensures all systems remain synchronized and changes made in markdown become visible in all Atlas formats.
