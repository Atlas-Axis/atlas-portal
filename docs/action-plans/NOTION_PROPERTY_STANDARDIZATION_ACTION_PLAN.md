# Notion Property Standardization Action Plan

## Overview

This document outlines the plan to standardize Notion database properties across all Atlas databases. The goal is to simplify the Notion-Supabase mapping, reduce complexity in the codebase, and improve performance of the import and sync workflows.

**Related Documentation:**

- [NOTION_PROPERTY_MAPPING.md](../NOTION_PROPERTY_MAPPING.md) - Current property mapping reference
- [NOTION_IMPORT_PROCESS.md](../NOTION_IMPORT_PROCESS.md) - Notion to Supabase import workflow
- [MARKDOWN_TO_NOTION_SYNC.md](../MARKDOWN_TO_NOTION_SYNC.md) - Markdown to Notion sync workflow

## Environment Variable: NOTION_IMPORT_FIELD_MODE

The `NOTION_IMPORT_FIELD_MODE` environment variable controls which Notion property fields are read during the Notion → Supabase import. This provides explicit control over data sources during the property standardization migration.

### Available Modes

| Mode                      | Behavior                                                                                                                     | When to Use                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `old-fields`              | Read ONLY from legacy database-specific properties (e.g., "Doc No", "Name"). Ignores new standardized fields entirely.       | **Default.** Safe for pre-migration state when new fields don't exist or are empty.            |
| `new-fields`              | Read ONLY from standardized properties (`Document Number`, `Document Title`). Throws error if standardized fields are empty. | After Phase 7 when old fields are deprecated and new fields are guaranteed to be populated.    |
| `prefer-new-fallback-old` | Prefer new standardized fields, fall back to old fields if empty.                                                            | During Phase 4-6 migration period to test new fields while maintaining backward compatibility. |

### Configuration

Set the environment variable before running the import:

```bash
# Pre-migration (default if not set)
NOTION_IMPORT_FIELD_MODE=old-fields npx tsx scripts/import-notion-databases.ts

# During migration
NOTION_IMPORT_FIELD_MODE=prefer-new-fallback-old npx tsx scripts/import-notion-databases.ts

# Post-migration (Phase 7+)
NOTION_IMPORT_FIELD_MODE=new-fields npx tsx scripts/import-notion-databases.ts
```

### Migration Timeline

| Migration Phase                 | Recommended Mode          | Reason                                         |
| ------------------------------- | ------------------------- | ---------------------------------------------- |
| Pre-migration (current state)   | `old-fields` (default)    | New fields don't exist or are empty            |
| Phase 4-5 (Population + Verify) | `prefer-new-fallback-old` | Test that new fields work, fall back if issues |
| Phase 6 (Production Migration)  | `prefer-new-fallback-old` | Safe migration with fallback                   |
| Phase 7 (Deprecate Old Fields)  | `new-fields`              | Old fields deprecated, use new exclusively     |
| Phase 8 (Cleanup Complete)      | `new-fields`              | Only valid mode after old fields removed       |

### Relationship to useDynamicValues Toggle

This environment variable is **separate** from the `useDynamicValues` toggle in the sync UI:

- **`NOTION_IMPORT_FIELD_MODE`**: Controls which Notion properties are **read** during import
- **`useDynamicValues`**: Controls whether change detection uses **stored vs calculated** values

They serve different purposes and operate at different stages of the pipeline.

### Implementation

- **Constants**: `app/server/atlas/constants.ts` - `NotionImportFieldMode` type, `getNotionImportFieldMode()` helper
- **Usage**: `app/server/services/notion/convert-notion-pages-to-supabase-format.ts` - Mode-based extraction functions

## Implementation Progress

This section tracks the implementation status of each phase.

### Phase 1: Test Adding New Properties (Dev Environment) ✅ COMPLETED

- [x] Create script to add new properties to Notion databases (`scripts/experiments/add-normalized-notion-fields-to-all-dbs.ts`)
- [x] Run script in **dev environment** to add `Document Number` and `Document Title` properties
- ~~[ ] Manually rename `Doc Type` to `Type` in Agent Scope Database~~ **DEFERRED** - Type field standardization postponed to minimize breaking changes

### Phase 2: Update Markdown to Notion Sync ✅ COMPLETED

- [x] Update `notion-property-builder.ts` to write to new standardized fields (`Document Number`, `Document Title`)
- [x] Write ONLY to new standardized fields (old fields preserved as backup during migration)
- [x] Centralize constants in `app/server/atlas/constants.ts` (`STANDARDIZED_DOCUMENT_NUMBER`, `STANDARDIZED_DOCUMENT_TITLE`)
- [x] Add unit tests for standardized field writing (40 tests in `notion-property-builder.test.ts`)
- [x] Remove `sibling_order_changed` change type

### Phase 3: Update Import for Dual-Read ✅ COMPLETED

- [x] Update `convert-notion-pages-to-supabase-format.ts` to read from both old and new fields
- [x] Implement `extractDocumentNumberWithFallback()` helper function
- [x] Implement `extractRichTextWithFallback()` helper function
- [x] Prefer new fields when populated, fall back to old fields if empty
- [x] Centralize constants - import from `app/server/atlas/constants.ts`
- [x] Add unit tests for dual-read logic (11 tests in `convert-notion-pages-dual-read.test.ts`)

### Phase 3.5: Update Change Detection to Use Stored Values ✅ COMPLETED

- [x] Update `notion-tree-to-export-tree.ts` to use stored values (`atlas_document_number`, `plain_text_name`) instead of dynamically calculated values (`generatedDocID`, `generatedDocName`)
- [x] Update `atlas-diff.ts` to compare `doc_no` field in addition to `type`, `name`, `content`, and extra fields
- [x] Add `ExportTreeOptions` interface with `useDynamicValues` option for migration mode
- [x] Propagate options through `notionTreeNodeToExportTreeNode()` to all child nodes
- [x] Update `diffAtlasScopeTreeLists()` to accept `DiffOptions` and pass through to export tree builder
- [x] Add "Use Dynamic Values (Migration Mode)" checkbox to sync UI (`/atlas/sync`)
- [x] Create `runDiff()` server action to re-run diff when toggle changes
- [x] Add unit tests for both modes (stored vs dynamic values)

**Migration Mode Toggle:**

The sync UI (`/atlas/sync`) now includes a "Use Dynamic Values (Migration Mode)" checkbox that allows switching between:

- **ON (default)**: Uses dynamically calculated values (`generatedDocID`, `generatedDocName`) - the current behavior until production migration is complete
- **OFF**: Uses stored values from Supabase (`atlas_document_number`, `plain_text_name`) - the new standardized behavior (use after migration)

**Important:** The default was changed from OFF to ON because the production migration hasn't been completed yet, and stored values can't be trusted. The Portal and export endpoints also use dynamic values by default.

This toggle enables testing both modes during the migration period. The toggle state is stored in URL params (`?dynamic=true`), and changing it refreshes the page to regenerate the diff server-side.

### Phase 4: Populate New Fields with Dedicated Script

**Important Change:** The original plan to use Markdown-to-Notion sync for population was flawed because with `useDynamicValues=true` (the default), both sides calculate the same values, so no changes are detected. Instead, we use a dedicated population script.

- [ ] Run population script to write calculated values directly to Notion: `npx tsx scripts/populate-standardized-notion-fields.ts`
  - Script builds Atlas tree from Supabase data
  - Extracts calculated `generatedDocID` and `generatedDocName` from tree nodes
  - Updates Notion pages via API with standardized field values
  - Supports resumption via checkpoint file if interrupted
  - Takes ~30-40 minutes for full Atlas (~7000 documents at 3 req/sec)
- [ ] Spot check documents in Notion to verify new fields are populated correctly

### Phase 5: Import and Verify

- [ ] Set import field mode to use fallback: `export NOTION_IMPORT_FIELD_MODE=prefer-new-fallback-old`
- [ ] Run Notion to Supabase import to pull populated values into Supabase: `npx tsx scripts/import-notion-databases.ts`
  - Console will show: `🔧 Import Field Mode: prefer-new-fallback-old (preferring standardized properties, falling back to legacy if empty)`
- [ ] Run verification script to confirm stored values match calculated values: `npx tsx scripts/verify-standardized-fields.ts`
  - Compares `atlas_document_number` (stored) vs `generatedDocID` (calculated)
  - Compares `plain_text_name` (stored) vs `generatedDocName` (calculated)
  - Reports any mismatches with details
  - Exit code 0 = verification passed, safe to proceed
  - Exit code 1 = verification failed, investigate mismatches

### Phase 6: Run Migration in Production Environment

- [ ] Run property creation script: `npx tsx scripts/experiments/add-normalized-notion-fields-to-all-dbs.ts`
  - Creates empty `Document Number` and `Document Title` properties in all 10 databases
- [ ] Run population script: `npx tsx scripts/populate-standardized-notion-fields.ts`
  - Populates new properties with calculated values from Atlas tree
- [ ] Set import field mode: `export NOTION_IMPORT_FIELD_MODE=prefer-new-fallback-old`
- [ ] Run Notion to Supabase import: `npx tsx scripts/import-notion-databases.ts`
  - Pulls populated values from Notion into Supabase
  - Console will show: `🔧 Import Field Mode: prefer-new-fallback-old`
- [ ] Run verification script: `npx tsx scripts/verify-standardized-fields.ts`
  - Confirms stored values match calculated values
- [ ] Add natural sorting formula property manually to each database (see Step 3 in Production Migration Steps)
- [ ] See Production Migration Steps section below for detailed step-by-step instructions

### Phase 7: Deprecate Old Fields

- [ ] Set import field mode to new-fields only: `export NOTION_IMPORT_FIELD_MODE=new-fields`
  - This enforces that all documents have populated standardized fields
  - Import will fail if any standardized field is empty (data integrity check)
- [ ] Run import to verify all documents have standardized fields: `npx tsx scripts/import-notion-databases.ts`
- [ ] Remove dual-read logic from import (read only new fields) - now enforced by env var
- [ ] Update `NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS` to remove references to old field names
- [ ] Remove most of `NOTION_PROPERTY_TYPE_OVERRIDES`
- [ ] Simplify `load-notion-database-pages-from-supabase.ts` sorting logic
- [ ] Mark old properties as deprecated in Notion (rename with `[DEPRECATED]` prefix)
- [ ] Update documentation (`NOTION_PROPERTY_MAPPING.md`, `NOTION_IMPORT_PROCESS.md`, `MARKDOWN_TO_NOTION_SYNC.md`, `.cursorrules`)
- [ ] **When adding standardized Type field**: Add `STANDARDIZED_TYPE` to `trackedProperties` in `compare-database-pages.ts`
- [ ] **When adding standardized Type field**: Update `extractPropertyValueFromSupabase()` to handle standardized Type field

### Phase 8: Remove Migration Mode Code

After migration is complete and verified, remove migration compatibility code:

- [ ] Ensure `NOTION_IMPORT_FIELD_MODE=new-fields` is set in production environment
  - After this phase, `new-fields` is the only supported mode
  - The `old-fields` and `prefer-new-fallback-old` modes become obsolete
- [ ] Change `useDynamicValues` default from `true` to `false` in `toBase()` (currently defaults to dynamic values)
- [ ] Remove `useDynamicValues` option from `ExportTreeOptions`, `DiffOptions`, `SyncFilters`
- [ ] Remove migration mode toggle from sync UI (`content.tsx`)
- [ ] Remove `runDiff()` server action (or simplify to not accept options)
- [ ] Simplify `toBase()` to always use stored values (remove conditional logic)
- [ ] Simplify `notionTreeNodeToExportTreeNode()` (remove options parameter)
- [ ] Simplify `diffAtlasScopeTreeLists()` (remove options parameter)
- [ ] Remove migration mode tests (keep stored values tests only)
- [ ] Clean up documentation references to migration mode
- [ ] Remove empty standardized field skip logic from `compare-database-pages.ts` (lines ~220-230)
- [ ] Optionally simplify `NOTION_IMPORT_FIELD_MODE` to only support `new-fields` (remove other modes)

**Files with inline cleanup comments:**

- `app/server/atlas/export/notion-tree-to-export-tree.ts`
- `app/server/atlas/diff/markdown-supabase-diff.ts`
- `app/atlas/sync/content.tsx`
- `app/atlas/sync/_actions/sync-actions.ts`
- `app/server/services/notion/compare-database-pages.ts` (empty field skip logic)

### Deferred Items

The following items are explicitly deferred for later implementation:

- **Type field standardization**: Decision to standardize "Doc Type" → "Type" for Agent Scope Database has been deferred to minimize breaking changes during migration. Agent Scope Database will continue using "Doc Type" property name.
  - **IMPORTANT**: When implementing, remember to add the standardized Type field to change detection in `compare-database-pages.ts`. See [NOTION_IMPORT_PROCESS.md](../../NOTION_IMPORT_PROCESS.md#standardized-properties-in-change-detection) for the pattern.
- **Document title syntax changes**: Decision on Option 1/2/3 deferred
- **Clean relationship properties**: Moved to separate effort - see [CLEAN_RELATIONSHIP_PROPERTIES.md](./CLEAN_RELATIONSHIP_PROPERTIES.md)

## Migration Strategy Change (January 2026)

**Original Plan Issue:**

The original Phase 4 planned to use the Markdown-to-Notion sync to populate new fields by detecting that they were empty. However, this approach had a fundamental flaw:

- With `useDynamicValues=true` (the default), both Markdown and Supabase use dynamically calculated values
- Since both sides calculate the same values, no differences are detected
- No changes are triggered, so new fields remain empty

**New Approach:**

Use a dedicated population script (`scripts/populate-standardized-notion-fields.ts`) that:

1. Builds the Atlas tree from Supabase data (reuses existing tree building logic)
2. Extracts calculated document numbers and names from tree nodes
3. Directly updates Notion pages via API with standardized field values
4. Operates independently of change detection logic
5. Supports resumption via checkpoint file if interrupted

**Benefits:**

- **Decouples population from sync**: Population is a one-time operation, not dependent on change detection
- **Resumable**: Checkpoint file tracks progress, can resume from last processed page
- **Verifiable**: Dedicated verification script compares stored vs calculated values
- **Clear phases**: Explicit transitions between populate → import → verify → switch defaults
- **Lower risk**: Explicit success/failure per document, no silent failures

## Production Migration Steps

**Prerequisites:**

- Phases 1-3 have been implemented and tested in the development environment
- The codebase with dual-write/dual-read logic is deployed to production
- You have access to production environment variables and Notion workspace
- Population and verification scripts are available (`scripts/populate-standardized-notion-fields.ts`, `scripts/verify-standardized-fields.ts`)

**Important Notes:**

- The migration script is non-destructive - it only adds new properties without modifying or deleting existing data
- The dual-read/dual-write code ensures the system continues to work during the migration
- Old properties remain functional until explicitly deprecated in Phase 7
- The population script uses direct Notion API updates, independent of the sync workflow

### Step-by-Step Production Migration

#### Step 1: Backup (Recommended)

Before making any changes to production:

1. Take a snapshot of the Notion workspace (if possible)
2. Export current Atlas data from Supabase for reference:
   ```bash
   npx tsx scripts/atlas-export/generate-atlas-json.ts
   npx tsx scripts/atlas-export/generate-atlas-markdown.ts
   ```
3. Store these exports in a safe location with timestamp

#### Step 2: Add New Properties to Production Notion Databases

1. Ensure production environment variables are loaded:

   ```bash
   # Verify NODE_ENV and NOTION_API_KEY are set for production
   echo $NODE_ENV  # Should be "production"
   echo $NOTION_API_KEY  # Should be production API key
   ```

2. Run the property addition script:

   ```bash
   npx tsx scripts/experiments/add-normalized-notion-fields-to-all-dbs.ts
   ```

3. The script will:
   - Add `Document Number` (rich_text) property to all 10 Atlas databases (if not exists)
   - Add `Document Title` (rich_text) property to all 10 Atlas databases (if not exists)
   - Skip properties that already exist
   - Log all operations

4. Verify the console output shows successful property additions

#### Step 3: Add Natural Sorting Formula Property

1. Manually add a formula property to each of the 10 Atlas databases in Notion:

   **Property Name**: `Document Number (Sortable)` or similar

   **Property Type**: Formula

   **Formula**:

   ```
   replaceAll(
     replaceAll(
       join(
         format(prop("Document Number")),
         ""
       ),
     "\\.([0-9])\\b", ".0$1"),
   "\\.([0-9])\\.", ".0$1.")
   ```

   This formula pads single-digit numbers in document numbers to enable correct lexicographic sorting (e.g., `A.1.2` → `A.01.02`).

2. Configure Notion database view sorting:
   - Set primary sort by the new formula property (ascending)
   - Remove any existing sort by `No.` property (if present)

3. Mark old sort order property as deprecated:
   - In **Sections & Primary Docs** database: Rename `No.` property to `[DEPRECATED] No.`

#### Step 4: Verify Property Addition

1. Open each of the 10 Atlas databases in Notion:
   - Scopes
   - Articles
   - Sections & Primary Docs
   - Annotations
   - Tenets
   - Scenarios
   - Scenario Variations
   - Active Data
   - Agent Scope Database
   - Needed Research

2. For each database, verify that:
   - `Document Number` property exists (type: Text)
   - `Document Title` property exists (type: Text)
   - Formula property for natural sorting exists (type: Formula)
   - All new properties are empty (as expected for Document Number/Title)
   - Old properties still exist and contain data
   - In Sections & Primary Docs: `No.` property renamed to `[DEPRECATED] No.`

#### Step 5: Run Notion to Supabase Import

1. Set the import field mode to use fallback behavior:

   ```bash
   export NOTION_IMPORT_FIELD_MODE=prefer-new-fallback-old
   ```

2. Trigger a full import to verify field mode works:

   ```bash
   npx tsx scripts/import-notion-databases.ts
   ```

3. Monitor the import:
   - Console will show: `🔧 Import Field Mode: prefer-new-fallback-old (preferring standardized properties, falling back to legacy if empty)`
   - Should complete successfully
   - Import time should be similar to previous runs
   - Check for any warnings or errors in console output

4. Verify data integrity:
   - Check that `atlas_document_number` and `plain_text_name` are populated in Supabase
   - Spot check a few documents to ensure data matches expectations

#### Step 6: Populate New Fields with Dedicated Script

1. Run the population script to write calculated values directly to Notion:

   ```bash
   npx tsx scripts/populate-standardized-notion-fields.ts
   ```

2. Monitor progress:
   - Script processes ~7000 documents at ~3 requests/second (Notion API limit)
   - Takes approximately 30-40 minutes for full Atlas
   - Progress is logged for every page update
   - Checkpoint saved every 100 pages for resumption

3. If interrupted, resume from checkpoint:

   ```bash
   npx tsx scripts/populate-standardized-notion-fields.ts --resume
   ```

4. After completion:
   - New `Document Number` and `Document Title` fields are populated with calculated values
   - Old fields remain unchanged for safety

#### Step 7: Import and Verify

1. Ensure the import field mode is set for migration:

   ```bash
   export NOTION_IMPORT_FIELD_MODE=prefer-new-fallback-old
   ```

2. Run Notion to Supabase import to pull populated values:

   ```bash
   npx tsx scripts/import-notion-databases.ts
   ```

   - Console will show: `🔧 Import Field Mode: prefer-new-fallback-old`

3. Run verification script to confirm stored values match calculated values:

   ```bash
   npx tsx scripts/verify-standardized-fields.ts
   ```

4. Review verification results:
   - Script compares stored (`atlas_document_number`, `plain_text_name`) vs calculated (`generatedDocID`, `generatedDocName`)
   - Reports match percentages and any mismatches
   - Exit code 0 = all values match (safe to proceed)
   - Exit code 1 = some mismatches found (investigate before proceeding)

5. If verification fails:
   - Review mismatch details in output
   - Re-run population script if needed
   - Re-run import and verification

6. Once verification passes:
   - You can safely switch the default from dynamic to stored values
   - Consider switching to `NOTION_IMPORT_FIELD_MODE=new-fields` in Phase 7

#### Step 8: Monitor Production

1. Monitor application logs for any errors related to property reading/writing
2. Check Notion API usage for any unusual patterns
3. Verify that users can still access and edit Atlas documents normally
4. Keep old properties intact until Phase 7 (deprecation)

### Rollback Plan (If Needed)

If issues occur during migration:

1. **If in Step 2 (Adding properties):**
   - New properties can be deleted from Notion databases manually
   - No data loss - old properties were never modified

2. **If in Step 4-5 (Import/Sync):**
   - The dual-read/dual-write code ensures old properties still work
   - Application continues to function with old properties
   - New properties can be cleared and repopulated

3. **If critical issue:**
   - Restore from Notion snapshot (if available)
   - Re-import from pre-migration Supabase export
   - Deploy previous codebase version (before dual-read/dual-write changes)

### Post-Migration Checklist

- [ ] All 10 databases have `Document Number` property
- [ ] All 10 databases have `Document Title` property
- [ ] All 10 databases have natural sorting formula property
- [ ] Population script completed successfully (all pages updated)
- [ ] New properties are populated with correct values
- [ ] Old properties remain intact
- [ ] `No.` sort order property marked as `[DEPRECATED] No.` in Sections & Primary Docs
- [ ] `NOTION_IMPORT_FIELD_MODE` set to `prefer-new-fallback-old` (during migration) or `new-fields` (post-migration)
- [ ] Notion to Supabase import completes successfully with correct field mode logged
- [ ] Verification script passes (stored values match calculated values)
- [ ] Document ordering is correct (sorted by Document Number naturally)
- [ ] No production errors or warnings
- [ ] Users can access and edit documents normally

### Success Indicators

✅ Script output shows all properties added successfully  
✅ All databases show new empty properties (Document Number, Document Title, natural sorting formula)  
✅ Population script completes with 100% success rate  
✅ Import completes without errors  
✅ Verification script passes (exit code 0, all values match)  
✅ Document ordering works correctly with natural sorting formula  
✅ `No.` property marked as deprecated in Sections & Primary Docs  
✅ No production errors or user reports  
✅ Old properties remain unchanged and functional

## Problem Statement

### Inconsistent Property Names

Each Atlas database uses different property names for the same logical fields:

| Database                | Document Number Property | Document Name Property  |
| ----------------------- | ------------------------ | ----------------------- |
| Scopes                  | `Doc No`                 | `Name`                  |
| Articles                | `Doc No`                 | `Name`                  |
| Sections & Primary Docs | `Doc No (or Temp Name)`  | `Doc No (or Temp Name)` |
| Agent Scope Database    | `Formal Doc ID`          | `Document Name`         |
| Annotations             | `Doc No`                 | `Doc No`                |
| Tenets                  | `Doc No (or Temp Name)`  | `Doc No (or Temp Name)` |
| Scenarios               | `Doc No (or Temp Name)`  | `Doc No (or Temp Name)` |
| Scenario Variations     | `Doc No`                 | `Doc No`                |
| Active Data             | `Doc No`                 | `Doc No`                |
| Needed Research         | `Doc No`                 | `Doc No`                |

This inconsistency requires complex mapping logic in `notion-database-properties-and-relationships.ts` and `NOTION_PROPERTY_TYPE_OVERRIDES`.

### Type Field Inconsistency

The document type field is named `Type` in most databases but `Doc Type` in Agent Scope Database. Renaming this field has been **deferred** to minimize breaking changes during migration. See [Deferred Items](#deferred-items) for details.

### Document Title Syntax Inconsistency

Some databases embed ancestor information in document titles:

- **Sections & Primary Docs example**: `A.1.5 - A10 - Aligned Delegates - Operational Security - Facilitators Must Err On Side Of Caution`
  - Only `Facilitators Must Err On Side Of Caution` is the actual document name
  - The rest is ancestor context (article number, article name, parent section names)

This requires special parsing logic in `getDocumentTitle()` and `getLastTitlePart()` functions.

### Complex Sorting Logic

Current sorting uses multiple configurations:

- `DEFAULT_SORT_CRITERIA` in `load-notion-database-pages-from-supabase.ts`
- `ATLAS_DATABASE_SORT_CRITERIA_OVERRIDES` for database-specific sorting
- `No.` property for manual sort order in some databases
- Notion's own sorting configuration per database

This complexity causes ordering discrepancies between Notion, Supabase, and Markdown exports, leading to issues during Markdown to Notion sync testing.

### Bloated Relationship Properties

Some databases include ALL descendant IDs in their relationship properties instead of just direct children:

- **Example**: Article `A.2.4 Sky Primitives` has 640 relationships to `Sections & Primary Docs`
  - Should only have ~20 direct children
  - Currently includes all deeply nested descendants

**Impact:**

- Notion to Supabase import is ~3x slower than necessary because of this one relationship in the Articles database
- Relationship fetching requires pagination for truncated relations (>25 items) and Notion API responses are very slow for property pagination. It takes 9 minutes out of the 15 minutes just to paginate this one relationship between Articles and Sections & Primary Docs
- Change detection and diffing is slower
- Markdown to Notion sync has unnecessary complexity

## Migration Safety Strategy

### Old Fields Preserved as Backup

During the migration period, the Markdown-to-Notion sync workflow has been modified to **write ONLY to new standardized fields**, preserving old fields untouched as a backup. This provides a safety net in case something goes wrong during the first production sync.

**Implementation Details:**

- **Population Script** (`scripts/populate-standardized-notion-fields.ts`): Writes ONLY to new fields (`Document Number`, `Document Title`)
- **Markdown-to-Notion Sync** (`buildNotionProperties`): Writes ONLY to new fields during migration
- **Old Fields**: Remain unchanged in Notion with original values
- **Recovery**: If issues occur, old fields can be used to restore original values

**What Gets Written:**

| Field Type                                              | Written by Sync? | Notes                     |
| ------------------------------------------------------- | ---------------- | ------------------------- |
| `Document Number` (new)                                 | ✅ Yes           | New standardized field    |
| `Document Title` (new)                                  | ✅ Yes           | New standardized field    |
| Old name fields (e.g., "Name", "Doc No (or Temp Name)") | ❌ No            | Preserved as backup       |
| Old number fields (e.g., "Doc No", "No.")               | ❌ No            | Preserved as backup       |
| Type field                                              | ✅ Yes           | Not affected by migration |
| Content field                                           | ✅ Yes           | Not affected by migration |
| Extra fields                                            | ✅ Yes           | Not affected by migration |
| Relationship properties                                 | ✅ Yes           | Not affected by migration |

**After Migration Verification:**

Once the migration is verified and old fields are deprecated (Phase 7), the sync can optionally be updated to write to old fields again if needed for legacy integrations, or old properties can be deleted from Notion databases entirely.

## New Standardized Fields

### Document Number (rich_text)

A new `Document Number` property will be added to all Atlas databases:

- Type: `rich_text` (Text)
- Values: Document numbers like `A.1.3.4.12`
- Maps to existing Supabase column: `atlas_document_number`
- Used for ordering documents (natural sort via formula)
- This field is not imported during the Notion to Supabase sync at the moment (maybe in the future?) - currently, it's calculated during tree building to ensure data consistency in the generated tree

### Document Title (rich_text)

A new `Document Title` property will be added to all Atlas databases:

- Type: `rich_text`
- Values: The document's own name only (not including ancestor context)
- Maps to existing Supabase column: `plain_text_name`

### Type (select)

Already standardized as `Type` in most databases. The Agent Scope Database uses `Doc Type` instead, but renaming has been **deferred** to minimize breaking changes. See [Deferred Items](#deferred-items) for details.

### Supabase Schema

No Supabase schema changes are needed. New Notion properties will map to existing columns:

- `Document Number` → `atlas_document_number`
- `Document Title` → `plain_text_name`

## Document Title Syntax (Open Question)

The syntax for document titles in Notion is an open question to be decided during implementation:

**Option 1: Simplify to document's own name only**

- `Document Title` contains only the document's name
- Example: `Facilitators Must Err On Side Of Caution`
- Cleaner, simpler, consistent across all databases

**Option 2: Keep current complex syntax**

- Maintain backward compatibility
- Some users may rely on seeing ancestor context in titles

**Option 3: Construct dynamically**

- Use Notion formula to construct full titles from relationships
- Or construct during Markdown to Notion sync

Decision will be made during implementation based on user needs.

## Migration Strategy

### Phase 1: Add New Properties (Non-Destructive)

**Notion Changes:**

1. Add `Document Number` (rich_text) property to all 10 Atlas databases
2. Add `Document Title` (rich_text) property to all 10 Atlas databases

**Important:**

- New properties start empty
- Old properties remain untouched
- No production data is affected

### Phase 2: Update Markdown to Notion Sync

**Code Changes:**

1. Update sync to write ONLY to new standardized fields (old fields preserved as backup):
   - Write `Document Number` (not database-specific doc number fields)
   - Write `Document Title` (not database-specific name fields)
2. Remove `sibling_order_changed` change type

**Files Updated:**

- `app/atlas/sync/_lib/notion-property-builder.ts` - Writes only to standardized fields
- `app/server/atlas/constants.ts` - Centralized constants for standardized property names

### Phase 3: Update Import for Dual-Read

**Code Changes:**

1. Modify Notion to Supabase import to read from BOTH old and new fields
2. Prefer new fields when populated, fall back to old fields
3. Maintains round-trip integrity during transition

**Files to Update:**

- `app/server/services/notion/convert-notion-pages-to-supabase-format.ts`
- `app/server/atlas/notion-mapping/notion-database-properties-and-relationships.ts`

### Phase 4: Run Initial Sync

**Actions:**

1. Run Markdown to Notion sync to populate new fields across all documents
2. New properties get populated with correct values from Markdown source
3. Old properties remain unchanged for safety

**Verification:**

- Spot check documents in Notion to verify new fields are populated correctly
- Compare Document Number values with expected values from Markdown

### Phase 5: Verify Round-Trip

**Testing:**

1. Export Atlas from Supabase to Markdown
2. Make test changes in Markdown
3. Sync changes to Notion
4. Run Notion to Supabase import
5. Export again and verify changes persisted correctly

**Verification Checklist:**

- Document numbers match
- Document titles match
- Relationships are correct (direct children only)
- Ordering is consistent across all systems

### Phase 7: Deprecate Old Fields

**Code Changes:**

1. Remove dual-read logic from import (read only new fields)
2. Update `NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS` to remove references to old field names. New field names don’t have to be mapped one by one in `NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS` as they will be the same for every database
3. Remove most of `NOTION_PROPERTY_TYPE_OVERRIDES`
4. Simplify `load-notion-database-pages-from-supabase.ts` sorting logic

**Notion Changes:**

1. Mark old properties as deprecated (rename with `[DEPRECATED]` prefix):
   - Document number properties: `Doc No`, `Doc No (or Temp Name)`, `Formal Doc ID`
   - Document name properties: `Name`, `Document Name`
   - Sort order property: `No.` (in Sections & Primary Docs)
2. Eventually remove old properties from Notion databases:
   - All deprecated document number and name properties
   - `No.` sort order property (Sections & Primary Docs)
   - Keep: Formula property for natural sorting by Document Number

**Documentation Updates:**

- Update `NOTION_PROPERTY_MAPPING.md`
- Update `NOTION_IMPORT_PROCESS.md`
- Update `MARKDOWN_TO_NOTION_SYNC.md`
- Update `.cursorrules`

## Ordering Simplification

### Current State

The system currently uses multiple sorting strategies across different contexts:

**1. Supabase Query Sorting** (`load-notion-database-pages-from-supabase.ts`):

- `DEFAULT_SORT_CRITERIA`: `['sort_order', 'atlas_document_number_sortable', 'notion_page_id']`
- `ATLAS_DATABASE_SORT_CRITERIA_OVERRIDES`: Database-specific overrides
  - Sections & Primary Docs: `['sort_order', 'plain_text_name', 'notion_page_id']`
  - Agent Scope Database: `['atlas_document_number_sortable', 'notion_page_id']`

**2. Tree Building & Client-Side Sorting** (`atlas-tree-helpers.ts`):

- `sortAtlasDocuments()` function applies different sorting logic per database:
  - Most databases: Sort by `atlas_document_number` using `compareDocNumbers()`
  - Sections & Primary Docs: Sort by `sort_order` first, then `atlas_document_number`

**3. Notion Database Properties**:

- `No.` property (number type) in Sections & Primary Docs for manual ordering
- Stored in `sort_order` field in Supabase
- Defined in `NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS` (line 81)
- Type override in `NOTION_PROPERTY_TYPE_OVERRIDES` (line 375)

**4. Nesting Bug Fix System** (`NOTION_NESTING_BUG_FIX.md`):

- `place_after_sibling_notion_page_id` field for manual sibling positioning
- Used to override incorrect ordering from Notion at deep nesting levels
- Applied during tree building in `applyNestingOverrides()`

### New State

After migration, the system will use a unified ordering strategy:

**Single Ordering Strategy**: Sort by `Document Number` using natural ordering across all databases

**Notion Formula for Natural Sorting**:

Add a formula property to each database for natural sorting by Document Number:

```
replaceAll(
  replaceAll(
    join(
      format(prop("Document Number")),
      ""
    ),
  "\\.([0-9])\\b", ".0$1"),
"\\.([0-9])\\.", ".0$1.")
```

This pads single-digit numbers to enable correct lexicographic sorting:

- `A.1.2` → `A.01.02`
- `A.1.12` → `A.01.12`
- `A.10.3` → `A.10.03`

### Code Changes Required

**Files to Update**:

1. **`load-notion-database-pages-from-supabase.ts`**:
   - Remove `ATLAS_DATABASE_SORT_CRITERIA_OVERRIDES` constant
   - Simplify `DEFAULT_SORT_CRITERIA` to: `['atlas_document_number_sortable', 'notion_page_id']`
   - Remove `getSortCriteria()` function or simplify to always return default criteria

2. **`atlas-tree-helpers.ts`**:
   - Simplify `sortAtlasDocuments()` to use `compareDocNumbers()` for all databases
   - Remove special case for Sections & Primary Docs (no more `sort_order` check)

3. **`notion-database-properties-and-relationships.ts`**:
   - Remove `sortOrder: 'No.'` from Sections & Primary Docs properties (line 81)
   - Remove `'No.': 'number'` from `NOTION_PROPERTY_TYPE_OVERRIDES` (line 375)
   - Clean up JSDoc comments mentioning sort order

4. **`convert-notion-pages-to-supabase-format.ts`**:
   - Remove `extractSortOrder()` function (lines 333-361)
   - Remove sort order extraction logic from `convertSingleNotionPageToDatabaseFormat()` (lines 117-119)

5. **`compare-database-pages.ts`**:
   - Remove `SORT_ORDER` from `extractPropertyValueFromSupabase()` switch statement (lines 383-389)
   - Consider removing sort_order from tracked properties if it's no longer needed for change detection

6. **`notion-database-page.ts`**:
   - Keep `sort_order` field in TypeScript interface (for backward compatibility with existing data)
   - Add deprecation comment
   - Eventually remove field after data migration

7. **`003_create_notion_database_pages_table.sql`**:
   - Keep `sort_order` column in database schema (for backward compatibility)
   - Add deprecation comment
   - Eventually drop column after data migration

8. **`notion-nesting-bug-mappings.ts`**:
   - Keep `place_after_sibling_notion_page_id` functionality
   - This is still needed as a workaround for Notion's deep nesting bug
   - Note: This is separate from `sort_order` - it's for manual parent-child relationship corrections

9. **`apply-nesting-overrides.ts`**:
   - Keep sibling positioning logic (lines 79-100)
   - This is still needed for nesting bug workarounds

**Database Migration**:

- Phase 1: Keep `sort_order` field for backward compatibility
- Phase 2: Stop writing to `sort_order` field during imports
- Phase 3: Eventually drop column after verifying all ordering works correctly

**Notion Changes**:

1. Add formula property for natural sorting to all 10 Atlas databases (as described above)
2. Mark `No.` property as deprecated in Sections & Primary Docs (rename to `[DEPRECATED] No.`)
3. Verify sorting works correctly with new formula property
4. Eventually remove `No.` property from Sections & Primary Docs database after verification period

**Migration Timeline for Notion Property Removal**:

- **Immediate**: Add formula property for natural sorting
- **Phase 7**: Mark `No.` as deprecated (rename with prefix)
- **After verification period (e.g., 1-2 months)**: Permanently delete `No.` property

### Markdown to Notion Sync Simplification

Remove `sibling_order_changed` change type entirely (already completed in Phase 2):

- Syncing Document Number is sufficient for correct ordering
- Ordering happens automatically in Notion (via formula), Supabase (via sort), and exports
- No need to track sibling order changes explicitly

## Migration Scripts

There are three scripts involved in the property standardization migration, run in this order:

1. **Property Creation Script** - Creates empty properties in Notion databases
2. **Population Script** - Fills properties with calculated values
3. **Verification Script** - Verifies values match calculated values

### Property Creation Script

**File**: `scripts/experiments/add-normalized-notion-fields-to-all-dbs.ts`

**Purpose**: Creates the new standardized properties (`Document Number`, `Document Title`) in all 10 Atlas databases in Notion. This script only creates empty properties - it does not populate values.

**How it works**:

1. Iterates through all 10 Atlas databases
2. For each database, checks if properties already exist
3. Adds `Document Number` (rich_text) property if not present
4. Adds `Document Title` (rich_text) property if not present
5. Skips properties that already exist (safe to run multiple times)

**Usage**:

```bash
npx tsx scripts/experiments/add-normalized-notion-fields-to-all-dbs.ts
```

**Output**: Lists all 10 databases with status for each property (added or already exists).

**Note**: This script is environment-aware. Ensure the correct `NOTION_API_KEY` environment variable is set:

- Development: Points to dev/test Notion workspace
- Production: Points to production Notion workspace

**Related**: See Phase 1 and Phase 6 in this document for when to run this script.

### Population Script

**File**: `scripts/populate-standardized-notion-fields.ts`

**Purpose**: Populates the new standardized "Document Number" and "Document Title" fields in all Atlas databases by writing dynamically calculated values directly to Notion via API.

**How it works**:

1. Loads all Atlas pages from Supabase
2. Builds Atlas tree structure (calculates document numbers and names)
3. Flattens tree to get all nodes
4. For each node, updates Notion page with:
   - `Document Number` = node's `generatedDocID`
   - `Document Title` = node's `generatedDocName`
5. Saves checkpoint every 100 pages for resumption
6. Respects Notion API rate limits (~3 requests/second)

**Usage**:

```bash
# Normal run
npx tsx scripts/populate-standardized-notion-fields.ts

# Resume from checkpoint
npx tsx scripts/populate-standardized-notion-fields.ts --resume

# Dry run (show what would be updated)
npx tsx scripts/populate-standardized-notion-fields.ts --dry-run
```

**Performance**: ~30-40 minutes for full Atlas (~7000 documents)

### Verification Script

**File**: `scripts/verify-standardized-fields.ts`

**Purpose**: Verifies that stored values in Supabase match dynamically calculated values, confirming the migration was successful.

**How it works**:

1. Loads all Atlas pages from Supabase
2. Builds Atlas tree structure (calculates document numbers and names)
3. For each node, compares:
   - Stored `atlas_document_number` vs calculated `generatedDocID`
   - Stored `plain_text_name` vs calculated `generatedDocName`
4. Reports match percentages and any mismatches
5. Exits with code 0 if all match, code 1 if mismatches found

**Usage**:

```bash
# Normal run (shows only mismatches)
npx tsx scripts/verify-standardized-fields.ts

# Verbose mode (shows all comparisons)
npx tsx scripts/verify-standardized-fields.ts --verbose
```

**Exit codes**:

- `0` - All values match (verification passed, safe to switch defaults)
- `1` - Some values don't match (verification failed, investigate)
- `2` - Fatal error occurred

## Code Changes Summary

### Files to Update

| File                                                                              | Changes                                                                                             |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Migration Scripts:**                                                            |                                                                                                     |
| `scripts/experiments/add-normalized-notion-fields-to-all-dbs.ts`                  | Creates empty `Document Number` and `Document Title` properties in all Atlas databases              |
| `scripts/populate-standardized-notion-fields.ts`                                  | **NEW** - Populates new fields in Notion with calculated values                                     |
| `scripts/verify-standardized-fields.ts`                                           | **NEW** - Verifies stored values match calculated values                                            |
| **Property Standardization:**                                                     |                                                                                                     |
| `app/server/atlas/notion-mapping/notion-database-properties-and-relationships.ts` | Add new standardized property mappings, dual-read logic, eventually simplify                        |
| `app/server/services/notion/convert-notion-pages-to-supabase-format.ts`           | Add dual-read logic for old/new fields; remove `extractSortOrder()` and sort order extraction logic |
| `app/server/services/notion/compare-database-pages.ts`                            | Remove `SORT_ORDER` case from `extractPropertyValueFromSupabase()`                                  |
| `app/atlas/sync/_lib/*`                                                           | Write ONLY to new fields (old fields preserved), remove sibling order logic (already done)          |
| `app/atlas/sync/_actions/*`                                                       | Update server actions                                                                               |
| `app/atlas/sync/AGENTS.md`                                                        | Remove sibling_order_changed documentation (already done)                                           |
| **Ordering Simplification:**                                                      |                                                                                                     |
| `app/server/services/supabase/load-notion-database-pages-from-supabase.ts`        | Remove `ATLAS_DATABASE_SORT_CRITERIA_OVERRIDES`; simplify to use Document Number only               |
| `app/server/atlas/notion-tree/atlas-tree-helpers.ts`                              | Simplify `sortAtlasDocuments()` to use `compareDocNumbers()` for all databases                      |
| `app/server/database/notion-database-page.ts`                                     | Add deprecation comment to `sort_order` field                                                       |
| `app/server/database/003_create_notion_database_pages_table.sql`                  | Add deprecation comment to `sort_order` column                                                      |
| **Document Title Simplification (if chosen):**                                    |                                                                                                     |
| `app/server/atlas/notion-tree/atlas-tree-helpers.ts`                              | Simplify `getDocumentTitle()` once titles are standardized; remove `getLastTitlePart()`             |

### Code to Remove (Phase 7)

**Sorting-Related Code:**

- `ATLAS_DATABASE_SORT_CRITERIA_OVERRIDES` constant (`load-notion-database-pages-from-supabase.ts`)
- Special-case sorting logic for Sections & Primary Docs (`atlas-tree-helpers.ts`)
- `extractSortOrder()` function (`convert-notion-pages-to-supabase-format.ts`)
- `sortOrder` property mapping in `NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS`
- `'No.': 'number'` entry in `NOTION_PROPERTY_TYPE_OVERRIDES`
- `SORT_ORDER` case in `extractPropertyValueFromSupabase()` switch statement
- Eventually: `sort_order` field from TypeScript interfaces and database schema

**Property Standardization Code:**

- Most entries in `NOTION_PROPERTY_TYPE_OVERRIDES` (only title types and special extra field overrides will remain)
- Dual-read logic from import (read only new standardized fields)
- Database-specific property name lookups in `NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS`
- `sibling_order_changed` change type and related code (already removed in Phase 2)

**Document Title Simplification** (if Option 1 is chosen):

- `getLastTitlePart()` function (`atlas-tree-helpers.ts`)
- Special case logic for Sections & Primary Docs and Active Data in `getDocumentTitle()`

**Note on Nesting Bug Fix System:**

- **DO NOT REMOVE**: `place_after_sibling_notion_page_id` functionality in nesting bug fix system
- **DO NOT REMOVE**: Sibling positioning logic in `applyNestingOverrides()`
- These are independent workarounds for Notion's deep nesting relationship bug
- They are not related to the `sort_order` field being removed

## Performance Impact

### Import Performance

- **Current**: ~15 minutes for full import (~7000 pages)
- **After property standardization**: Similar performance (no significant change expected)
- **Note**: Import performance improvements from clean relationships tracked separately in [CLEAN_RELATIONSHIP_PROPERTIES.md](./CLEAN_RELATIONSHIP_PROPERTIES.md)

### Change Detection

- Simpler logic (no sibling order tracking)
- Consistent ordering across all systems

### Markdown to Notion Sync

- Simpler change detection (4 change types instead of 5 - removed `sibling_order_changed`)
- Safer migration (old fields preserved as backup)

## Important Distinction: Nesting Bug Fix vs Sort Order

The system has two separate mechanisms for controlling document ordering and positioning:

### 1. Sort Order System (Being Removed)

**Purpose**: Controls the order of documents within their parent using a manual numeric field

**Implementation**:

- `sort_order` field in Supabase (type: `DECIMAL(5,2)`)
- `No.` property in Sections & Primary Docs Notion database (type: number)
- Used during Supabase queries and tree building for sorting
- Database-specific sorting logic in `ATLAS_DATABASE_SORT_CRITERIA_OVERRIDES`

**Status**: Being removed as part of this migration. After migration, ordering will be determined solely by Document Number using natural sorting.

### 2. Nesting Bug Fix System (Keeping)

**Purpose**: Manually corrects incorrect parent-child relationships caused by Notion's deep nesting bug

**Implementation**:

- `notion_nesting_bug_mapping` table in Supabase
- `place_after_sibling_notion_page_id` field for manual sibling positioning
- Applied during tree building via `applyNestingOverrides()`
- UI at `/atlas/notion-nesting-fix` for managing mappings

**Status**: This system is INDEPENDENT of sort_order and will be RETAINED after migration. It serves a different purpose (fixing broken relationships) rather than controlling sort order.

**Key Difference**:

- **Sort Order**: Determines the numeric position of a document among its siblings (being removed)
- **Nesting Bug Fix**: Corrects which parent a document belongs to and optionally positions it after a specific sibling (being kept)

The nesting bug fix system's `place_after_sibling` feature is NOT the same as `sort_order`:

- `sort_order`: A numeric field (0, 1, 2, 3...) that determines position
- `place_after_sibling`: A reference to another document's UUID, used to insert a document after a specific sibling when applying relationship overrides

After migration, sibling positioning within a parent will be determined by:

1. Document Number (primary) - natural sorting
2. Nesting bug fix overrides (if applicable) - for correcting broken relationships

## Risks and Mitigations

### Risk: Data loss during migration

**Mitigation**: Old properties are never modified or deleted until new properties are verified working. Dual-read ensures no data loss during transition.

### Risk: Breaking existing workflows

**Mitigation**: Phased approach allows verification at each step. Old properties remain functional until explicitly deprecated.

### Risk: Notion formula limitations

**Mitigation**: Test formula thoroughly before deployment. Have fallback plan to construct values during sync if formula doesn't work.

### Risk: Performance regression

**Mitigation**: Monitor import times during transition. Clean relationships should improve performance, not degrade it.

## Success Criteria

1. All Atlas databases have standardized `Document Number` and `Document Title` properties
2. Markdown to Notion sync works correctly with new fields (writes only to new fields)
3. Notion to Supabase import reads from new fields (with fallback to old fields during migration)
4. Ordering is consistent across Notion, Supabase, and Markdown exports
5. `sibling_order_changed` code removed from sync workflow
6. Old properties deprecated and eventually removed
7. Verification script confirms stored values match calculated values

## Appendix: Affected Databases

All 10 Atlas databases will be updated:

1. Scopes
2. Articles
3. Sections & Primary Docs
4. Annotations
5. Tenets
6. Scenarios
7. Scenario Variations
8. Active Data
9. Agent Scope Database
10. Needed Research
