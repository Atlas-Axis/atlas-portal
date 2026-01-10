# Clean Relationship Properties for Articles Database

**Status**: Separate effort - tracked independently from property standardization migration

**Related**: This was originally part of the Notion Property Standardization Action Plan but has been moved to a separate effort to keep the main migration focused.

## Problem

Current relationship properties like `Sections & Primary Docs` in Articles database include all descendants, not just direct children. This may be the only affected relationship.

**Example**: Article `A.2.4 Sky Primitives` has 640 relationships to `Sections & Primary Docs`

- Should only have ~20 direct children
- Currently includes all deeply nested descendants

**Impact:**

- Notion to Supabase import is ~3x slower than necessary because of this one relationship
- Relationship fetching requires pagination for truncated relations (>25 items)
- Notion API responses are very slow for property pagination
- It takes 9 minutes out of the 15 minutes just to paginate this one relationship between Articles and Sections & Primary Docs
- Change detection and diffing is slower
- Markdown to Notion sync has unnecessary complexity

## Solution

Create new relationship properties that only contain direct child pages:

| Database             | Old Relationship Property | New Relationship Property |
| -------------------- | ------------------------- | ------------------------- |
| Articles             | `Sections & Primary Docs` | `Sections`                |
| (other affected DBs) | (to be identified)        | (to be created)           |

### Mapping

New relationship properties will map to existing Supabase child ID columns:

- No schema changes needed
- Example: New `Sections` property → `child_section_and_primary_doc_ids` (existing column)

## Implementation Steps

### Step 1: Create New Relationship Property in Notion

1. Open Articles database in Notion
2. Add new relationship property: `Sections`
3. Configure to link to `Sections & Primary Docs` database
4. Leave empty initially (will be populated by sync)

### Step 2: Update Markdown to Notion Sync

**Files to Update:**

- `app/atlas/sync/_lib/notion-property-builder.ts`
  - Add logic to write to new `Sections` property
  - Map from `child_section_and_primary_doc_ids` (direct children only)

- `app/server/atlas/notion-mapping/notion-database-properties-and-relationships.ts`
  - Add mapping for new `Sections` property

### Step 3: Update Notion to Supabase Import

**Files to Update:**

- `app/server/services/notion/import-database-to-supabase.ts`
  - Update to read from new `Sections` property
  - Fall back to old property if new one is empty (dual-read during transition)

- `app/server/atlas/notion-mapping/notion-database-properties-and-relationships.ts`
  - Update relationship mapping to prefer new property

### Step 4: Run Initial Sync

1. Run Markdown to Notion sync to populate new `Sections` property
2. Verify that only direct children are included (not all descendants)
3. Spot check a few articles with many sections

### Step 5: Verify Performance Improvement

1. Run Notion to Supabase import
2. Measure import time - should be ~3x faster
3. Verify that pagination is no longer needed for Articles → Sections relationship

### Step 6: Deprecate Old Property

1. Mark old `Sections & Primary Docs` property as deprecated in Articles database
2. Rename to `[DEPRECATED] Sections & Primary Docs`
3. Eventually delete after verification period

## Expected Performance Impact

- **Before**: ~15 minutes for full import (~6000 pages)
- **After**: ~5 minutes (estimated 3x improvement)
- **Reason**: Eliminate pagination for bloated relation property

## Success Criteria

- [ ] New `Sections` property created in Articles database
- [ ] Sync writes to new property (direct children only)
- [ ] Import reads from new property
- [ ] Import time reduced by ~3x
- [ ] No pagination needed for Articles → Sections relationship
- [ ] Old property marked as deprecated
- [ ] Eventually: Old property deleted after verification period
