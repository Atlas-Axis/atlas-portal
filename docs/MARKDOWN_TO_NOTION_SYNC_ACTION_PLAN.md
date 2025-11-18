# Markdown → Notion Back Sync Implementation Action Plan

## Overview

This document outlines the complete action plan for implementing the Markdown → Notion back sync feature, enabling external markdown editing with subsequent synchronization back to Notion databases. This completes the bidirectional sync capability of the Atlas data pipeline.

### Purpose

- Enable markdown-first editing workflow for Atlas documents
- Support external contributors without Notion access
- Facilitate bulk editing and refactoring operations
- Maintain data consistency across Notion, Supabase, and markdown formats

### Scope

- Parse and validate Atlas markdown files
- Transform Export Tree to Notion-compatible format
- Reverse all forward pipeline transformations
- Sync changes to Notion via API
- Handle creates, updates, and deletes
- Maintain UUID mappings and relationships

### Goals

- Complete bidirectional sync: Markdown ↔ Notion ↔ Supabase
- Preserve data integrity throughout transformation pipeline
- Respect Notion API limits and constraints
- Handle errors gracefully with rollback capability
- Enable real-time collaboration between Notion and markdown users

## Background Context

### The Problem

Currently, the Atlas data pipeline is unidirectional: Notion → Supabase → Markdown exports. This limits editing workflows to Notion users only. External contributors, bulk editors, and technical documentation teams need the ability to edit Atlas documents in markdown format and sync changes back to Notion.

### Requirements

**Must Have:**

- Parse Atlas markdown to Export Tree structure
- Validate markdown structure and consistency
- Convert Export Tree back to Notion format
- Reverse all forward pipeline transformations:
  - Unnest root agent documents (reverse artificial nesting)
  - Reverse nesting bug fix overrides
  - Convert markdown to Notion Rich Text
  - Map Atlas UUIDs to Notion page UUIDs
  - Rewrite mention references
  - Build Notion property objects
  - Establish relationships
- Detect changes: new, modified, deleted documents
- Create, update, delete pages via Notion API
- Generate and store UUID mappings for new documents
- Batch operations with rate limiting
- Error handling and partial sync recovery

**Nice to Have:**

- Dry-run mode to preview changes
- Conflict resolution for concurrent edits
- Incremental sync (only changed documents)
- Webhook triggers for immediate sync
- Progress tracking UI
- Audit log of all Notion API changes

### Constraints

**Notion API Limitations:**

- Rate limit: 3 requests per second
- Bulk operations not supported (must iterate)
- Parent property for database pages: Must use `database_id`, never `page_id`
- Relationships: Must be established via relation properties, not parent property

**Platform Bugs:**

- Notion's sub-item feature fails at deep nesting levels (10+ levels)
- Must maintain nesting bug fix mappings and apply in reverse

**Data Integrity:**

- UUID mappings must be consistent and bidirectional
- Agent nesting is a fix for missing Notion relationships and must be removed before sync
- Relationships must be bidirectional (parent → child and child → parent)

## Architecture Design

### High-Level Data Flow

```
┌──────────────────┐
│ Markdown File    │
│ (GitHub Repo)    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 1. Validate      │◄── validate-atlas-markdown.ts
│    Markdown      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 2. Parse to      │◄── atlas-markdown-importer.ts
│    Export Tree   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 3. Transform     │
│    to Notion     │
│    Format        │
├──────────────────┤
│ a) Export Tree → │◄── export-tree-to-notion-tree.ts
│    Notion Tree   │
│ b) Unnest Agents │◄── unnest-root-agent-documents.ts
│ c) Reverse       │◄── reverse-nesting-overrides.ts
│    Overrides     │
│ d) Markdown →    │◄── markdown-to-rich-text.ts
│    Rich Text     │
│ e) Atlas UUID →  │◄── UUID mapping helpers
│    Notion UUID   │
│ f) Rewrite       │◄── (part of markdown-to-rich-text)
│    Mentions      │
│ g) Build Props & │◄── notion-property-builder.ts
│    Relations     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 4. Detect        │◄── detect-markdown-changes.ts
│    Changes       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 5. Sync to       │◄── sync-to-notion.ts (orchestrator)
│    Notion API    │
├──────────────────┤
│ • Create pages   │◄── create-notion-pages.ts
│ • Update pages   │◄── update-notion-pages.ts
│ • Delete pages   │◄── delete-notion-pages.ts
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 6. Auto-sync     │◄── notion-sync-task.ts (Trigger.dev)
│    to Supabase   │
└──────────────────┘
```

### Component Architecture

**Layer 1: Validation & Parsing**

- Input: Markdown file
- Validation: Structure, syntax, UUIDs, relationships
- Output: Export Tree

**Layer 2: Transformation**

- Input: Export Tree
- Transformations: 7 sequential steps (see data flow diagram)
- Output: Notion API-ready property objects

**Layer 3: Change Detection**

- Input: Export Tree + Current Supabase data
- Comparison: Deep diff using Atlas UUIDs
- Output: Change sets (new, modified, deleted)

**Layer 4: Notion Sync**

- Input: Change sets + Property objects
- Operations: Create, Update, Delete via Notion API
- Output: Updated Notion pages + UUID mappings

**Layer 5: Audit & Tracking**

- Input: All Notion API operations
- Storage: Audit log table in Supabase
- Output: Complete change history

## Implementation Phases

### Phase 1: Foundation (Core Utilities)

**Objective:** Build foundational transformation utilities that convert between formats.

#### Task 1.1: Export Tree → Notion Tree Converter

**File:** `app/server/atlas/export/export-tree-to-notion-tree.ts`

**Purpose:** Convert external Export Tree format back to internal Notion Tree format.

**Implementation:**

```typescript
interface ExportTreeToNotionTreeOptions {
  exportTree: ExportAtlasTreeDocument[];
  uuidMapping: Map<string, string>; // atlas_uuid -> notion_page_id
  allPages: NotionDatabasePage[]; // Current Supabase data for reference
}

export function exportTreeToNotionTree(options: ExportTreeToNotionTreeOptions): NotionAtlasTreeNode[] {
  // 1. Create lookup maps for efficient access
  // 2. For each export document:
  //    - Map Atlas UUID to Notion page UUID
  //    - Convert markdown content to Rich Text
  //    - Reconstruct parent_notion_page_id
  //    - Build child_*_ids arrays
  //    - Map extra fields to Notion properties
  //    - Reconstruct document name format (general: "{Name}", Sections & Primary Docs: "{DocNo} - {Name}")
  // 3. Return Notion Tree structure
}
```

**Key Logic:**

- Recursively traverse Export Tree
- Map each document to NotionAtlasTreeNode structure
- Handle missing UUID mappings (new documents)
- Preserve document hierarchy and relationships
- Reference property type overrides from `NOTION_PROPERTY_TYPE_OVERRIDES` (default type is Rich Text)

**Tests:**

- Unit test: Convert simple Export Tree to Notion Tree
- Unit test: Handle missing UUID mappings
- Unit test: Reconstruct parent_notion_page_id correctly
- Integration test: Full Export Tree conversion

#### Task 1.2: Reverse Nesting Overrides

**File:** `app/server/services/notion/reverse-nesting-overrides.ts`

**Purpose:** Apply nesting bug fix mappings in reverse direction.

**Implementation:**

```typescript
export function reverseNestingOverrides(
  pages: NotionDatabasePage[],
  mappings: NotionNestingBugMapping[],
): NotionDatabasePage[] {
  // 1. Load mappings from notion_nesting_bug_mapping table
  // 2. For each mapping { child, correctParent, incorrectParent, sibling }:
  //    - Remove child from correct parent's child array
  //    - Add child to incorrect parent's child array
  //    - Update child's parent_notion_page_id to incorrect parent
  //    - Maintain sibling positioning if specified
  // 3. Return pages with original (buggy) Notion relationships
}
```

**Key Logic:**

- Reverse of `applyNestingOverrides()` function
- Move children from corrected positions back to original positions
- Preserve sibling order from mappings
- Log all reversals for debugging

**Tests:**

- Unit test: Reverse single mapping
- Unit test: Reverse multiple mappings with dependencies
- Unit test: Handle missing parents gracefully
- Integration test: Full reverse transformation

#### Task 1.3: Unnest Root Agent Documents

**File:** `app/server/atlas/unnest-root-agent-documents.ts`

**Purpose:** Remove artificial nesting of Agent Scope Database documents.

**Implementation:**

```typescript
export function unnestRootAgentDocuments(
  pages: NotionDatabasePage[],
  agentRootSectionUuid: string,
): NotionDatabasePage[] {
  // 1. Find section page with AGENT_ROOT_SECTION_UUID_FOR_NESTING
  // 2. Identify agent documents in section's child_agent_scope_ids
  // 3. Remove agent IDs from section's child array
  // 4. For each agent: Set parent_notion_page_id to null (it was already null, but just to make sure)
  // 5. Return pages with unnested agents (root-level in Agent Scope DB)
}
```

**Key Logic:**

- Reverse of `nestRootAgentDocumentsUnderAgentSection()`
- Identify artificially nested agents
- Restore root-level structure (an existing issue in Notion that we will have to fix)
- Log all unnested agents

**Tests:**

- Unit test: Unnest single agent document
- Unit test: Unnest multiple agent documents
- Unit test: Handle non-agent documents correctly
- Integration test: Full unnesting transformation

### Phase 2: Content Transformation

**Objective:** Convert markdown content back to Notion Rich Text format with correct UUID references.

#### Task 2.1: Extend Markdown to Rich Text Converter

**File:** `app/server/markdown/markdown-to-rich-text.ts` (extend existing)

**Purpose:** Add Atlas UUID → Notion UUID mention conversion.

**Implementation:**

```typescript
interface MarkdownToRichTextOptions {
  markdown: string;
  uuidMapping?: Map<string, string>; // atlas_uuid -> notion_page_id
  convertAtlasUuidMentions?: boolean; // Default: false for backward compat
}

export function markdownToRichText(options: MarkdownToRichTextOptions): TextRichTextItemRequest[] {
  // Existing implementation...
  // NEW: If convertAtlasUuidMentions enabled:
  // 1. Parse markdown links: [text](atlas-uuid) (no "uuid:" prefix)
  // 2. Look up Notion page UUID from atlas_uuid in preloaded lookup map
  // 3. Convert markdown link to Notion mention object and rewrite Atlas UUID to Notion UUID:
  //    { type: 'mention', mention: { type: 'page', page: { id: notion_page_id } } }
  // 4. Handle missing mappings (log warning, keep original or placeholder)
  // 5. Edge case: New document links to another new document without Notion ID yet
  //    - First round: Create page content without mention objects
  //    - Second round: Update blocks with proper mention objects after all pages created
}
```

**Key Logic:**

- Detect Atlas UUID link pattern: `[text](atlas-uuid)` (no "uuid:" prefix)
- Query UUID mapping from preloaded lookup map for conversion
- Generate Notion mention object structure and rewrite Atlas UUID to Notion UUID
- Handle errors gracefully
- Handle edge case where new document links to another new document (two-round approach)

**Tests:**

- Unit test: Convert simple Atlas UUID mention
- Unit test: Handle missing UUID mapping
- Unit test: Mix of regular links and UUID mentions
- Integration test: Complex markdown with multiple mentions

### Phase 3: Property Building

**Objective:** Build Notion API property objects using database-specific mappings.

#### Task 3.1: Notion Property Builder

**File:** `app/server/atlas/notion-mapping/notion-property-builder.ts`

**Purpose:** Map Export Tree fields to Notion property objects.

**Implementation:**

```typescript
interface BuildPropertiesOptions {
  document: ExportAtlasTreeDocument;
  databaseName: AtlasDatabaseName;
  uuidMapping: Map<string, string>;
  propertyConfig: NotionDatabasePropertyMapping;
  childRelationships: Partial<Record<AtlasDatabaseName, string>>;
}

export function buildNotionProperties(options: BuildPropertiesOptions): Record<string, any> {
  // 1. Get property mappings for database
  // 2. Build title property (handle special title formats)
  // 3. Build rich text properties (content, extra fields)
  // 4. Build select properties (document type)
  // 5. Build number properties (sort order)
  // 6. Build relation properties (child relationships)
  // 7. Return complete properties object
}

export function buildTitleProperty(
  documentNumber: string,
  documentName: string,
  databaseName: AtlasDatabaseName,
): TitlePropertyItemRequest[] {
  // General format: "{Name}" (e.g., "Primitive Hub Document")
  // Sections & Primary Docs special format: "{DocNo} - {Name}"
  // Note: Final specification not finalized, may not include doc number or use different formatting
}

export function buildRelationProperty(
  childUuids: string[],
  uuidMapping: Map<string, string>,
): RelationPropertyItemRequest[] {
  // Convert Atlas UUIDs to Notion page UUIDs
  // Return: [{ id: notion_page_id }, ...]
}
```

**Key Logic:**

- Use `notion-database-properties-and-relationships.ts` for mappings
- Handle database-specific property names
- Build typed property objects for Notion API
- Convert all Atlas UUIDs to Notion UUIDs in relations (if not done already in a previous step)
- Reference property type overrides from `NOTION_PROPERTY_TYPE_OVERRIDES`

**Tests:**

- Unit test: Build title property for various databases
- Unit test: Build relation property with UUID conversion
- Unit test: Build complete property object
- Integration test: All property types for all databases

### Phase 4: Change Detection

**Objective:** Identify what has changed between markdown and current Notion state.

#### Task 4.1: Change Detector

**File:** `app/server/atlas/sync/detect-markdown-changes.ts`

**Purpose:** Compare Export Tree against Supabase data to identify changes.

**Implementation:**

```typescript
interface ChangeSet {
  new: ExportAtlasTreeDocument[];
  modified: Array<{
    document: ExportAtlasTreeDocument;
    existingPage: NotionDatabasePage;
    changes: ChangeDetails;
  }>;
  deleted: NotionDatabasePage[];
}

export function detectMarkdownChanges(
  exportTree: ExportAtlasTreeDocument[],
  currentPages: NotionDatabasePage[],
  uuidMapping: Map<string, string>,
): ChangeSet {
  // 1. Build lookup maps by Atlas UUID
  // 2. Identify new documents (no UUID mapping exists)
  // 3. Identify deleted documents (in Supabase but not in markdown)
  // 4. For existing documents, detect changes:
  //    - Content changes (markdown diff)
  //    - Property changes (name, type, etc.)
  //    - Relationship changes (parent, children)
  //    - Structure changes (position in hierarchy)
  // 5. Return detailed change set
}
```

**Key Logic:**

- Use Atlas UUIDs as stable identifiers
- Deep comparison of content and metadata
- Track what specifically changed for each document
- Support dry-run mode (preview changes)

**Tests:**

- Unit test: Detect new documents
- Unit test: Detect deleted documents
- Unit test: Detect content changes
- Unit test: Detect relationship changes
- Integration test: Complex multi-type change set

### Phase 5: Notion API Sync

**Objective:** Execute sync operations via Notion API with proper error handling.

#### Task 5.1: Main Sync Orchestrator

**File:** `app/server/atlas/sync/sync-to-notion.ts`

**Purpose:** Coordinate entire sync process from markdown to Notion.

**Implementation:**

```typescript
interface SyncToNotionOptions {
  markdownContent: string;
  dryRun?: boolean;
  batchSize?: number;
  progressCallback?: (progress: SyncProgress) => void;
}

interface SyncToNotionResult {
  success: boolean;
  changes: ChangeSet;
  created: number;
  updated: number;
  deleted: number;
  errors: SyncError[];
  auditLogEntries: AuditLogEntry[];
}

export async function syncToNotion(options: SyncToNotionOptions): Promise<SyncToNotionResult> {
  // 1. Validate markdown
  // 2. Parse to Export Tree
  // 3. Transform to Notion format (all 7 steps)
  // 4. Detect changes
  // 5. If dry-run, return preview
  // 6. Execute sync operations (create, update, delete)
  // 7. Store UUID mappings for new documents
  // 8. Log all operations to audit table
  // 9. Return detailed results
}
```

**Key Logic:**

- Orchestrate all phases in correct order
- Handle errors at each phase
- Support dry-run for preview
- Track progress for UI
- Store audit log for all changes

**Tests:**

- Integration test: Full sync with new documents
- Integration test: Full sync with updates
- Integration test: Full sync with deletions
- Integration test: Dry-run mode
- Integration test: Error handling and rollback

#### Task 5.2: Create Notion Pages

**File:** `app/server/atlas/sync/create-notion-pages.ts`

**Purpose:** Create new pages in Notion via API.

**Implementation:**

```typescript
export async function createNotionPages(
  documents: ExportAtlasTreeDocument[],
  propertyBuilder: PropertyBuilder,
  options: CreatePagesOptions,
): Promise<CreatePagesResult> {
  // 1. Sort documents by hierarchy (parents before children)
  // 2. For each document in order (no batching for better error handling):
  //    - Build complete property object
  //    - Set parent to database ID
  //    - Call Notion API: POST /pages
  //    - Extract new Notion page UUID
  //    - Create UUID mapping entry: { atlas_document_uuid, notion_page_id }
  //    - Store in Supabase uuid_mapping table
  //    - Make newly created IDs available for documents synced in same batch
  //    - Log to audit table
  // 3. Handle errors with partial success tracking
  // 4. Return created pages and mappings
}
```

**Key Logic:**

- Respect hierarchical dependencies
- Don't batch operations for more reliable error handling and better audit log
- Store UUID mappings immediately
- Make newly created Notion page IDs available during sync if referenced by other documents
- Handle partial failures

**Tests:**

- Unit test: Create single page
- Unit test: Create hierarchical pages (parent before child)
- Integration test: Sequential creation with error handling
- Integration test: Partial failure recovery
- Integration test: New page IDs available for same-sync references

#### Task 5.3: Update Notion Pages

**File:** `app/server/atlas/sync/update-notion-pages.ts`

**Purpose:** Update existing pages in Notion via API.

**Implementation:**

```typescript
export async function updateNotionPages(
  changes: ModifiedDocument[],
  propertyBuilder: PropertyBuilder,
  options: UpdatePagesOptions,
): Promise<UpdatePagesResult> {
  // 1. For each modified document:
  //    - Look up Notion page UUID from Atlas UUID
  //    - Build property update object (only changed fields)
  //    - Call Notion API: PATCH /pages/{page_id}
  //    - Update relationships if changed
  //    - Log to audit table
  // 2. Handle retry logic with exponential backoff (already exists in our Notion client class)
  // 3. Return updated pages
}
```

**Key Logic:**

- Only update changed fields (delta sync)
- Look up Notion UUIDs via mapping
- Update relationships separately
- Retry on transient errors (already exists in Notion client class)

**Tests:**

- Unit test: Update single page
- Unit test: Update only changed fields
- Integration test: Batch updates
- Integration test: Retry logic on errors

#### Task 5.4: Delete Notion Pages

**File:** `app/server/atlas/sync/delete-notion-pages.ts`

**Purpose:** Archive deleted pages in Notion via API.

**Implementation:**

```typescript
export async function deleteNotionPages(
  deletedPages: NotionDatabasePage[],
  options: DeletePagesOptions,
): Promise<DeletePagesResult> {
  // 1. Start from leaf nodes, traverse up tree as parents become leaves
  // 2. For each deleted document:
  //    - Look up Notion page UUID
  //    - Check if page has children (use efficient lookup map)
  //    - If has children, prevent deletion to avoid cascading/orphans
  //    - Call Notion API: PATCH /pages/{page_id} with { archived: true }
  //    - Delete UUID mapping in Supabase
  //    - Log to audit table
  // 3. Return archived pages
}
```

**Key Logic:**

- Archive pages (set archived: true)
- Delete UUID mappings in Supabase (not preserve)
- Start from leaf nodes to avoid cascading effects
- Prevent deletion if page has children (check via efficient lookup map)
- Log all deletions

**Tests:**

- Unit test: Archive single page
- Unit test: Prevent deletion of pages with children
- Integration test: Leaf-to-root traversal deletion
- Integration test: Handle child document checks

### Phase 6: Integration

**Objective:** Connect sync functionality to UI and automation systems.

#### Task 6.1: Update Server Actions

**File:** `app/atlas/sync/_actions/sync-atlas-to-notion.ts`

**Purpose:** Provide server action for UI to trigger sync.

**Implementation:**

```typescript
export async function syncAtlasToNotion(
  markdownContent: string,
  options: SyncOptions,
): Promise<ActionResult<SyncToNotionResult>> {
  // 1. Validate user permissions
  // 2. Validate markdown structure
  // 3. Call syncToNotion() orchestrator
  // 4. Revalidate affected pages
  // 5. Return results for UI display
}
```

**Key Logic:**

- Validate before sync
- Call main orchestrator
- Trigger Next.js revalidation
- Return user-friendly results

**Tests:**

- Integration test: Full sync via server action
- E2E test: Trigger sync from UI

#### Task 6.2: Update UI Components

**Files:**

- `app/atlas/sync/page.tsx` (main sync UI)
- `app/atlas/sync/content.tsx` (sync controls and status)

**Purpose:** Provide user interface for triggering and monitoring sync.

**Implementation:**

- File upload for markdown
- Dry-run preview button
- Sync execution button
- Progress tracking display
- Error display with actionable messages
- Success confirmation with change summary

**Tests:**

- Component test: Render sync UI
- E2E test: Full sync workflow from UI

### Phase 7: Testing & Quality Assurance

**Objective:** Ensure reliability through comprehensive testing.

#### Test Strategy

**Unit Tests:**

- Each transformation function
- Property builders
- Change detection logic
- UUID mapping functions

**Integration Tests:**

- Full transformation pipeline
- Notion API operations
- Error handling and recovery
- Batch operations

**E2E Tests:**

- Use test Notion databases (created via `scripts/create-test-notion-databases.ts`)
- Full sync workflow: Markdown → Notion → Supabase
- Validate round-trip consistency
- Test edge cases (empty content, special characters, deep nesting)

**Test Data:**

- Small Atlas subset (10-20 documents)
- Deep nesting scenarios (15+ levels)
- All document types represented
- Documents with extra fields
- Documents with relationships

#### Test Files to Create

```
app/server/atlas/export/__tests__/
  - export-tree-to-notion-tree.test.ts

app/server/services/notion/__tests__/
  - reverse-nesting-overrides.test.ts

app/server/atlas/__tests__/
  - unnest-root-agent-documents.test.ts

app/server/atlas/notion-mapping/__tests__/
  - notion-property-builder.test.ts

app/server/atlas/sync/__tests__/
  - detect-markdown-changes.test.ts
  - sync-to-notion.test.ts
  - create-notion-pages.test.ts
  - update-notion-pages.test.ts
  - delete-notion-pages.test.ts
```

## Error Handling Strategy

### Validation Errors

**When:** Before any Notion API calls

**Actions:**

- Validate markdown structure
- Check UUID uniqueness
- Verify document number patterns
- Validate relationships

**Response:**

- Return detailed error messages with line numbers
- Provide actionable suggestions for fixing
- Do not proceed with sync

### Notion API Errors

**Types:**

- Rate limit errors (429)
- Invalid request errors (400)
- Not found errors (404)
- Server errors (500)

**Actions:**

- Rate limit: Exponential backoff and retry
- Invalid request: Log details, skip document, continue
- Not found: Log warning, skip document, continue
- Server error: Retry with backoff, fail after 3 attempts

**Response:**

- Log all errors to audit table
- Track partial success
- Return detailed error report

### Partial Sync Failures

**Scenario:** Some documents synced successfully, others failed

**Actions:**

- Store successfully synced documents
- Store UUID mappings for new documents
- Log all errors with document identifiers
- Generate partial success report

**Response:**

- Return list of successful syncs
- Return list of failed syncs with reasons
- Partial success tracking: Store successfully synced documents to avoid re-processing (?)
- Consider simple approach: Show modal to user, on confirm reload page to retry remaining changes

### Rollback Strategy

**When:** Critical failure during sync (e.g., validation error after partial sync)

**Actions:**

- Rollback strategy optional if adds too much complexity
- If implemented: Attempt to restore previous state
- Archive newly created pages
- Revert property changes to previous values
- Log rollback attempt and result

**Limitations:**

- Rollback may not be 100% successful
- Some changes may persist
- Document manual cleanup steps if needed
- Consider keeping it simple: show error and let user retry

## Progress Tracking & Audit Log

### Progress Tracking

**Implementation:**

- Callback function in sync options
- Emit progress events: `{ phase, completed, total, currentDocument }`
- Update UI in real-time via WebSocket or polling
- Transaction-like behavior: Validate all changes before applying (prevent partial corruption)
- Simple interruption handling: Modal → reload page on confirm

**UI Display:**

- Progress bar with percentage
- Current phase indicator
- Document counter (e.g., "45/100 documents synced")
- Estimated time remaining
- If interrupted: Show modal, on user confirm reload page to reload remaining syncable changes (keep it simple)

### Audit Log

**Purpose:** Document all changes made via Notion API for accountability and debugging.

**Schema:** New Supabase table `notion_api_audit_log`

```sql
CREATE TABLE notion_api_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL, -- 'create', 'update', 'delete'
  notion_page_id UUID NOT NULL,
  atlas_document_uuid UUID,
  database_name TEXT NOT NULL,
  request_payload JSONB NOT NULL,
  response_payload JSONB,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id TEXT,
  sync_batch_id UUID -- Group operations from same sync
);
```

**Data Stored:**

- Complete request payload sent to Notion API
- Complete response payload received
- Success/failure status
- Error messages if failed
- Timestamp and user info
- Batch ID for grouping related operations

**Usage:**

- Debugging sync issues
- Auditing changes for compliance
- Rollback reference (what was changed)
- Performance analysis (API call patterns)

## Rate Limiting & Performance

### Notion API Limits

**Official Limits:**

- 3 requests per second (average)
- Burst allowance: ~10 requests

**Implementation:**

- Token bucket algorithm for rate limiting
- Track API calls across all concurrent operations
- Exponential backoff on 429 responses
- Respect Retry-After header

### Batch Operations

**Strategy:**

- Don't batch operations for more reliable error handling
- Process documents sequentially for better audit log of Notion API calls
- Better error isolation when issues occur
- Clearer tracking of what succeeded vs failed

### Performance Targets

- Validation: < 5 seconds for full Atlas
- Transformation: < 10 seconds for full Atlas
- Change detection: < 5 seconds
- Sync operations: Sequential processing (no batching), limited by API rate
- Total sync time: Will vary based on number of changes and API response times
- Progress tracking: Log completion percentage and estimated time remaining

## Future Enhancements

### Webhook-Based Sync Triggers

**Current:** Manual sync or scheduled hourly task

**Future:** Webhook from GitHub triggers immediate sync after markdown commits

**Implementation:**

- GitHub webhook on markdown file changes
- Next.js API route receives webhook
- Triggers Trigger.dev task for sync
- Reduces latency from hours to minutes

### Real-Time Collaboration

**Current:** Eventual consistency (hourly sync)

**Future:** Near real-time updates between Notion and markdown

**Implementation:**

- Notion webhook on database changes
- Immediate Supabase update
- Regenerate markdown exports
- Push to GitHub automatically

### Conflict Resolution

**Current:** Last write wins (no conflict detection)

**Future:** Detect concurrent edits and prompt for resolution

**Implementation:**

- Track edit timestamps on both sides
- Detect conflicts (both modified since last sync)
- Present diff to user for manual resolution
- Support merge strategies (prefer Notion, prefer markdown, manual merge)

### Incremental Sync

**Current:** Full Atlas comparison on each sync

**Future:** Track changes and sync only modified documents

**Implementation:**

- Store last sync timestamp
- Query Supabase for changes since timestamp
- Parse markdown and compare only changed sections
- Significant performance improvement for large Atlas

## Implementation Checklist

### Phase 1: Foundation ✓

- [ ] Create `export-tree-to-notion-tree.ts`
  - [ ] Main conversion function
  - [ ] UUID mapping integration
  - [ ] Parent/child reconstruction
  - [ ] Title format handling
  - [ ] Unit tests
  - [ ] Integration tests
- [ ] Create `reverse-nesting-overrides.ts`
  - [ ] Main reverse function
  - [ ] Load mappings from database
  - [ ] Apply reverse transformations
  - [ ] Unit tests
  - [ ] Integration tests
- [ ] Create `unnest-root-agent-documents.ts`
  - [ ] Main unnesting function
  - [ ] Identify artificial nesting
  - [ ] Restore root-level structure
  - [ ] Unit tests
  - [ ] Integration tests

### Phase 2: Content Transformation ✓

- [ ] Extend `markdown-to-rich-text.ts`
  - [ ] Atlas UUID mention detection
  - [ ] UUID mapping lookup
  - [ ] Notion mention object generation
  - [ ] Error handling for missing mappings
  - [ ] Unit tests
  - [ ] Integration tests

### Phase 3: Property Building ✓

- [ ] Create `notion-property-builder.ts`
  - [ ] Main property builder function
  - [ ] Title property builder
  - [ ] Rich text property builder
  - [ ] Select property builder
  - [ ] Number property builder
  - [ ] Relation property builder
  - [ ] Database-specific handling
  - [ ] Unit tests for each property type
  - [ ] Integration tests

### Phase 4: Change Detection ✓

- [ ] Create `detect-markdown-changes.ts`
  - [ ] Main detection function
  - [ ] New document detection
  - [ ] Modified document detection
  - [ ] Deleted document detection
  - [ ] Deep comparison logic
  - [ ] Unit tests for each change type
  - [ ] Integration tests

### Phase 5: Notion API Sync ✓

- [ ] Create `sync-to-notion.ts`
  - [ ] Main orchestrator function
  - [ ] Phase coordination
  - [ ] Error handling
  - [ ] Dry-run support
  - [ ] Progress tracking
  - [ ] Integration tests
- [ ] Create `create-notion-pages.ts`
  - [ ] Create pages function
  - [ ] Hierarchical ordering
  - [ ] UUID mapping generation
  - [ ] Batch processing
  - [ ] Rate limiting
  - [ ] Unit tests
  - [ ] Integration tests
- [ ] Create `update-notion-pages.ts`
  - [ ] Update pages function
  - [ ] Delta sync (only changed fields)
  - [ ] Relationship updates
  - [ ] Retry logic
  - [ ] Unit tests
  - [ ] Integration tests
- [ ] Create `delete-notion-pages.ts`
  - [ ] Archive pages function
  - [ ] Cascade handling
  - [ ] UUID mapping preservation
  - [ ] Unit tests
  - [ ] Integration tests

### Phase 6: Integration ✓

- [ ] Update `sync-atlas-to-notion.ts` server action
  - [ ] Call main orchestrator
  - [ ] Validation
  - [ ] Revalidation
  - [ ] Integration tests
- [ ] Update UI components
  - [ ] File upload
  - [ ] Dry-run preview
  - [ ] Sync execution
  - [ ] Progress display
  - [ ] Error display
  - [ ] E2E tests

### Phase 7: Testing & QA ✓

- [ ] Unit tests (all phases)
- [ ] Integration tests (all phases)
- [ ] E2E tests with test databases
- [ ] Edge case testing
- [ ] Performance testing
- [ ] Load testing (full Atlas)

### Documentation ✓

- [ ] Update `ATLAS_DATA_PIPELINE.md` ✓ (COMPLETED)
- [ ] Create this action plan ✓ (COMPLETED)
- [ ] Update `app/atlas/sync/README.md`
- [ ] Add JSDoc comments to all functions
- [ ] Create troubleshooting guide

### Code Review & Deployment ✓

- [ ] Code review (all phases)
- [ ] Address review feedback
- [ ] Merge to main branch
- [ ] Deploy to staging
- [ ] Test in staging environment
- [ ] Deploy to production
- [ ] Monitor initial syncs

## Dependencies and Prerequisites

### Required Before Implementation

**Data Prerequisites:**

- [ ] UUID mapping table fully populated for all existing documents
- [ ] Test Notion databases created (via `scripts/create-test-notion-databases.ts`)
- [ ] Sample markdown files for testing (small subset of Atlas)

**Code Prerequisites:**

- [ ] Markdown validation working (`scripts/validate-atlas-markdown.ts`)
- [ ] Markdown parser working (`atlas-markdown-importer.ts`)
- [ ] UUID mapping helpers available
- [ ] Existing sync infrastructure reviewed (`app/atlas/sync/`)

**Infrastructure Prerequisites:**

- [ ] Supabase audit log table created
- [ ] Notion API keys available
- [ ] Rate limiting infrastructure in place
- [ ] Error logging configured

### External Dependencies

**NPM Packages:**

- `@notionhq/client` - Notion API client
- `p-limit` - Concurrency limiting for batch operations
- `zod` - Schema validation for API payloads

**Database:**

- Supabase PostgreSQL
- Tables: `uuid_mapping`, `notion_database_pages`, `notion_nesting_bug_mapping`, `notion_api_audit_log`

**APIs:**

- Notion API (official SDK)
- Supabase API (official SDK)

## Risk Assessment

### High Risk

**Risk:** Notion API rate limiting causes sync failures

**Mitigation:**

- Implement robust rate limiting with token bucket
- Exponential backoff on 429 errors
- Batch operations with delays
- Resume capability for interrupted syncs

**Risk:** Data corruption due to transformation errors

**Mitigation:**

- Comprehensive unit tests for all transformations
- Integration tests with real data
- Dry-run mode for validation
- Audit log for all changes
- Rollback capability (best effort)

### Medium Risk

**Risk:** UUID mapping inconsistencies

**Mitigation:**

- Validate mappings before sync
- Generate mappings atomically
- Store mappings immediately after creation
- Regular mapping consistency checks

**Risk:** Nesting bug fix mappings become stale

**Mitigation:**

- Regular audits of mappings
- UI for managing mappings
- Validation during sync
- Clear documentation of affected documents

### Low Risk

**Risk:** Performance degradation with large Atlas

**Mitigation:**

- Batch operations
- Parallel processing where possible
- Progress tracking for user feedback
- Incremental sync (future enhancement)

## Success Criteria

### Functional Requirements ✓

- [ ] Successfully parse Atlas markdown to Export Tree
- [ ] Convert Export Tree to Notion format (all 7 transformations)
- [ ] Detect all types of changes (new, modified, deleted)
- [ ] Create new pages in Notion via API
- [ ] Update existing pages in Notion via API
- [ ] Archive deleted pages in Notion via API
- [ ] Generate and store UUID mappings for new documents
- [ ] Handle errors gracefully with partial success
- [ ] Support dry-run mode for preview

### Quality Requirements ✓

- [ ] 95%+ test coverage for all transformation functions
- [ ] Zero data loss during sync operations
- [ ] Complete audit trail of all API operations
- [ ] Clear error messages with actionable suggestions
- [ ] Performance within targets (see Performance section)

### Documentation Requirements ✓

- [ ] All transformations documented in `ATLAS_DATA_PIPELINE.md` ✓
- [ ] Complete implementation action plan ✓
- [ ] JSDoc comments for all public functions
- [ ] Troubleshooting guide for common issues
- [ ] User guide for markdown-first workflow

## Conclusion

This action plan provides a comprehensive roadmap for implementing the Markdown → Notion back sync feature. The implementation is divided into 6 logical phases with clear objectives, tasks, and success criteria. Each phase builds on the previous one, ensuring a solid foundation before adding complexity.

The total implementation effort is estimated at 4-6 weeks for a single developer, including testing and documentation. The most critical phases are:

1. **Phase 1 (Foundation)**: Ensures all transformation utilities work correctly
2. **Phase 5 (Notion API Sync)**: Handles the complexity of API operations with proper error handling
3. **Phase 7 (Testing)**: Validates the entire pipeline works reliably

Once complete, this feature will enable true bidirectional sync between Notion and markdown formats, empowering external contributors and enabling markdown-first editing workflows for the Atlas project.
