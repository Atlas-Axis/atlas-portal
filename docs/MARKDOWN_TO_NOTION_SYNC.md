# Atlas Markdown → Notion Synchronization

> **Implementation Details**: For schemas, code examples, and detailed implementation guidance, see [Atlas Sync AGENTS.md](../app/atlas/sync/AGENTS.md).

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
- ✅ **Structural Changes**: Syncs parent changes (cross-database and same-database)
- ✅ **Mention Handling**: Converts markdown links to Notion mention objects with post-processing for new pages
- ✅ **Background Processing**: Sync runs in Trigger.dev background task (survives page refresh)
- ✅ **Audit Logging**: Complete audit trail of all Notion API operations
- ✅ **UUID Mapping**: Automatic storage and lookup of UUID mappings for document references
- ✅ **Error Handling**: Graceful error handling with detailed logging and partial success tracking
- ✅ **Progress Tracking**: Real-time progress updates via Trigger.dev metadata subscription
- ✅ **Stop Support**: Stop button requests graceful halt between operations
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
│ 1. VALIDATE      │  • Structure validation
│    Markdown      │  • UUID uniqueness
│                  │  • Document numbering
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 2. PARSE TO      │  • Line-by-line parsing
│    EXPORT TREE   │  • Extract metadata
│                  │  • Build hierarchy
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 3. TRANSFORM TO  │  • Export Tree → Notion Tree
│    NOTION FORMAT │  • Markdown → Rich Text
│                  │  • UUID mapping lookups
│                  │  • Build properties and relationships
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 4. DETECT        │  • Compare with Supabase
│    CHANGES       │  • Categorize changes
│                  │  • Generate change sets
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 5. SYNC TO       │  • Trigger.dev background task
│    NOTION VIA    │  • Create pages
│    API           │  • Update pages
│                  │  • Archive pages
│                  │  • Audit logging
└────────┬─────────┘
         │
         │ [Changes now in Notion]
         │
         ▼
┌──────────────────┐
│ 6. AUTO-SYNC     │  • Hourly import task
│    BACK TO       │  • Notion → Supabase sync
│    SUPABASE      │  • Changes appear in exports
└──────────────────┘
         │
         │ [Complete round-trip: Markdown → Notion → Supabase → Markdown]
         ▼
    [Updated exports available]
```

### Component Layers

The sync workflow is organized into five sequential layers:

**Layer 1: Validation & Parsing**

- Ensures markdown is valid before processing
- Validates syntax, structure, UUID uniqueness, and document numbering
- Outputs Export Tree (external representation)

**Layer 2: Transformation**

- Converts Export Tree back to Notion's internal format
- Handles nesting bug (skips parent changes for affected documents)
- Converts markdown to Notion Rich Text with UUID rewriting
- Builds Notion property objects and relationship arrays

**Layer 3: Change Detection**

- Compares Export Tree with current Supabase data
- Uses Atlas UUIDs as stable identifiers
- Categorizes changes into 4 types (see Change Detection section)

**Layer 4: Notion Sync**

- Executes changes via Notion API in background task
- Creates, updates, and archives pages
- Stores UUID mappings for new pages
- Logs all operations to audit table

**Layer 5: Audit & Tracking**

- Maintains complete history of all API operations
- Stores request/response payloads
- Enables debugging and compliance auditing

For detailed file paths and implementation, see [Atlas Sync AGENTS.md](../app/atlas/sync/AGENTS.md#technical-architecture).

## Change Detection

### Change Types

The system detects four types of changes:

1. **new**: Documents in markdown that don't exist in Notion
2. **modified**: Documents with content or property changes
3. **deleted**: Documents in Notion that no longer exist in markdown
4. **parent_changed**: Documents moved to a different parent (cross-database or same-database)

### Algorithm Overview

The change detection algorithm:

1. Loads current state from Supabase
2. Parses markdown to Export Tree
3. Builds lookup maps by Atlas UUID
4. Compares documents to detect new, deleted, and modified items
5. Tracks ancestry to detect parent changes

For detailed algorithm implementation and code examples, see [Atlas Sync AGENTS.md](../app/atlas/sync/AGENTS.md#change-detection-algorithm).

## Sync Operations

### Create Pages

New documents are created in hierarchical order (parents before children). Each page creation:

- Builds complete property object
- Sets parent to database ID (never page_id)
- Stores UUID mapping immediately
- Logs to audit table
- Tracks pages with unresolved mentions for post-processing

### Mention Post-Processing

**Problem**: In the markdown format, Atlas documents contain internal links to other Atlas documents using the format `[text](atlas-uuid)`. These links should become Notion "mention" objects that link to the referenced Notion page. However, during the Additions phase, when a new page is created, the pages it references may not exist yet in Notion (they're also being created in the same sync batch). Without a valid Notion page ID, we cannot create a proper mention object.

**Solution**: During page creation, we create placeholder mentions using the Atlas UUID as a temporary page ID and track which pages have unresolved mentions. After all new pages are created (and their UUID mappings stored), Phase 2.5 runs to update these pages with proper Notion mentions:

- Placeholder mentions (using Atlas UUID) are converted to proper Notion mentions with real Notion page IDs
- Content properties are rebuilt with complete UUID mappings
- Only pages that had unresolved mentions are updated (minimal API calls)
- A `missing_mapping` warning is logged for any mentions that still can't be resolved (e.g., referencing a page that wasn't part of the sync)

### Update Pages

Modified documents are updated with only changed fields. Handles:

- Content changes
- Property changes (name, type, extra fields, doc_no)
- Parent changes (cross-database and same-database)

### Delete Pages

Documents are archived (not permanently deleted) in leaf-first order:

- Verifies no children remain
- Archives page via Notion API
- Preserves UUID mapping forever

## UUID Mapping System

Maintains bidirectional mappings between Notion page UUIDs and Atlas document UUIDs. This enables:

- Looking up Notion page IDs for existing documents
- Storing mappings for newly created pages
- Converting references during export

For schema and usage examples, see [Atlas Sync AGENTS.md](../app/atlas/sync/AGENTS.md#uuid-mapping-system).

## Audit Logging

Tracks all Notion API operations for accountability, debugging, and compliance:

- Complete request/response payloads
- Success/failure status with error messages
- Timestamps and batch IDs for grouping

For schema and usage examples, see [Atlas Sync AGENTS.md](../app/atlas/sync/AGENTS.md#audit-logging).

## User Interface

**Location**: `/atlas/sync`

### Features

1. **Markdown Source Selection**: Load from GitHub (default) or upload local file
2. **Change Preview**: Visual diff with categorized changes and document hierarchy
3. **Conflict Detection**: Warns if Notion documents modified after markdown export
4. **Sync Execution**: Real-time progress tracking via Trigger.dev with stop support
5. **Results Display**: Summary of operations with error reporting

For detailed feature descriptions, see [Atlas Sync AGENTS.md](../app/atlas/sync/AGENTS.md#user-interface).

## Error Handling

### Validation Errors

Checks markdown structure, UUID uniqueness, and relationship consistency before sync. Provides detailed error messages with line numbers.

### Notion API Errors

Handles rate limits (429), invalid requests (400), not found (404), and server errors (500) with appropriate retry strategies.

### Partial Sync Failures

Successfully synced documents are committed even if others fail. All errors are logged with document identifiers for recovery.

For detailed error handling strategies, see [Atlas Sync AGENTS.md](../app/atlas/sync/AGENTS.md#error-handling).

## Performance Characteristics

### Background Task Processing

Sync operations run in a Trigger.dev background task:

- No server action timeouts (tasks can run for hours)
- Survives page refreshes
- Real-time progress via metadata subscription
- Graceful stopping between operations

### Performance Targets

- **Validation/Transformation/Change detection**: < 20 seconds total for full Atlas
- **Sync operations**: Limited by Notion API rate (~3 req/sec)
- **Total sync time**: Varies based on changes

For detailed performance characteristics, see [Atlas Sync AGENTS.md](../app/atlas/sync/AGENTS.md#performance-characteristics).

## Notion API Constraints

### Critical Constraints

- **Parent Property**: Always use `database_id` for database pages (never `page_id`)
- **Hierarchy**: Managed through relationship properties ("Parent Doc", "Parent item")

### Platform Limitations

- **Nesting Bug**: Notion's sub-item feature fails at deep nesting levels (10+ levels). Parent changes for affected documents are skipped.
- **Rich Text Limits**: 2000 characters per element, 100 elements per array

See **[NOTION_NESTING_BUG_FIX.md](./NOTION_NESTING_BUG_FIX.md)** for nesting bug documentation.

For detailed constraints and code examples, see [Atlas Sync AGENTS.md](../app/atlas/sync/AGENTS.md#notion-api-constraints).

## Testing

### Unit Tests

22 unit tests covering UUID mapping, audit logging, nesting overrides, change detection, and property building.

### Local Testing

A truncated Atlas file (544 documents vs 7,680) enables fast local testing. Generated via:

```bash
npx tsx scripts/atlas-export/generate-truncated-atlas-markdown.ts
```

For complete testing details, see [Atlas Sync AGENTS.md](../app/atlas/sync/AGENTS.md#testing).

## Known Limitations

1. **No Integration Tests**: Unit tests complete, but end-to-end tests not created
2. **No Undo/Rollback**: Operations cannot be reversed (audit log provides history)
3. **Limited Property Types**: Supports rich_text, title, select, and number only

## Future Enhancements

### Webhook-Based Sync Triggers

GitHub webhook triggers immediate sync after markdown commits, reducing latency from hours to minutes.

### Real-Time Collaboration

Near real-time updates between Notion and markdown via Notion webhooks.

### Conflict Resolution

Intelligent merge strategies including three-way merge and user-selectable resolution.

### Incremental Sync

Track changes and sync only modified documents for significant performance improvement.

## Related Documentation

### Pipeline Context

- **[ATLAS_DATA_PIPELINE.md](./ATLAS_DATA_PIPELINE.md)** - Complete Atlas data pipeline overview
- **[ATLAS_TREE_STRUCTURES.md](./ATLAS_TREE_STRUCTURES.md)** - Dual tree architecture (Notion Tree vs Export Tree)

### Input/Output Formats

- **[ATLAS_MARKDOWN_SYNTAX.md](./ATLAS_MARKDOWN_SYNTAX.md)** - Markdown syntax specification
- **[ATLAS_MARKDOWN_IMPORT_EXPORT.md](./ATLAS_MARKDOWN_IMPORT_EXPORT.md)** - Markdown parsing and Export Tree generation
- **[ATLAS_EXTRA_FIELDS.md](./ATLAS_EXTRA_FIELDS.md)** - Extra fields for Type Specifications, Scenarios, etc.

### Notion Integration

- **[NOTION_IMPORT_PROCESS.md](./NOTION_IMPORT_PROCESS.md)** - Reverse workflow (Notion → Supabase)
- **[NOTION_PROPERTY_MAPPING.md](./NOTION_PROPERTY_MAPPING.md)** - Property and relationship mappings
- **[NOTION_NESTING_BUG_FIX.md](./NOTION_NESTING_BUG_FIX.md)** - Nesting bug workaround

### Supporting Systems

- **[UUID_MAPPING.md](./UUID_MAPPING.md)** - UUID mapping system
- **[ATLAS_DOCUMENT_NUMBERING_RULES.md](./ATLAS_DOCUMENT_NUMBERING_RULES.md)** - Document numbering rules

### Implementation Details

- **[Atlas Sync AGENTS.md](../app/atlas/sync/AGENTS.md)** - Complete implementation guide with schemas, code examples, and troubleshooting

## Conclusion

The Atlas Markdown → Notion synchronization workflow completes the bidirectional data pipeline by enabling external markdown editing with sync back to Notion. With comprehensive error handling, audit logging, UUID mapping, and change detection, this workflow enables markdown-first editing while ensuring changes flow back into the Notion-based Atlas system.

**Implementation Status: Complete (not tested yet)**

The core sync functionality is implemented but not tested yet. It is supposed to be successfully handling all change types including structural changes (parent moves). Nesting bug handling is complete (parent changes for affected documents are skipped).

**Round-Trip Data Flow:**

Once synced to Notion, changes automatically flow through the complete pipeline:

1. Markdown → Notion (this workflow)
2. Notion → Supabase (hourly import task via Trigger.dev)
3. Supabase → Export Tree → Markdown/JSON (export generation)

This ensures all systems remain synchronized and changes made in markdown become visible in all Atlas formats.
