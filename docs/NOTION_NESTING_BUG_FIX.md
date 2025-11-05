# Notion Nesting Bug Fix

## Overview

This feature provides a manual workaround for a Notion bug that prevents creating "Sub-item" relationships beyond a certain nesting depth in databases. When this bug occurs, deeply nested documents cannot be properly linked to their parent documents in Notion, resulting in incorrect hierarchy during imports.

## The Problem

Notion's sub-item feature (see [Notion docs](https://www.notion.com/help/tasks-and-dependencies)) allows creating parent-child relationships within the same database. However, there's a known bug where this functionality fails at deep nesting levels, making it impossible to set the correct parent for deeply nested documents.

This affects:

- **Sections & Primary Docs** database (internal nesting via "Parent Doc" / "Subdocs" relationships)
- **Agent Scope Database** (internal nesting via "Parent item" / "Sub-item" relationships)

## The Solution

This system allows users to manually define correct parent-child relationships through a UI, storing these mappings in Supabase. During Notion imports, these mappings override the incorrect relationships from Notion.

## How It Works

### 1. ID Mapping Storage

Mappings are stored in the `notion_nesting_bug_mapping` table:

- `child_notion_page_id`: UUID of the child document
- `parent_notion_page_id`: UUID of the correct parent document
- `atlas_database_name`: Which Atlas database this mapping applies to

### 2. User Interface

Navigate to `/atlas/notion-nesting-fix` to:

- View existing mappings grouped by database
- Add new mappings by entering child and parent UUIDs
- See document names automatically (looked up from Supabase)
- Delete incorrect mappings
- Save all changes

**Validation includes:**

- UUID format checking
- Circular dependency prevention (A→B→A)
- Empty field detection

### 3. Tree Building Integration

During Atlas tree building (`buildAtlasTree`):

1. Nesting mappings are loaded automatically from Supabase
2. `applyNestingOverrides()` processes each mapping in-memory:
   - Finds the child in the appropriate `child_*_ids` array
   - Removes it from the current (incorrect) parent
   - Adds it to the correct parent specified in the mapping
3. Tree is built using the corrected relationships
4. Original Supabase data remains unchanged

### 4. Affected Fields

Mappings modify these relationship arrays based on database:

- **Sections & Primary Docs** → `child_section_and_primary_doc_ids`
- **Agent Scope Database** → `child_agent_scope_ids`

## Usage Workflow

1. **Identify the Problem**: Notice a document appearing under the wrong parent in the Atlas tree
2. **Get UUIDs**: Find the child and correct parent Notion page UUIDs
3. **Create Mapping**: Navigate to `/atlas/notion-nesting-fix` and add the mapping
4. **Save**: Click "Save All Mappings"
5. **Re-build**: Trigger a page reload or Atlas tree rebuild to see corrected hierarchy
6. **Verify**: Check that the document now appears under the correct parent

## Technical Details

### Files

- **Migration**: `app/server/database/007_create_notion_nesting_bug_mapping_table.sql`
- **Service Layer**: `app/server/services/supabase/notion-nesting-bug-mappings.ts`
- **Override Logic**: `app/server/services/notion/apply-nesting-overrides.ts`
- **Integration**: `app/server/atlas/atlas-tree-builder.ts`
- **UI Components**: `app/atlas/notion-nesting-fix/page.tsx` and `content.tsx`
- **Server Action**: `app/atlas/notion-nesting-fix/_actions/nesting-fix-actions.ts`
- **Tests**: `app/server/services/notion/__tests__/apply-nesting-overrides.test.ts`

### Important Notes

- Mappings only apply to databases that support internal nesting (checked via `databaseSupportsInternalNesting()`)
- The override logic runs **every time** the Atlas tree is built
- Overrides are applied in-memory only - original Supabase data remains unchanged
- Mappings use a "delete all + insert" pattern when saving (simpler than diffing)
- Non-existent child or parent IDs are handled gracefully with warnings
- The system prevents duplicate child IDs in parent arrays

## Example Scenario

**Problem**: Core document "A.1.1.1.1.1.1.1" (deeply nested) appears at root level instead of under parent "A.1.1.1.1.1.1"

**Solution**:

1. Get child UUID: `123e4567-e89b-12d3-a456-426614174000`
2. Get parent UUID: `987fcdeb-51a2-43d7-8901-234567890abc`
3. Create mapping in UI with database = "Sections & Primary Docs"
4. Save and re-import
5. Child now appears under correct parent with relationship stored in `child_section_and_primary_doc_ids`
