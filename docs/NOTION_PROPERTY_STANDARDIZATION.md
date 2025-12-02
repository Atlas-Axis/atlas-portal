# Notion Property Standardization Action Plan

## Overview

This document outlines the plan to standardize Notion database properties across all Atlas databases. The goal is to simplify the Notion-Supabase mapping, reduce complexity in the codebase, and improve performance of the import and sync workflows.

**Related Documentation:**

- [NOTION_PROPERTY_MAPPING.md](./NOTION_PROPERTY_MAPPING.md) - Current property mapping reference
- [NOTION_IMPORT_PROCESS.md](./NOTION_IMPORT_PROCESS.md) - Notion to Supabase import workflow
- [MARKDOWN_TO_NOTION_SYNC.md](./MARKDOWN_TO_NOTION_SYNC.md) - Markdown to Notion sync workflow

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
2. Update sync to write to new clean relationship properties
3. Remove `sibling_order_changed` change type and all related code/docs
   - No longer needed since Document Number handles ordering automatically

**Files to Update:**

- `app/atlas/sync/_lib/` - Sync logic
- `app/atlas/sync/_actions/` - Server actions
- `app/atlas/sync/AGENTS.md` - Documentation

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

### Phase 6: Deprecate Old Fields

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
- `compareDocNumbers()` function for natural sorting

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

### Code to Remove (Phase 6)

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

## Timeline

| Phase | Description                    | Duration  |
| ----- | ------------------------------ | --------- |
| 1     | Add new properties to Notion   | 1-2 hours |
| 2     | Update Markdown to Notion sync | 2-4 hours |
| 3     | Update import for dual-read    | 2-3 hours |
| 4     | Run initial sync               | 1-2 hours |
| 5     | Verify round-trip              | 2-4 hours |
| 6     | Deprecate old fields           | 2-4 hours |

**Total estimated time**: 10-19 hours

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
