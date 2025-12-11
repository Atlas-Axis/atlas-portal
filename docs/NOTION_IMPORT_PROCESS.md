# Notion to Supabase Import Process

## Overview

The Notion import process synchronizes Atlas documents from 10 Notion databases to Supabase PostgreSQL storage. It handles approximately 6,000 pages with efficient delta sync, relationship mapping, and versioned storage. The process runs hourly via Trigger.dev and takes approximately 15 minutes to complete a full sync.

**Key Features:**

- Delta sync with intelligent change detection (new/deleted/modified pages)
- Property and relationship mapping via centralized configuration
- Sync locking to prevent concurrent operations
- Batched processing for performance (500 pages per batch)
- UUID mapping generation for stable document references
- Temporal versioning for historical data

See **[ATLAS_DATA_PIPELINE.md](./ATLAS_DATA_PIPELINE.md)** for the complete data pipeline overview.

## Import Workflow

The import process follows a structured multi-step workflow:

```
1. Verify Sync Lock
   ↓
2. Acquire Sync Lock
   ↓
3. Load Existing Pages from Supabase
   ↓
4. Fetch Pages from Notion API
   ↓
5. Compare & Detect Changes
   ↓
6. Process Deletions
   ↓
7. Convert to Database Format
   ↓
8. Batch Insert/Update
   ↓
9. Generate UUID Mappings (new pages only)
   ↓
10. Release Sync Lock
```

### Step 1: Verify Sync Lock

Verify that no other sync is currently running for the database (throws error if locked).

**Implementation:** `app/server/services/notion/sync-lock.ts` - `verifySyncLock()`

### Step 2: Acquire Sync Lock

Acquire exclusive lock to prevent concurrent syncs. Lock expires automatically after 30 minutes.

**Implementation:** `app/server/services/notion/sync-lock.ts` - `acquireSyncLock()`

### Step 3: Load Existing Pages from Supabase

Load current Atlas documents from Supabase to enable change detection.

**Implementation:** `app/server/services/supabase/load-notion-database-pages-from-supabase.ts`

**Query Details:**

- Filters by `atlas_database_name` to load specific database
- Only loads current rows: `WHERE date_valid_to IS NULL`
- Returns `NotionDatabasePage[]` array for comparison

### Step 4: Fetch Pages from Notion API

Retrieve all pages from the target Notion database with full relationship data.

**Implementation:** `app/server/services/notion/fetch-database-pages.ts`

**Two-Phase Fetch:**

**Phase 1: Fetch All Pages**

- `fetchNotionDatabasePages()` - Query database with pagination
- Batch size: 100 pages per request
- Returns `PageObjectResponse[]` array

**Phase 2: Load Full Relationships**

- `fetchNotionDatabasePagesWithRelationships()` - Enhance pages with complete relationship data
- Notion API truncates relations at 25 items in initial response
- Detects truncation via `has_more` flag
- Fetches complete relations via `pages.properties.retrieve()` for truncated properties
- Returns `EnhancedPageObjectResponse[]` with `enhancedRelations` map

**Relationship Properties Loaded:**

- Child relationships from `NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[dbName].childRelationships`
- Parent relationship from `NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[dbName].parentPropertyName`

**Optional Local Caching:**

- Saves fetched pages to `.notion-cache/` directory for development
- Reduces API calls during testing and iteration
- Enabled via `useLocalCache` parameter

### Step 5: Compare & Detect Changes

Compare Supabase pages (old) with Notion pages (new) to identify changes.

**Implementation:** `app/server/services/notion/compare-database-pages.ts` - `compareDatabasePages()`

**Change Categories:**

1. **New Pages**: Exist in Notion but not in Supabase
2. **Deleted Pages**: Exist in Supabase but not in Notion
3. **Property Changes**: Modifications to tracked properties
4. **Relationship Changes**: Modifications to parent/child relationships
5. **Unchanged Pages**: No detected differences

**Property Comparison:**

- Compares all properties listed in `NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS[dbName].properties`
- Uses reversed property mapping for efficient lookup
- Special handling for `sortOrder`: converts string to number
- Plain text comparison for property values
- Rich text JSON comparison for content and name properties (detects mention changes and formatting)

**Extra Fields Comparison:**

- Type Specification: 6 extra fields (Components, Doc Identifier Rules, etc.)
- Scenario: 3 extra fields (Description, Finding, Additional Guidance)
- Scenario Variation: 3 extra fields (same as Scenarios)
- Needed Research: 1 extra field (Content)
- Compares both `plain_text` and `rich_text` JSON structure
- Plain text comparison catches content changes
- JSON structure comparison catches mention target changes and formatting

**Relationship Comparison:**

- Parent relationship: Compares `parent_notion_page_id` field
- Child relationships: Compares all `child_*_ids` arrays
- Order-independent comparison (arrays sorted before comparison)

**Rich Text JSON Comparison:**

In addition to plain text comparison, the system now compares the full rich text JSON structure for:

- Content properties (`json_content`)
- Name/title properties (`json_name`)
- Extra fields (`rich_text` within `extra_fields`)

This detects changes that plain text comparison misses:

- Mention target changes (when label text stays the same but linked page changes)
- Formatting changes (bold, italic, code, strikethrough)
- Annotation changes (colors, links)
- Equation changes

The comparison uses deep equality checking on the JSON structure to detect any differences in:

- Mention `page.id` references
- Text annotations (bold, italic, code, etc.)
- Link URLs
- Equation expressions

**Change Detection Output:**

```typescript
interface DatabasePageChanges {
  newPages: string[]; // Page IDs to insert
  deletedPages: string[]; // Page IDs to delete
  changedProperties: string[]; // Page IDs to update (properties)
  changedRelationships: string[]; // Page IDs to update (relationships)
  unchangedPages: string[]; // Page IDs with no changes
}
```

### Step 6: Process Deletions

Remove pages that no longer exist in Notion from Supabase.

**Implementation:** `app/server/services/supabase/delete-pages-from-supabase.ts`

**Deletion Behavior:**

- Uses versioned delete via `versioned_delete_notion_database_pages` RPC
- Sets `date_valid_to` to current timestamp (temporal versioning)
- Pages remain in database for historical queries
- Not physically deleted from database

### Step 7: Convert to Supabase Format

Transform Notion API responses to Supabase database format.

**Implementation:** `app/server/services/notion/convert-notion-pages-to-supabase-format.ts`

**Conversion Process:**

**Property Extraction:**

- Uses property mapping from `NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS`
- Extracts rich text with both plain text and JSON structure
- Handles null content properties gracefully

**Document Type Extraction:**

- Required field - throws error if missing
- Used to determine extra fields to extract

**Extra Fields Extraction:**

- Type Specification → `extractTypeSpecificationExtraFields()`
- Scenario → `extractScenarioExtraFields()`
- Scenario Variation → `extractScenarioVariationExtraFields()`
- Needed Research → `extractNeededResearchExtraFields()`
- Stored as JSONB: `{ field_name: { plain_text: string, rich_text: Json[] } }`

**Relationship Extraction:**

- Parent ID: First item from parent property (warns if multiple)
- Child IDs: Extracted from `enhancedRelations` map
- Mapped to Supabase `child_*_ids` arrays via `SUPABASE_CHILD_DATABASE_NAME_MAP`

**Output Format:**

```typescript
interface NotionDatabasePage {
  notion_page_id: string;
  atlas_document_type: AtlasDocumentType;
  atlas_document_number: string;
  atlas_database_name: AtlasDatabaseName;
  plain_text_content: string | null;
  json_content: Json[];
  plain_text_name: string | null;
  json_name: Json[];
  parent_notion_page_id: string | null;
  child_scope_ids: string[];
  child_article_ids: string[];
  child_section_and_primary_doc_ids: string[];
  // ... other child arrays
  extra_fields: Json;
  sort_order: number | null;
  // ... timestamp fields
}
```

### Step 8: Batch Insert/Update

Insert new pages and update changed pages in batches for performance.

**Implementation:** `app/server/services/supabase/insert-pages-in-batches.ts` - `upsertPagesInBatches()`

**Batch Configuration:**

- Batch size: 500 pages
- Processes pages in sequential batches
- Logs progress: `"Batch X/Y (N pages)"`

**Versioned Upsert:**

- Uses `versioned_upsert_notion_database_pages` RPC function
- For existing pages: Invalidates current row, inserts new row
- For new pages: Inserts with `date_valid_from = NOW()`, `date_valid_to = NULL`
- Atomic operation ensures consistency

**Separate Processing:**

- **Insert batches**: Pages in `changes.newPages`
- **Update batches**: Pages in `changes.changedProperties` + `changes.changedRelationships`

### Step 9: Generate UUID Mappings

Create bidirectional UUID mappings for newly inserted pages.

**Implementation:** `app/server/services/supabase/insert-pages-in-batches.ts` - `insertUuidMappingsForBatch()`

**UUID Generation:**

- Only runs for `changeType === 'insert'` (new pages)
- Generates random UUID v4 for each new page
- Creates mapping entry: `atlas_document_uuid ↔ notion_page_id`
- Batch size: 500 mappings per insert

**Purpose:**

- Enables stable references independent of Notion infrastructure
- Used in markdown exports and cross-references
- See **[UUID_MAPPING.md](./UUID_MAPPING.md)** for complete documentation

### Step 10: Release Sync Lock

Release the sync lock and update status to `'completed'` or `'failed'`.

**Implementation:** `app/server/services/notion/sync-lock.ts` - `releaseSyncLock()`

## Property & Relationship Mapping

Property and relationship mappings are centralized in a single configuration file.

**Configuration File:** `app/server/atlas/notion-mapping/notion-database-properties-and-relationships.ts`

### Property Mapping Structure

```typescript
interface NotionDatabasePropertyMapping {
  atlasDocumentNo: string; // Document number property name
  atlasDocumentName: string; // Document name property name
  atlasDocumentType: string; // Document type property name
  content: string | null; // Content property name (null if in extra_fields)
  sortOrder?: string; // Sort order property name (optional)
}
```

**Example Mapping (Scopes):**

```typescript
[ATLAS_DATABASES.SCOPES]: {
  properties: {
    atlasDocumentNo: 'Doc No',
    atlasDocumentName: 'Name',
    atlasDocumentType: 'Type',
    content: 'Content',
  },
  childRelationships: {
    [ATLAS_DATABASES.ARTICLES]: 'Articles',
    [ATLAS_DATABASES.NEEDED_RESEARCH]: 'Needed Research',
  },
  parentRelationships: {},
}
```

### Relationship Mapping Structure

**Child Relationships:**

- Maps target database → Notion relationship property name
- Example: `Articles` database has child relationship `'Sections & Primary Docs'`
- Stored in Supabase as typed arrays: `child_article_ids`, `child_section_and_primary_doc_ids`, etc.

**Parent Relationships:**

- Maps parent database → Notion relationship property name
- Example: Articles have parent relationship `'Parent Scope'`
- Stored in Supabase as single ID: `parent_notion_page_id`

**Internal Nesting:**

- Some databases support parent/child within same database
- Sections & Primary Docs: `'Parent Doc'` / `'Subdocs'`
- Agent Scope Database: `'Parent item'` / `'Sub-item'`

### Extra Fields Mapping

Extra fields are properties specific to certain document types, stored in `extra_fields` JSONB column.

**Type Specification Extra Fields:**

```typescript
TYPE_SPECIFICATION_PROPERTY_MAPPING = {
  type_specification_components: 'Components',
  type_specification_doc_identifier_rules: 'Doc Identifier Rules',
  type_specification_additional_logic: 'Additional Logic',
  type_specification_type_category: 'Type Category',
  type_specification_type_name: 'Type Name',
  type_specification_type_overview: 'Type Overview',
};
```

**Scenario Extra Fields:**

```typescript
SCENARIO_PROPERTY_MAPPING = {
  scenario_description: 'Description',
  scenario_finding: 'Finding',
  scenario_additional_guidance: 'Additional Guidance',
};
```

**Scenario Variation Extra Fields:**

- Same structure as Scenario (prefixed with `scenario_variation_`)

**Needed Research Extra Fields:**

```typescript
NEEDED_RESEARCH_PROPERTY_MAPPING = {
  needed_research_content: 'Content',
};
```

See **[ATLAS_EXTRA_FIELDS.md](./ATLAS_EXTRA_FIELDS.md)** for complete documentation.

## Change Detection

Change detection enables efficient delta sync by comparing Supabase state with Notion state.

### First-Time Import

When no existing pages found in Supabase:

- All fetched pages inserted as new
- No comparison needed
- All pages get UUID mappings

### Subsequent Imports

When existing pages found:

- Full comparison executed
- Only changed pages processed
- Logs detailed change information

### Change Detection Algorithm

**1. Create Lookup Maps:**

```typescript
const supabasePagesById = new Map<string, NotionDatabasePage>();
const notionPagesById = new Map<string, EnhancedPageObjectResponse>();
```

**2. Identify New Pages:**

- Pages in Notion but not in Supabase map
- Logged with Notion URL for verification

**3. Identify Deleted Pages:**

- Pages in Supabase but not in Notion map
- Indicates page was deleted or archived in Notion

**4. Compare Existing Pages:**

For each page in both systems:

**Property Comparison:**

- Extract values using property mapping
- Compare plain text values
- Special handling: `sortOrder` converted to number
- Check extra fields based on document type

**Relationship Comparison:**

- Compare `parent_notion_page_id` (single value)
- Compare all `child_*_ids` arrays (order-independent)
- Use sorted arrays for comparison

**5. Categorize Changes:**

- Page can have both property AND relationship changes
- Both categories recorded for comprehensive tracking
- Unchanged pages tracked separately

### Change Detection Output

Console logging provides detailed change information:

```
‼️‼️‼️‼️🆕 New page detected: {page_id}
  👉 https://www.notion.so/{page_id_no_hyphens}

‼️‼️‼️‼️🗑️ Deleted page detected: {page_id}
  👉 https://www.notion.so/{page_id_no_hyphens}

‼️‼️‼️‼️📝 Property change detected in page {page_id}: {property_name}
  👉 https://www.notion.so/{page_id_no_hyphens}

‼️‼️‼️‼️🔗 Relationship change detected in page {page_id}: {relationship_name}
  👉 https://www.notion.so/{page_id_no_hyphens}
```

### Standardized Properties in Change Detection

The change detection system tracks both legacy property names (from `NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS`) and new standardized property names (`Document Number`, `Document Title`).

**Why This Matters:**

When new standardized Notion properties are added (as part of property standardization), they must be explicitly added to the change detection logic. Otherwise, changes to these new fields will not be detected, and pages will be incorrectly marked as "unchanged" even when they have updates.

**Symptom of Missing Standardized Properties:**

- Markdown-to-Notion sync successfully writes new values to Notion
- The automatic Notion-to-Supabase import reports "0 pages with property changes"
- Supabase retains old/incorrect values despite Notion having correct data

**How to Add New Standardized Properties:**

When adding a new standardized property (e.g., a future unified `Type` field), update `compare-database-pages.ts`:

1. **Add to `trackedProperties` array** (around line 170):

```typescript
const trackedProperties = [
  ...Object.values(databaseConfig.properties).filter((prop) => prop !== ''),
  STANDARDIZED_DOCUMENT_NUMBER,
  STANDARDIZED_DOCUMENT_TITLE,
  // Add new standardized property here, e.g.:
  // STANDARDIZED_TYPE,
];
```

2. **Add handling in `extractPropertyValueFromSupabase()`** (around line 355):

```typescript
// Handle standardized properties directly
if (notionPropertyName === STANDARDIZED_DOCUMENT_NUMBER) {
  return page.atlas_document_number ?? null;
}
if (notionPropertyName === STANDARDIZED_DOCUMENT_TITLE) {
  return page.plain_text_name ?? null;
}
// Add new standardized property here, e.g.:
// if (notionPropertyName === STANDARDIZED_TYPE) {
//   return page.atlas_document_type ?? null;
// }
```

**Related Documentation:**

- See **[NOTION_PROPERTY_STANDARDIZATION_ACTION_PLAN.md](./docs/action-plans/NOTION_PROPERTY_STANDARDIZATION_ACTION_PLAN.md)** for the full property standardization plan

## Sync Locking

Sync locking prevents concurrent imports of the same database using the `notion_sync_status` table. Locks expire automatically after 30 minutes to prevent orphaned locks from crashed processes. The script flag `--disable-existing-locks` can clear stale locks manually.

**Implementation:** `app/server/services/notion/sync-lock.ts`

## Batching & Performance

Batching optimizations enable efficient processing of large datasets.

### Page Fetching

**Database Query Batching:**

- Notion API returns max 100 pages per request
- Automatic pagination via `start_cursor`
- Sequential fetching to respect rate limits

**Relationship Fetching:**

- Truncated relations fetched in parallel batches
- Articles database: 60 concurrent requests
- Other databases: 1 concurrent request (sequential)
- Real concurrency controlled by Notion rate limiter

### Database Operations

**Insert/Update Batching:**

- Batch size: 500 pages
- Sequential processing of batches
- Uses PostgreSQL RPC for atomic operations

**UUID Mapping Batching:**

- Batch size: 500 mappings
- Only for newly inserted pages
- Sequential insert batches

### Performance Characteristics

**Full Import (~6000 pages):**

- Duration: ~15 minutes
- 10 databases processed sequentially
- Largest database (Sections & Primary Docs): ~1500 pages

**Delta Import (typical hourly sync):**

- Duration: <5 minutes if few changes
- Most pages unchanged
- Only changed pages processed

### Caching (Development Only)

**Local File Cache:**

- Saves Notion API responses to `.notion-cache/` directory
- Avoids repeated API calls during development
- Significantly faster iteration
- Not used in production

## UUID Mapping

UUID mapping creates stable identifiers for Atlas documents independent of Notion infrastructure.

### Mapping Generation

**When Generated:**

- Only for newly inserted pages
- During Step 9 of import workflow
- After pages successfully inserted to Supabase

**UUID Format:**

- Random UUID (e.g., `550e8400-e29b-41d4-a716-446655440000`)
- Collision probability negligible for Atlas dataset size

**Mapping Storage:**

```typescript
{
  atlas_document_uuid: string; // Generated UUID v4
  notion_page_id: string; // Notion's page UUID
}
```

### Mapping Usage

**Export Tree Conversion:**

- Notion Tree nodes use `notion_page_id`
- Export Tree nodes use `atlas_document_uuid`
- Enables stable references in markdown exports

**Cross-References:**

- Markdown links use Atlas UUIDs
- Independent of Notion page IDs
- Survives Notion page recreations

**Bidirectional Lookup:**

- `notion_page_id` → `atlas_document_uuid` (for exports)
- `atlas_document_uuid` → `notion_page_id` (for imports)

See **[UUID_MAPPING.md](./UUID_MAPPING.md)** for complete documentation.

## Manual Import Script

The import process can be run manually via command-line script for development and maintenance.

**Script Location:** `scripts/import-notion-databases.ts`

### Basic Usage

```bash
# Import all databases
npx tsx scripts/import-notion-databases

# Show help
npx tsx scripts/import-notion-databases --help
```

### Command-Line Flags

**`--help` / `-h`**

- Display help message with all available options
- Lists all available databases

**`--verbose` / `-v`**

- Enable detailed debug logging
- Shows step-by-step processing information
- Sets `DEBUG_LOGGING=true` environment variable

**`--local-cache`**

- Enable local file caching of Notion API responses
- Saves to `.notion-cache/` directory
- Speeds up repeated imports during development
- Not recommended for production use

**`--disable-existing-locks`**

- Delete all existing sync locks before importing
- Clears stale locks from `notion_sync_status` table
- Useful when previous import crashed or was interrupted

**`--database <name>`**

- Import only a specific database
- Database name must match Atlas database name exactly
- Sets import type to `'partial'` (vs `'full_sync'`)

### Available Databases

- `Scopes`
- `Articles`
- `Sections & Primary Docs`
- `Annotations`
- `Tenets`
- `Scenarios`
- `Scenario Variations`
- `Active Data`
- `Agent Scope Database`
- `Needed Research`

### Usage Examples

```bash
# Basic import with progress output
npx tsx scripts/import-notion-databases

# Import with verbose logging for debugging
npx tsx scripts/import-notion-databases --verbose

# Development mode with caching
npx tsx scripts/import-notion-databases --local-cache

# Import with verbose logging and caching
npx tsx scripts/import-notion-databases --verbose --local-cache

# Clear stale locks before importing
npx tsx scripts/import-notion-databases --disable-existing-locks

# Clear locks with verbose output
npx tsx scripts/import-notion-databases --disable-existing-locks --verbose

# Import only Scopes database
npx tsx scripts/import-notion-databases --database "Scopes"

# Import specific database with caching
npx tsx scripts/import-notion-databases --database "Sections & Primary Docs" --local-cache
```

### Script Behavior

**Automatic Revalidation:**

- Revalidates `/atlas` page after successful import
- Ensures UI reflects newly imported data

**Exit Behavior:**

- Explicit `process.exit(0)` on success
- Explicit `process.exit(1)` on error
- Required due to lingering async operations

**Import Type:**

- Full sync: All databases imported (`import_type: 'full_sync'`)
- Partial sync: Single database imported (`import_type: 'partial'`)
- Logged to `import_logs` table for tracking

## Key Files

### Core Import Logic

**`app/server/services/notion/import-database-to-supabase.ts`**

- Main import orchestration
- `importDatabasePagesFromNotionToSupabase()` - Single database import
- `importDatabasesFromNotionToSupabase()` - Multiple database import
- Sync lock lifecycle management
- Import result aggregation and logging

**`app/server/services/notion/fetch-database-pages.ts`**

- Notion API fetching with pagination
- `fetchNotionDatabasePages()` - Fetch all pages
- `fetchNotionDatabasePagesWithRelationships()` - Fetch with full relationships
- Handles truncated relationships via property pagination

**`app/server/services/notion/compare-database-pages.ts`**

- Change detection between Supabase and Notion
- `compareDatabasePages()` - Main comparison function
- Property, relationship, and extra fields comparison
- Returns detailed change categorization

**`app/server/services/notion/convert-notion-pages-to-supabase-format.ts`**

- Transforms Notion API responses to Supabase format
- `convertNotionPagesToDatabaseFormat()` - Batch conversion
- Property extraction using mapping configuration
- Extra fields extraction by document type

### Supporting Services

**`app/server/services/notion/sync-lock.ts`**

- Sync lock management
- `acquireSyncLock()`, `releaseSyncLock()`, `verifySyncLock()`
- Prevents concurrent database imports
- 30-minute automatic expiration

**`app/server/services/supabase/insert-pages-in-batches.ts`**

- Batched database operations
- `upsertPagesInBatches()` - 500 pages per batch
- Versioned temporal table updates
- UUID mapping generation for new pages

**`app/server/services/supabase/delete-pages-from-supabase.ts`**

- Versioned page deletion
- Sets `date_valid_to` timestamp
- Preserves historical data

**`app/server/services/supabase/load-notion-database-pages-from-supabase.ts`**

- Load pages from Supabase for comparison
- Filters by database name and validity

### Configuration Files

**`app/server/atlas/notion-mapping/notion-database-properties-and-relationships.ts`**

- Central property and relationship mapping configuration
- Property mappings for all 10 databases
- Child and parent relationship definitions
- Extra fields property mappings
- Property type overrides for Notion API

**`app/server/atlas/constants.ts`**

- Atlas database constants
- Database ID mappings
- Import database list

### Scripts

**`scripts/import-notion-databases.ts`**

- Command-line import script
- Supports multiple flags for different use cases
- Handles argument parsing and validation

### Supporting Utilities

**`app/server/services/notion/notion-client.ts`**

- Notion API client with rate limiting
- Manages multiple API keys for higher throughput

**`app/server/services/notion/local-file-cache.ts`**

- Local caching for development
- Saves/loads from `.notion-cache/` directory

**`app/server/services/supabase/log-import.ts`**

- Logs import operations to `import_logs` table
- Tracks duration, changes, and errors

## Related Documentation

### Core Pipeline Documentation

- **[ATLAS_DATA_PIPELINE.md](./ATLAS_DATA_PIPELINE.md)** - Complete Atlas data pipeline overview including Notion → Supabase → Markdown workflow
- **[UUID_MAPPING.md](./UUID_MAPPING.md)** - Bidirectional UUID mapping system between Notion and Atlas document UUIDs
- **[ATLAS_TREE_STRUCTURES.md](./ATLAS_TREE_STRUCTURES.md)** - Dual tree architecture (Notion Tree vs Export Tree)

### Atlas Data Formats

- **[ATLAS_EXTRA_FIELDS.md](./ATLAS_EXTRA_FIELDS.md)** - Extra fields documentation for Type Specifications, Scenarios, Scenario Variations, and Needed Research

### Database Schema

- **[README.md](../README.md)** - Database schema documentation including `notion_database_pages` table structure
- **[.cursorrules](../.cursorrules)** - Complete project documentation with database schema details

### Workarounds

- **[NOTION_NESTING_BUG_FIX.md](./NOTION_NESTING_BUG_FIX.md)** - Manual workaround for Notion's sub-item relationship bug at deep nesting levels

## Important Patterns

### Sync Locking

- Prevents concurrent syncs of same content
- Lock expiration for cleanup
- Verified before each sync operation

### Temporal Tables (versioned rows)

- `notion_database_pages` uses `date_valid_from`/`date_valid_to` (UTC) for row validity.
- Current rows have `date_valid_to IS NULL` with a partial unique index ensuring one current row per `notion_page_id`.
- Filtered index optimizes current-state reads by `atlas_database_name`.

Examples:

- Load current rows by database:

```sql
SELECT * FROM notion_database_pages WHERE date_valid_to IS NULL AND atlas_database_name = 'Articles';
```

- Versioned upsert (invalidate current, insert new):

```ts
await supabase().rpc('versioned_upsert_notion_database_pages', { p_rows: payload }).throwOnError();
```

- Soft-delete (invalidate):

```ts
await supabase().rpc('versioned_delete_notion_database_pages', { p_ids: ids }).throwOnError();
```
