# Notion Property Standardization Action Plan

## Overview

This document outlines the plan to standardize Notion database properties across all Atlas databases. The goal is to simplify the Notion-Supabase mapping, reduce complexity in the codebase, and improve performance of the import and sync workflows.

**Related Documentation:**

- [NOTION_PROPERTY_MAPPING.md](./NOTION_PROPERTY_MAPPING.md) - Current property mapping reference
- [NOTION_IMPORT_PROCESS.md](./NOTION_IMPORT_PROCESS.md) - Notion to Supabase import workflow
- [MARKDOWN_TO_NOTION_SYNC.md](./MARKDOWN_TO_NOTION_SYNC.md) - Markdown to Notion sync workflow

## Implementation Progress

This section tracks the implementation status of each phase.

### Phase 1: Add New Properties (Non-Destructive) ✅ COMPLETED

- [x] Create script to add new properties to Notion databases (`scripts/experiments/add-normalized-notion-fields-to-all-dbs.ts`)
- [x] Run script in **dev environment** to add `Document Number` and `Document Title` properties
- [x] Manually rename `Doc Type` to `Type` in Agent Scope Database (**dev environment**)
- [ ] Run migration in **production environment** (see Production Migration Steps below)
- [ ] Add new clean relationship properties (direct children only) - **DEFERRED**

### Phase 2: Update Markdown to Notion Sync ✅ COMPLETED

- [x] Update `notion-property-builder.ts` to write to new standardized fields (`Document Number`, `Document Title`)
- [x] Continue writing to old fields for backward compatibility during transition
- [x] Centralize constants in `app/server/atlas/constants.ts` (`STANDARDIZED_DOCUMENT_NUMBER`, `STANDARDIZED_DOCUMENT_TITLE`)
- [x] Add unit tests for standardized field writing (8 tests in `notion-property-builder.test.ts`)
- [x] Remove `sibling_order_changed` change type
- [ ] Update sync to write to new clean relationship properties - **DEFERRED** (depends on creating new relationship properties in Notion first)

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

- **OFF (default)**: Uses stored values from Supabase (`atlas_document_number`, `plain_text_name`) - the new standardized behavior
- **ON**: Uses dynamically calculated values (`generatedDocID`, `generatedDocName`) - the old behavior

This toggle enables testing both modes during the migration period. The toggle state is stored in URL params (`?dynamic=true`), and changing it refreshes the page to regenerate the diff server-side.

### Phase 4: Run Initial Sync

- [ ] Run Markdown to Notion sync to populate new fields across all documents
- [ ] Spot check documents in Notion to verify new fields are populated correctly
- [ ] Compare Document Number values with expected values from Markdown

### Phase 5: Verify Round-Trip

- [ ] Export Atlas from Supabase to Markdown
- [ ] Make test changes in Markdown
- [ ] Sync changes to Notion
- [ ] Run Notion to Supabase import
- [ ] Export again and verify changes persisted correctly

### Phase 6: Run migration in production environment (see Production Migration Steps below)

### Phase 7: Deprecate Old Fields

- [ ] Remove dual-read logic from import (read only new fields)
- [ ] Update `NOTION_DATABASE_PROPERTIES_AND_RELATIONSHIPS` to remove references to old field names
- [ ] Remove most of `NOTION_PROPERTY_TYPE_OVERRIDES`
- [ ] Simplify `load-notion-database-pages-from-supabase.ts` sorting logic
- [ ] Mark old properties as deprecated in Notion (rename with `[DEPRECATED]` prefix)
- [ ] Update documentation (`NOTION_PROPERTY_MAPPING.md`, `NOTION_IMPORT_PROCESS.md`, `MARKDOWN_TO_NOTION_SYNC.md`, `.cursorrules`)

### Phase 8: Remove Migration Mode Code

After migration is complete and verified, remove migration compatibility code:

- [ ] Remove `useDynamicValues` option from `ExportTreeOptions`, `DiffOptions`, `SyncFilters`
- [ ] Remove migration mode toggle from sync UI (`content.tsx`)
- [ ] Remove `runDiff()` server action (or simplify to not accept options)
- [ ] Simplify `toBase()` to always use stored values (remove conditional logic)
- [ ] Simplify `notionTreeNodeToExportTreeNode()` (remove options parameter)
- [ ] Simplify `diffAtlasScopeTreeLists()` (remove options parameter)
- [ ] Remove migration mode tests (keep stored values tests only)
- [ ] Clean up documentation references to migration mode

**Files with inline cleanup comments:**

- `app/server/atlas/export/notion-tree-to-export-tree.ts`
- `app/server/atlas/diff/markdown-supabase-diff.ts`
- `app/atlas/sync/content.tsx`
- `app/atlas/sync/_actions/sync-actions.ts`

### Deferred Items

The following items are explicitly deferred for later implementation:

- **Document title syntax changes**: Decision on Option 1/2/3 deferred
- **Clean relationship properties for Articles database**: Will be implemented separately
  - Requires creating new "Sections" relationship property in Articles database (Notion)
  - Then updating sync to write to the new property
  - Then updating import to read from the new property
- **Ordering simplification**: Depends on relationship cleanup

## Production Migration Steps

**Prerequisites:**

- Phases 1-3 have been implemented and tested in the development environment
- The codebase with dual-write/dual-read logic is deployed to production
- You have access to production environment variables and Notion workspace

**Important Notes:**

- The migration script is non-destructive - it only adds new properties without modifying or deleting existing data
- The dual-read/dual-write code ensures the system continues to work during the migration
- Old properties remain functional until explicitly deprecated in Phase 7

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

#### Step 3: Manually Rename "Doc Type" to "Type" in Agent Scope Database

1. Open the Agent Scope Database in Notion (production workspace)
2. Navigate to database properties/columns
3. Find the property named `Doc Type`
4. Rename it to `Type`
5. Verify that all documents still display correctly

**Why manual?** The Notion API doesn't support renaming properties, only adding/removing them. Manual renaming preserves all data and existing select options.

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
   - Both properties are empty (as expected)
   - Old properties still exist and contain data

#### Step 5: Run Notion to Supabase Import

1. Trigger a full import to verify dual-read logic works:

   ```bash
   npx tsx scripts/import-notion-databases.ts
   ```

2. Monitor the import:
   - Should complete successfully
   - Import time should be similar to previous runs
   - Check for any warnings or errors in console output

3. Verify data integrity:
   - Check that `atlas_document_number` and `plain_text_name` are populated in Supabase
   - Spot check a few documents to ensure data matches expectations

#### Step 6: Run Markdown to Notion Sync (Populate New Fields)

1. Navigate to the sync UI in production:

   ```
   https://sky-atlas.io/atlas/sync
   ```

2. Load the current Atlas markdown from GitHub

3. The diff should show changes for ALL documents because:
   - New `Document Number` and `Document Title` fields are empty in Notion
   - The sync will populate them from the markdown source

4. Review the changes (will be extensive)

5. Click "Sync to Notion" and monitor progress:
   - This will take time (potentially hours for full Atlas)
   - Watch for errors in the operation log
   - Graceful stop is available if needed

6. After sync completes:
   - New fields should now be populated with values
   - Old fields remain unchanged

#### Step 7: Verify Round-Trip Integrity

1. Export Atlas from production Supabase:

   ```bash
   # Ensure production env vars are set
   npx tsx scripts/atlas-export/generate-atlas-json.ts
   npx tsx scripts/atlas-export/generate-atlas-markdown.ts
   ```

2. Compare with the pre-migration export from Step 1:
   - Document numbers should match
   - Document titles should match
   - Relationships should be identical
   - Ordering should be consistent

3. Make a small test change in the exported markdown:
   - Edit content of a test document
   - Sync the change back to Notion via the sync UI

4. Re-import from Notion to Supabase:

   ```bash
   npx tsx scripts/import-notion-databases.ts
   ```

5. Export again and verify the test change persisted correctly

#### Step 8: Monitor Production

1. Monitor application logs for any errors related to property reading/writing
2. Check Notion API usage for any unusual patterns
3. Verify that users can still access and edit Atlas documents normally
4. Keep old properties intact until Phase 7 (deprecation)

### Rollback Plan (If Needed)

If issues occur during migration:

1. **If in Step 2-3 (Adding properties):**
   - New properties can be deleted from Notion databases manually
   - No data loss - old properties were never modified

2. **If in Step 5-6 (Import/Sync):**
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
- [ ] Agent Scope Database has `Type` property (renamed from `Doc Type`)
- [ ] New properties are populated with correct values
- [ ] Old properties remain intact
- [ ] Notion to Supabase import completes successfully
- [ ] Markdown to Notion sync works correctly
- [ ] Round-trip export-import-export produces consistent results
- [ ] No production errors or warnings
- [ ] Users can access and edit documents normally

### Success Indicators

✅ Script output shows all properties added successfully  
✅ Manual rename completed in Notion UI  
✅ All databases show new empty properties  
✅ Import completes without errors  
✅ Sync populates new fields correctly  
✅ Round-trip verification shows data consistency  
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

The document type field is named `Type` in most databases but `Doc Type` in Agent Scope Database. This will be manually renamed to `Type` for consistency.

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

Already standardized as `Type` in most databases:

- Rename `Doc Type` to `Type` in Agent Scope Database (manual)
- No other changes needed

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

## New Clean Relationship Properties

### Problem

Current relationship properties like `Sections & Primary Docs` in Articles database include all descendants, not just direct children. (This may be the only affected relationship)

### Solution

Create new relationship properties that only contain direct child pages:

| Database             | Old Relationship Property | New Relationship Property |
| -------------------- | ------------------------- | ------------------------- |
| Articles             | `Sections & Primary Docs` | `Sections`                |
| (other affected DBs) | (to be identified)        | (to be created)           |

### Mapping

New relationship properties will map to existing Supabase child ID columns:

- No schema changes needed
- Example: `Direct Sections & Primary Docs` → `child_section_and_primary_doc_ids`

## Migration Strategy

### Phase 1: Add New Properties (Non-Destructive)

**Notion Changes:**

1. Add `Document Number` (rich_text) property to all 10 Atlas databases
2. Add `Document Title` (rich_text) property to all 10 Atlas databases
3. Add new clean relationship properties (direct children only)
4. Rename `Doc Type` to `Type` in Agent Scope Database

**Important:**

- New properties start empty
- Old properties remain untouched
- No production data is affected

### Phase 2: Update Markdown to Notion Sync

**Code Changes:**

1. Update sync to write to new standardized fields:
   - Write `Document Number` instead of database-specific doc number fields
   - Write `Document Title` instead of database-specific name fields
2. Update sync to write to new clean relationship properties (**DEFERRED** - depends on creating new relationship properties in Notion first)
3. Remove `sibling_order_changed` change type

**Files Updated:**

- `app/atlas/sync/_lib/notion-property-builder.ts` - Now writes to standardized fields
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

1. Mark old properties as deprecated (rename with `[DEPRECATED]` prefix)
2. Eventually remove old properties from Notion databases

**Documentation Updates:**

- Update `NOTION_PROPERTY_MAPPING.md`
- Update `NOTION_IMPORT_PROCESS.md`
- Update `MARKDOWN_TO_NOTION_SYNC.md`
- Update `.cursorrules`

## Ordering Simplification

### Current State

- `DEFAULT_SORT_CRITERIA`: `['sort_order', 'atlas_document_number_sortable', 'notion_page_id']`
- `ATLAS_DATABASE_SORT_CRITERIA_OVERRIDES`: Database-specific overrides
- `No.` property in Sections & Primary Docs for manual ordering
- `compareDocNumbers()` function in `app/server/atlas/document-numbering/atlas-utils.ts` for natural sorting

### New State

- Single ordering strategy: Sort by `Document Number` using natural ordering
- Remove `No.` and other sort order fields
- Remove `ATLAS_DATABASE_SORT_CRITERIA_OVERRIDES`
- Simplify `DEFAULT_SORT_CRITERIA`

### Notion Formula for Natural Sorting

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

### Markdown to Notion Sync Simplification

Remove `sibling_order_changed` change type entirely:

- Syncing Document Number is sufficient for correct ordering
- Ordering happens automatically in Notion (via formula), Supabase (via sort), and exports

## Code Changes Summary

### Files to Update

| File                                                                              | Changes                                                                      |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `app/server/atlas/notion-mapping/notion-database-properties-and-relationships.ts` | Add new standardized property mappings, dual-read logic, eventually simplify |
| `app/server/services/supabase/load-notion-database-pages-from-supabase.ts`        | Simplify sorting to use Document Number only                                 |
| `app/server/services/notion/convert-notion-pages-to-supabase-format.ts`           | Add dual-read logic for old/new fields                                       |
| `app/server/services/notion/import-database-to-supabase.ts`                       | Update to use new relationship properties                                    |
| `app/atlas/sync/_lib/*`                                                           | Write to new fields, remove sibling order logic                              |
| `app/atlas/sync/_actions/*`                                                       | Update server actions                                                        |
| `app/atlas/sync/AGENTS.md`                                                        | Remove sibling_order_changed documentation                                   |
| `app/server/atlas/notion-tree/atlas-tree-helpers.ts`                              | Simplify `getDocumentTitle()` once titles are standardized                   |

### Code to Remove (Phase 7)

- `ATLAS_DATABASE_SORT_CRITERIA_OVERRIDES` constant
- Most entries in `NOTION_PROPERTY_TYPE_OVERRIDES`
- `sibling_order_changed` change type and related code
- `getLastTitlePart()` function (if titles are simplified)
- Complex property name lookups in mapping logic

## Performance Impact

### Import Performance

- **Before**: ~15 minutes for full import (~6000 pages)
- **After**: ~5 minutes (estimated 3x improvement)
- **Reason**: Clean relationships eliminate pagination for bloated relation properties

### Change Detection

- Faster comparison (fewer relationships to compare)
- Simpler logic (no sibling order tracking)

### Markdown to Notion Sync

- Simpler change detection (4 change types instead of 5)
- Faster relationship updates (direct children only)

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
2. All relationship properties contain only direct children
3. Markdown to Notion sync works correctly with new fields
4. Notion to Supabase import reads from new fields only
5. Import time reduced by ~3x
6. Ordering is consistent across Notion, Supabase, and Markdown exports
7. `sibling_order_changed` code removed from sync workflow
8. Old properties deprecated and eventually removed

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
