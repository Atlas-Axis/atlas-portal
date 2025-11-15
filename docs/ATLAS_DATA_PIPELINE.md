# Atlas Data Pipeline

## Overview

The Atlas data pipeline is a comprehensive system that manages the complete lifecycle of Atlas legal documents, from their source in Notion databases through structured storage in Supabase to final export as markdown and JSON formats. The pipeline supports bidirectional synchronization, enabling both Notion-first and markdown-first editing workflows.

**Two Main Workflows:**

1. **Notion → Supabase → Markdown**: Import Atlas documents from Notion databases, store them in Supabase with full version history, build hierarchical tree structures, and export to markdown/JSON formats
2. **Markdown → Notion** [PLANNED]: Parse externally-edited Atlas markdown file, validate them, and sync changes back to Notion databases

The pipeline handles complex transformations, relationship mappings, workarounds for platform limitations, and ensures data consistency across all systems.

## Complete Pipeline Flowchart

```
┌─────────────────────────────────────────────────────────────────────┐
│                     NOTION → SUPABASE → MARKDOWN                    │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────┐
│   Notion Master Atlas Databases     │
│   (10 databases, ~6000 pages)       │
└──────────────┬──────────────────────┘
               │
               │ [Hourly sync via Trigger.dev, ~15 min]
               │
               ▼
┌─────────────────────────────────────┐
│  1. FETCH VIA NOTION API            │◄── NOTION_IMPORT_PROCESS.md
│     - Property mapping              │◄── notion-database-properties-and-relationships.ts
│     - Relationship mapping          │
│     - Change detection              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  2. STORE IN SUPABASE               │
│     - Versioned rows (temporal)     │
│     - UUID generation (new pages)   │◄── UUID_MAPPING.md
│     - Batched inserts               │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  3. LOAD FROM SUPABASE              │
│     - Load all pages (flat array)   │◄── load-atlas-from-supabase.ts
│     - Current/historical data       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  4. PRE-PROCESS (WORKAROUNDS)       │
│     - Agent nesting rewrite         │◄── nest-root-agent-documents-under-agent-section.ts
│     - Nesting bug fixes             │◄── NOTION_NESTING_BUG_FIX.md
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  5. BUILD NOTION TREE               │
│     - Flat pages → tree hierarchy   │◄── ATLAS_TREE_STRUCTURES.md, app/server/atlas/notion-tree/AGENTS.md
│     - Filter direct children        │
│     - Detect duplicates/cycles      │
│     - Identify orphaned nodes       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  6. PROCESS TREE                    │
│     - Generate doc numbers          │◄── ATLAS_DOCUMENT_NUMBERING_RULES.md
│     - Map Notion UUID → Atlas UUID  │◄── UUID_MAPPING.md
│     - Update mention doc numbers    │
│     - Normalize doc names           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  7. EXPORT TRANSFORMATION           │
│     - Notion Tree → Export Tree     │◄── ATLAS_TREE_STRUCTURES.md
│     - Rich Text → Markdown          │
│     - Rewrite link labels           │
│     - Handle extra fields           │◄── ATLAS_EXTRA_FIELDS.md
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  8. EXPORT FORMATS                  │
│     - atlas.md (Markdown)           │◄── ATLAS_MARKDOWN_IMPORT_EXPORT.md
│     - atlas.json (JSON)             │
│     - atlas.yaml (YAML)             │
│     - API endpoints                 │
└─────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────┐
│                     MARKDOWN → NOTION [PLANNED]                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────┐
│   External Atlas Markdown File      │
│   (GitHub central repository)       │
└──────────────┬──────────────────────┘
               │
               │ [Edited by org members]
               │
               ▼
┌─────────────────────────────────────┐
│  1. VALIDATE MARKDOWN               │
│     - Syntax validation             │◄── validate-atlas-markdown.ts
│     - Structure verification        │◄── ATLAS_MARKDOWN_SYNTAX.md
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  2. PARSE TO EXPORT TREE            │
│     - Document hierarchy            │◄── ATLAS_MARKDOWN_IMPORT_EXPORT.md
│     - Extract UUIDs                 │
│     - Parse extra fields            │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  3. SYNC TO NOTION VIA NOTION API   │
│     - Convert to Notion pages       │◄── app/atlas/sync/
│     - Build properties/relations    │
│     - Create/update/delete pages    │
└──────────────┬──────────────────────┘
               │
               ▼
┌───────────────────────────────────────────────┐
│  4. AUTO-SYNC TO SUPABASE                     │
│     - Hourly Trigger.dev task                 │
│     - Returns to step 1 above (Notion import) │
└───────────────────────────────────────────────┘
```

## Notion → Supabase → Markdown Pipeline

### 3.1 Import from Notion

The pipeline begins by fetching all Atlas documents from 10 Notion databases using the Notion API.

**Automation:**

- Runs hourly via Trigger.dev background task
- Takes approximately 15 minutes to complete full sync
- Processes ~6000 pages across all databases
- Handles errors, retries, backoff strategy, transactions, recovery

**Property and Relationship Mapping:**

- Notion properties (title, rich_text, select, number) mapped to Supabase columns
- Child relationships extracted from Notion relation properties
- Both in-database (Parent Doc/Subdocs) and inter-database (Articles, Annotations, etc.) relationships preserved
- See `notion-database-properties-and-relationships.ts` for complete mapping configuration

**Sync Locking:**

- Prevents concurrent syncs of the same database
- Lock expires after 30 minutes for automatic recovery
- Verified before each sync operation begins, per Notion database

**Change Detection:**

- Compares fetched pages against existing Supabase data
- Detects new pages, deleted pages, property changes, relationship changes
- Only modified data is updated (efficient delta sync)

**References:**

- `app/server/services/notion/import-database-to-supabase.ts`
- `app/server/atlas/notion-mapping/notion-database-properties-and-relationships.ts`
- **[NOTION_IMPORT_PROCESS.md](./NOTION_IMPORT_PROCESS.md)** - Detailed 10-step import workflow documentation

### 3.2 Storage in Supabase

Atlas documents are stored in PostgreSQL via Supabase with full version history and bidirectional UUID mappings.

**Versioned Row Storage (Temporal Tables):**

- `date_valid_from` and `date_valid_to` (UTC timestamps) track row validity periods
- Current rows have `date_valid_to IS NULL`
- Historical queries possible by filtering on validity timestamps
- Updates create new rows rather than modifying existing ones
- `notion_database_pages_current` Postgres view provides easy access to current versions

**UUID Mapping Generation:**

- For each new Notion page, a unique Atlas document UUID is generated
- Mapping stored in `uuid_mapping` table: `notion_page_id ↔ atlas_document_uuid`
- Enables stable document references independent of Notion infrastructure
- See **[UUID_MAPPING.md](./UUID_MAPPING.md)** for complete documentation

**Batched Operations:**

- Pages inserted/updated in batches of 500 for performance
- UUID mappings inserted in batches of 500
- Reduces database round-trips significantly

**References:**

- `app/server/services/supabase/insert-pages-in-batches.ts`
- **[UUID_MAPPING.md](./UUID_MAPPING.md)**
- **[NOTION_IMPORT_PROCESS.md](./NOTION_IMPORT_PROCESS.md)** - See Step 8 (Batch Insert/Update) and Step 9 (Generate UUID Mappings)

### 3.3 Loading from Supabase

Atlas documents are loaded from Supabase as a flat array of all pages from all databases.

**Flat Array Loading:**

- Pages loaded from all databases in a single query
- Returns structure: `NotionDatabasePage[]` (flat array)
- More efficient than per-database queries
- Simplifies pre-processing steps

**Current vs Historical Data:**

- Default: Load current data (`date_valid_to IS NULL`)
- Historical: Load data valid at specific past timestamp
- Supports changelog generation and time-travel queries

**References:**

- `app/server/services/supabase/load-atlas-from-supabase.ts`
- `app/server/services/supabase/load-notion-database-pages-from-supabase.ts`
- **[NOTION_IMPORT_PROCESS.md](./NOTION_IMPORT_PROCESS.md)** - See Step 3 (Load Existing Pages from Supabase)

### 3.4 Pre-Processing Workarounds

Before tree construction, several workarounds are applied to correct data modeling limitations and platform bugs. These steps are now performed inside `buildNotionAtlasTree()` in the correct order.

**Nesting Bug Fix (Step 2):**

- **Issue**: Notion's sub-item feature fails at deep nesting levels (database limitation after 10+ levels)
- **Solution**: Manual parent-child mappings stored in `notion_nesting_bug_mapping` table
- Mappings override incorrect Notion relationships during tree building
- Optional sibling positioning for precise document order
- Applied to flat array of all pages in a single pass
- Affects: Sections & Primary Docs, Agent Scope Database (internally nested databases)
- See **[NOTION_NESTING_BUG_FIX.md](./NOTION_NESTING_BUG_FIX.md)** for complete documentation

**Agent Document Nesting (Step 2b):**

- **Issue**: Root-level Agent Scope Database documents have no parent in Notion, but should be nested under section documents from Sections & Primary Docs for display
- **Solution**: Artificially nest them under designated Agent section (`AGENT_ROOT_SECTION_UUID_FOR_NESTING`)
- **Rationale**: Matches Atlas Explorer UI display, provides proper hierarchy context
- Root Agent documents are those with `parent_notion_page_id === null` (no internal parent within Agent Scope Database)
- These IDs are added to the section's `child_agent_scope_ids` array

**Special Handling for parent_notion_page_id in Atlas databases that support internal nesting:**

- For Agent Scope Database and Sections & Primary Docs, `filterDirectChildren` treats null `parent_notion_page_id` as "no internal parent"
- This works because nesting overrides (Step 2) already fix any incorrect relationships from Notion's deep nesting bugs

**References:**

- `app/server/atlas/notion-tree/atlas-tree-builder.ts` (Steps 2, 2b, filterDirectChildren)
- `app/server/atlas/nest-root-agent-documents-under-agent-section.ts`
- `app/server/services/notion/apply-nesting-overrides.ts`
- `app/server/atlas/notion-mapping/notion-ids.ts` (AGENT_ROOT_SECTION_UUID_FOR_NESTING)
- **[NOTION_NESTING_BUG_FIX.md](./NOTION_NESTING_BUG_FIX.md)**

### 3.5 Tree Construction

Flat Notion database pages are transformed into hierarchical tree structures representing the Atlas document hierarchy.

**Building Notion Tree:**

- Converts flat `NotionDatabasePage[]` array into nested `NotionAtlasTreeNode` trees
- Root nodes: Scope documents (identified by absence of parent relationships)
- Child relationships embedded as typed arrays (not ID references)
- Process steps: Apply nesting overrides → Nest root agents → Create lookup maps → Find roots → Build trees recursively → Find orphaned nodes

**Lookup Maps for O(1) Access:**

- `nodeMapByPageId`: Page ID → tree node
- `originalPageMap`: Page ID → original page
- `parentIdMap`: Child ID → parent ID
- `childrenIdsMap`: Page ID → child IDs array
- `processedIds`: Set of successfully processed page IDs
- `nodeToParentsMap`: Node ID → parent IDs (for duplicate tracking)
- Enables efficient tree construction without repeated searches

**Filtering Direct Children:**

- **Critical Issue**: Some `child_*_ids` arrays contain ALL descendants, not just direct children
- Example: Section's `child_section_and_primary_doc_ids` includes deeply nested Core documents
- **Solution**: `filterDirectChildren` removes non-direct descendants using `parent_notion_page_id`
- Cross-database child: Keep only if `parent_notion_page_id` is null
- Same-database child: Keep only if `parent_notion_page_id === parentPageId`
- Special handling for Agent Scope Database: If `parent_notion_page_id` is still null after computation, treat as direct child

**Duplicate Handling:**

- Duplicates are now allowed to exist in the tree data structure (temporarily - this will be reverted once we fix the last remaining duplication in Notion)
- No longer returns stub nodes for duplicate documents
- Documents can appear in multiple locations naturally (e.g., Needed Research)
- The `nodeToParentsMap` still tracks all parent relationships for reporting purposes

**Circular Reference Detection:**

- Detects documents that exceed maximum tree depth (default: 50)
- Prevents infinite recursion during tree traversal
- Throws error when depth limit exceeded

**Orphaned Node Identification:**

- Finds documents not connected to any root scope tree
- Uses `processedIds` Set from lookup maps to accurately determine orphaned status
- May indicate missing relationships or data quality issues
- Returned separately for manual review

**References:**

- `app/server/atlas/notion-tree/atlas-tree-builder.ts`
- `app/server/atlas/notion-tree/AGENTS.md`
- **[ATLAS_TREE_STRUCTURES.md](./ATLAS_TREE_STRUCTURES.md)**

### 3.6 Tree Processing

The constructed Notion Tree undergoes several processing steps to generate metadata and correct inconsistencies.

**Document Number Generation:**

- Hierarchical numbering assigned via pre-order tree traversal
- Follows Atlas Document Numbering Rules conventions
- Examples: Scopes (`A.0`), Articles (`A.0.1`), Sections (`A.0.1.1`), Annotations (`A.0.1.0.3.1`)
- Special handling: Supporting documents use directory numbers, Needed Research uses global counter
- See **[ATLAS_DOCUMENT_NUMBERING_RULES.md](./ATLAS_DOCUMENT_NUMBERING_RULES.md)** for complete rules

**UUID Mapping: Notion Page UUID → Atlas Document UUID:**

- Load bidirectional UUID mappings once at start
- For each node, look up Atlas UUID from Notion page UUID
- Generate two maps: `atlasUUIDsToGeneratedDocNumbers`, `atlasUUIDsToDocNames`
- These maps used for mention updates and exports
- See **[UUID_MAPPING.md](./UUID_MAPPING.md)** for complete documentation

**Rich Text Mention Updates:**

- Problem: Notion mention `plain_text` contains outdated document numbers
- Solution: Update `plain_text` to current document number + name
- Process: Extract page ID from mention → Look up Atlas UUID → Get current doc number → Update text
- Format: `"{doc_no} - {doc_name}"` (e.g., `"A.1.3 - General Provisions"`)
- Missing mappings handled gracefully with `"[Unknown]"` placeholder

**Document Name Normalization:**

- Extract clean document names from Notion titles
- Sections & Primary Docs: Extract text after final `" - "` separator
- Other databases: Use full title
- Example: `"A.1.6 - Facilitators - Budgets"` → `"Budgets"`

**References:**

- `app/server/atlas/notion-tree/atlas-tree-numbering.ts`
- `app/server/atlas/notion-tree/atlas-tree-mentions.ts`
- `app/server/atlas/notion-tree/atlas-tree-helpers.ts`
- **[UUID_MAPPING.md](./UUID_MAPPING.md)**
- **[ATLAS_DOCUMENT_NUMBERING_RULES.md](./ATLAS_DOCUMENT_NUMBERING_RULES.md)**

### 3.7 Export Transformation

The Notion Tree is converted to Export Tree format for external consumption, with Rich Text content transformed to markdown.

**Notion Tree → Export Tree Conversion:**

- Notion Tree: Internal representation with all metadata, Notion page UUIDs, Rich Text JSON
- Export Tree: Minimal external representation with Atlas UUIDs, markdown strings
- Recursive transformation preserving hierarchical structure
- Child arrays renamed from camelCase to underscore_case
- See **[ATLAS_TREE_STRUCTURES.md](./ATLAS_TREE_STRUCTURES.md)** for detailed comparison

**Rich Text to Markdown Conversion:**

- `json_content` (Notion Rich Text API format) → `content` (markdown string)
- Notion formatting (bold, italic, code, links) → Markdown syntax
- Notion mentions → Markdown links with Atlas UUIDs
- Notion equations → LaTeX in markdown
- Line breaks and paragraph structure preserved

**Link Label Rewriting:**

- Notion links reference pages by ID with potentially stale display text
- Rewritten to use current document numbers and names
- Cross-references remain accurate as documents are renumbered

**Extra Fields Handling:**

- Type Specifications: 6 extra fields (Components, Doc Identifier Rules, etc.)
- Scenarios: 3 extra fields (Description, Finding, Additional Guidance)
- Scenario Variations: 3 extra fields (same as Scenarios)
- Needed Research: 1 extra field (Content)
- All converted from Rich Text to markdown strings
- See **[ATLAS_EXTRA_FIELDS.md](./ATLAS_EXTRA_FIELDS.md)** for complete documentation

**References:**

- `app/server/atlas/export/notion-tree-to-export-tree.ts`
- `app/server/markdown/rich-text-to-markdown.ts`
- **[ATLAS_TREE_STRUCTURES.md](./ATLAS_TREE_STRUCTURES.md)**
- **[ATLAS_EXTRA_FIELDS.md](./ATLAS_EXTRA_FIELDS.md)**

### 3.8 Export Formats

The Export Tree is serialized to multiple formats for different consumption needs.

**Markdown Export:**

- Complete Atlas exported as single markdown file (`atlas.md`)
- Optional: Separate files per scope
- Heading levels capped at 6 (markdown limitation)
- Document numbers preserve full hierarchy beyond depth 6
- Format: `# {DocNo} - {Name} [{Type}]  <!-- UUID: {uuid} -->`
- See **[ATLAS_MARKDOWN_SYNTAX.md](./ATLAS_MARKDOWN_SYNTAX.md)** for syntax specification

**JSON Export:**

- Complete Export Tree serialized as JSON (`atlas.json`)
- Preserves full hierarchical structure
- Suitable for programmatic consumption and external integrations

**YAML Export:**

- JSON converted to YAML format (`atlas.yaml`)
- More human-readable than JSON
- Useful for configuration-style consumption

**API Endpoints and Public Pages:**

- `/atlas` page - Interactive Atlas UI rendering from Export Tree
- `/api/atlas.md` - Serves markdown format
- `/api/atlas.json` - Serves JSON format
- `/api/atlas.yaml` - Serves YAML format

**References:**

- `scripts/atlas-export/generate-atlas-markdown.ts`
- `scripts/atlas-export/generate-atlas-json.ts`
- `app/server/atlas/export/atlas-markdown-exporter.ts`
- `app/server/atlas/export/atlas-json-exporter.ts`
- **[ATLAS_MARKDOWN_IMPORT_EXPORT.md](./ATLAS_MARKDOWN_IMPORT_EXPORT.md)**
- **[ATLAS_MARKDOWN_SYNTAX.md](./ATLAS_MARKDOWN_SYNTAX.md)**

## Markdown → Notion Pipeline [PLANNED]

This workflow enables external editing of the Atlas in markdown format with subsequent synchronization back to Notion databases.

### 4.1 External Markdown Editing

**Central GitHub Repository Workflow:**

- Organization maintains canonical Atlas markdown file in GitHub repository
- Multiple team members can edit using markdown-first approach
- Standard Git workflow: branches, pull requests, reviews
- Changes tracked via Git version control

**Markdown-First Editing:**

- Team members who prefer markdown over Notion can contribute
- External actors without Notion access can make changes directly
- Easier bulk editing and refactoring than Notion UI
- Better suited for technical documentation workflows

**Validation Before Import:**

- Atlas markdown validated using `scripts/validate-atlas-markdown.ts`
- Checks: title format, heading levels, document numbers, UUIDs, relationships
- Prevents corrupt data from entering Notion
- CI/CD integration runs automated validation in Pull Requests (defined in an external Git repository)

**References:**

- `scripts/validate-atlas-markdown.ts`
- **[ATLAS_MARKDOWN_SYNTAX.md](./ATLAS_MARKDOWN_SYNTAX.md)**

### 4.2 Markdown Import

**Parsing Atlas Markdown to Export Tree:**

- Line-by-line parsing identifies document boundaries
- Document numbers used to calculate parent-child relationships
- UUIDs extracted from comment tags
- Extra fields parsed from dedicated sections
- Result: Export Tree structure matching JSON export format

**Validation and Error Detection:**

- Structural validation (heading progression, nesting rules)
- UUID uniqueness checks
- Document number pattern validation
- Parent-child relationship verification
- Errors reported with line numbers and actionable suggestion for easy correction

**References:**

- `app/server/atlas/export/atlas-markdown-importer.ts`
- **[ATLAS_MARKDOWN_IMPORT_EXPORT.md](./ATLAS_MARKDOWN_IMPORT_EXPORT.md)**

### 4.3 Notion Sync

**Converting Export Tree to Notion Pages:**

- Export Tree documents mapped to Notion database pages
- Markdown content converted back to Notion Rich Text format
- Atlas UUIDs mapped to Notion page UUIDs (via uuid_mapping table)
- New documents get new Notion pages created

**Creating/Updating/Deleting Pages:**

- New documents: Create Notion pages via API
- Changed documents: Update existing Notion pages
- Deleted documents: Archive or delete Notion pages
- Relationship properties updated to match Export Tree structure

**Relationship Establishment:**

- Parent-child relationships set via Notion relation properties
- Cross-database relationships (Articles, Annotations, etc.) configured
- Internal nesting (Parent Doc/Subdocs) established
- Relationship property names from `notion-database-properties-and-relationships.ts`

**Property Building with Correct Types:**

- Title properties use `title` type
- Rich text properties use `rich_text` type
- Select properties use `select` type with option IDs
- Number properties use `number` type
- Relationship properties use `relation` type with page ID arrays

**References:**

- `app/atlas/sync/_lib/` (sync implementation)
- `app/server/markdown/markdown-to-rich-text.ts`
- `app/server/atlas/notion-mapping/notion-property-builder.ts`

### 4.4 Automated Sync

**Hourly Trigger.dev Task:**

- After markdown changes synced to Notion, hourly import task picks them up
- Task runs Notion → Supabase sync (section 3.1)
- Changes flow back into Supabase and become visible in exports
- Complete round-trip: Markdown → Notion → Supabase → Markdown

**Future Enhancements:**

- Trigger sync immediately after markdown changes (webhook-based)
- Reduce latency from hours to minutes
- Real-time collaboration between Notion-first and markdown-first users

**References:**

- `app/server/services/trigger/notion-sync-task.ts`

## Key Transformations Summary

| Stage                           | Input Format            | Transformation                                             | Output Format                                |
| ------------------------------- | ----------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| **1. Notion API Fetch**         | Notion pages (API JSON) | Property mapping, relationship extraction                  | `NotionDatabasePage[]` arrays                |
| **2. Supabase Storage**         | `NotionDatabasePage[]`  | Versioned insert, UUID generation                          | Supabase `notion_database_pages` rows        |
| **3. Supabase Load**            | Supabase rows           | Load all databases, filter current                         | `NotionDatabasePage[]` (flat array)          |
| **4. Pre-Processing**           | Flat array              | Nesting overrides, Agent parent computation, Agent nesting | Modified `NotionDatabasePage[]` (flat array) |
| **5. Tree Building**            | Flat pages              | Hierarchy construction, filtering, validation              | `NotionAtlasTreeNode[]` (Notion Tree)        |
| **6. Tree Processing**          | Notion Tree nodes       | Doc numbering, UUID mapping, mention updates               | Enhanced `NotionAtlasTreeNode[]`             |
| **7. Export Transform**         | Notion Tree             | Rich Text → Markdown, UUID conversion                      | `ExportAtlasTreeDocument[]` (Export Tree)    |
| **8. Serialization**            | Export Tree             | JSON/Markdown formatting                                   | `atlas.md`, `atlas.json`, `atlas.yaml`       |
| **[PLANNED] 9. Markdown Parse** | Atlas markdown file     | Parse structure, extract metadata                          | Export Tree                                  |
| **[PLANNED] 10. Notion Sync**   | Export Tree             | Markdown → Rich Text, property building                    | Notion pages (via API)                       |

## Workarounds and Special Cases

### Agent Document Nesting

**Rationale:**

- Agent Scope Database is a standalone database with no inherent parent
- Atlas Explorer UI displays agents nested under specific section for context; Markdown Atlas file does the same
- This relationship doesn't exist in Notion but is needed for proper display

**Implementation:**

- Hardcoded section UUID: `AGENT_ROOT_SECTION_UUID_FOR_NESTING`
- Root agent documents are those with `parent_notion_page_id === null` (no internal parent within Agent Scope Database)
- Their IDs are added to section's `child_agent_scope_ids` array in-memory
- Applied inside `buildNotionAtlasTree()` (Step 2b), after nesting overrides
- This ensures agents re-parented by mappings are not incorrectly treated as root agents

**References:**

- `app/server/atlas/nest-root-agent-documents-under-agent-section.ts`
- `app/server/atlas/notion-tree/atlas-tree-builder.ts` (Step 2b)
- `app/server/atlas/notion-mapping/notion-ids.ts`

### Notion Nesting Bug and Manual Mappings

**Problem:**

- Notion's sub-item feature (Parent Doc/Subdocs, Parent item/Sub-item) fails at deep nesting levels
- Deeply nested documents cannot have correct parent set via Notion UI
- Results in incorrect hierarchy during import

**Solution:**

- Manual mappings stored in `notion_nesting_bug_mapping` table
- UI at `/atlas/notion-nesting-fix` for managing mappings
- Fields: child UUID, parent UUID, optional sibling positioning
- Mappings applied during tree construction, overriding Notion relationships

**Process:**

- Load mappings from database
- During tree building, remove child from incorrect parent's array
- Add child to correct parent's array at specified position
- Original Supabase data unchanged (in-memory modification only)

**Affected Databases:**

- Sections & Primary Docs (internal nesting via Parent Doc/Subdocs)
- Agent Scope Database (internal nesting via Parent item/Sub-item)

**References:**

- **[NOTION_NESTING_BUG_FIX.md](./NOTION_NESTING_BUG_FIX.md)**
- `app/server/services/notion/apply-nesting-overrides.ts`
- `app/atlas/notion-nesting-fix/` (UI)

### Direct Children Filtering for Deeply Nested Documents

**Problem:**

- Some Notion relationship properties contain ALL descendants, not just direct children
- Example: Section's `child_section_and_primary_doc_ids` includes Section → Core → Core → Core
- Without filtering, deeply nested documents appear under both parent and grandparent

**Solution - Generalized Direct-Child Rules:**

- **Cross-database parent → child in internally nested DB**: Keep only if child's `parent_notion_page_id` is null
- **Same internally nested database**: Keep only if child's `parent_notion_page_id` equals parent's page ID
- Applies to all document types in Sections & Primary Docs and Agent Scope Database

**Implementation:**

- `filterDirectChildren` function receives parent page ID
- Checks `parent_notion_page_id` field to determine if child is direct
- Non-direct children removed from child array
- Ensures each document appears only under its immediate parent

**References:**

- `app/server/atlas/notion-tree/atlas-tree-builder.ts` (filterDirectChildren)
- README.md (Critical Edge Cases: Child Relationship Arrays)

### Duplicate Handling Policies

As of November 2025, duplicates are allowed to exist naturally in the tree data structure (temporarily - this will be reverted once we fix the last remaining duplication in Notion):

**Current Approach:**

- **Policy**: Duplicates are no longer prevented during tree construction
- **Rationale**: Some documents legitimately appear in multiple locations (e.g., Needed Research can be attached to multiple parents)
- **Implementation**: Removed stub node logic from `buildTreeNode()`; duplicates flow naturally into the tree
- **Tracking**: The `nodeToParentsMap` still tracks all parent relationships for reporting purposes

**Historical Context:**

Previously, the system tried to prevent duplicates by returning stub nodes when a duplicate was detected. This caused issues:

- False positive duplicate warnings for Agent Scope Database documents
- Orphaned node detection incorrectly flagged legitimate documents
- Made it difficult to handle documents that should naturally appear in multiple places

The new approach recognizes that duplicates in the tree are acceptable and sometimes expected, allowing the data structure to reflect the actual relationships in Notion.

**References:**

- `app/server/atlas/notion-tree/atlas-tree-builder.ts`
- `docs/ACTION_PLAN_FIX_AGENT_DUPLICATE_DETECTION.md` (completed action plan)

## Related Documentation

### Core System Documentation

- **[ATLAS_TREE_STRUCTURES.md](./ATLAS_TREE_STRUCTURES.md)** - Comprehensive guide to dual tree architecture (Notion Tree vs Export Tree), conversion process, and data structure differences
- **[UUID_MAPPING.md](./UUID_MAPPING.md)** - Bidirectional UUID mapping system between Notion page UUIDs and Atlas document UUIDs, enabling stable references and markdown-first workflows
- **[ATLAS_DOCUMENT_NUMBERING_RULES.md](./ATLAS_DOCUMENT_NUMBERING_RULES.md)** - Complete hierarchical document numbering system with rules for all document types and special cases
- **[NOTION_IMPORT_PROCESS.md](./NOTION_IMPORT_PROCESS.md)** - Detailed 10-step Notion to Supabase import workflow with property mapping, change detection, sync locking, and batching

### Atlas Data Formats

- **[ATLAS_MARKDOWN_SYNTAX.md](./ATLAS_MARKDOWN_SYNTAX.md)** - Complete markdown syntax specification for Atlas documents including title format, content structure, and extra fields
- **[ATLAS_MARKDOWN_IMPORT_EXPORT.md](./ATLAS_MARKDOWN_IMPORT_EXPORT.md)** - Import/export workflows, validation, round-trip guarantees, and markdown-JSON conversion
- **[ATLAS_EXTRA_FIELDS.md](./ATLAS_EXTRA_FIELDS.md)** - Extra fields for Type Specifications, Scenarios, Scenario Variations, and Needed Research documents

### Workarounds and Special Cases

- **[NOTION_NESTING_BUG_FIX.md](./NOTION_NESTING_BUG_FIX.md)** - Manual workaround for Notion's sub-item relationship bug at deep nesting levels, including UI and storage
- **[NOTION_EMBEDS.md](./NOTION_EMBEDS.md)** - Compatibility guide for embedded iframes across Notion platforms (web vs native apps)

### Component Documentation

- **[app/server/atlas/notion-tree/AGENTS.md](../app/server/atlas/notion-tree/AGENTS.md)** - Atlas tree system algorithms, traversal, document numbering, mention updates, and comprehensive API reference
- **[app/atlas/sync/README.md](../app/atlas/sync/README.md)** - Markdown to Notion synchronization workflow [PLANNED]

### Other Documentation

- **[ATLAS_DIFFING.md](./ATLAS_DIFFING.md)** - Tree diffing algorithms and change detection for Atlas documents (used for Edit Pages)
- **[EDIT_PAGE_GENERATION_USAGE.md](./EDIT_PAGE_GENERATION_USAGE.md)** - Guide for creating and managing Edit Pages in Notion
- **[ACTION_PLAN_FIX_AGENT_DUPLICATE_DETECTION.md](./ACTION_PLAN_FIX_AGENT_DUPLICATE_DETECTION.md)** - Action plan for fixing agent duplicate detection issues

### Core Project Documentation

- **[README.md](../README.md)** - Human-readable project documentation with tech stack, database schema, and getting started guide
- **[.cursorrules](../.cursorrules)** - AI agent documentation for Cursor IDE
