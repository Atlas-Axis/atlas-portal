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
│   (10 databases, ~7000 pages)       │
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
│  4. BUILD NOTION TREE               │
│     - Apply nesting bug fixes       │◄── NOTION_NESTING_BUG_FIX.md (Step 2)
│     - Nest root agent documents     │◄── nest-root-agent-documents-under-agent-section.ts (Step 2b)
│     - Flat pages → tree hierarchy   │◄── ATLAS_TREE_STRUCTURES.md, app/server/atlas/notion-tree/AGENTS.md
│     - Filter direct children        │
│     - Detect duplicates/cycles      │
│     - Identify orphaned nodes       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  5. PROCESS TREE                    │
│     - Generate doc numbers          │◄── ATLAS_DOCUMENT_NUMBERING_RULES.md (Step 8)
│     - Map Notion UUID → Atlas UUID  │◄── UUID_MAPPING.md (Step 9)
│     - Update mention doc numbers    │◄── (Step 10)
│     - Normalize doc names           │◄── (Step 4)
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  6. EXPORT TRANSFORMATION           │
│     - Notion Tree → Export Tree     │◄── ATLAS_TREE_STRUCTURES.md
│     - Rich Text → Markdown          │
│     - Rewrite link labels           │
│     - Handle extra fields           │◄── ATLAS_EXTRA_FIELDS.md
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  7. EXPORT FORMATS                  │
│     - Atlas Portal                  │
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
│  3. TRANSFORM TO NOTION FORMAT      │
│     - Export Tree → Notion Tree     │◄── export-tree-to-notion-tree.ts
│     - Unnest root agent documents   │◄── unnest-root-agent-documents.ts
│     - Reverse nesting overrides     │◄── reverse-nesting-overrides.ts
│     - Markdown → Rich Text          │◄── markdown-to-rich-text.ts
│     - Atlas UUID → Notion UUID      │◄── UUID_MAPPING.md
│     - Rewrite mention UUIDs         │
│     - Build properties/relations    │◄── notion-property-builder.ts
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  4. SYNC TO NOTION VIA NOTION API   │
│     - Detect changes                │◄── detect-markdown-changes.ts
│     - Create new pages              │◄── create-notion-pages.ts
│     - Update existing pages         │◄── update-notion-pages.ts
│     - Delete/archive pages          │◄── delete-notion-pages.ts
│     - Batch with rate limiting      │
└──────────────┬──────────────────────┘
               │
               ▼
┌───────────────────────────────────────────────┐
│  5. AUTO-SYNC TO SUPABASE                     │
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
- Processes ~7000 pages across all databases
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
- Simplifies tree building steps

**Current vs Historical Data:**

- Default: Load current data (`date_valid_to IS NULL`)
- Historical: Load data valid at specific past timestamp
- Supports changelog generation and time-travel queries

**References:**

- `app/server/services/supabase/load-atlas-from-supabase.ts`
- `app/server/services/supabase/load-notion-database-pages-from-supabase.ts`
- **[NOTION_IMPORT_PROCESS.md](./NOTION_IMPORT_PROCESS.md)** - See Step 3 (Load Existing Pages from Supabase)

### 3.4 Tree Construction

Flat Notion database pages are transformed into hierarchical tree structures representing the Atlas document hierarchy. This process includes applying workarounds for data modeling limitations and platform bugs as part of the tree building steps.

**Building Notion Tree:**

- Converts flat `NotionDatabasePage[]` array into nested `NotionAtlasTreeNode` trees
- Root nodes: Scope documents
- Child relationships embedded as typed arrays (not ID references)
- Process steps: Apply nesting overrides (Step 2) → Nest root agents (Step 2b) → Create lookup maps (Step 3) → Generate normalized document names (Step 4) → Find roots (Step 5) → Build trees recursively (Step 6) → Find orphaned nodes (Step 7) → Assign document numbers (Step 8) → Generate UUID maps (Step 9) → Update mentions (Step 10) → Generate duplicated nodes list (Step 11)

**Nesting Bug Fix (Step 2):**

- **Issue**: Notion's sub-item feature fails at deep nesting levels (database limitation after 10+ levels)
- **Solution**: Manual parent-child mappings stored in `notion_nesting_bug_mapping` table
- Mappings override incorrect Notion relationships during tree building
- Optional sibling positioning for precise document order
- Applied to flat array of all pages in a single pass inside `buildNotionAtlasTree()`
- Affects: Sections & Primary Docs, Agent Scope Database (internally nested databases)
- See **[NOTION_NESTING_BUG_FIX.md](./NOTION_NESTING_BUG_FIX.md)** for complete documentation

**Agent Document Nesting (Step 2b):**

- **Issue**: Root-level Agent Scope Database documents have no parent in Notion, but should be nested under section documents from Sections & Primary Docs for display
- **Solution**: Artificially nest them under designated Agent section (`AGENT_ROOT_SECTION_UUID_FOR_NESTING`)
- **Rationale**: Matches Atlas Portal UI display, provides proper hierarchy context
- Root Agent documents are those with `parent_notion_page_id === null` (no internal parent within Agent Scope Database)
- These IDs are added to the section's `child_agent_scope_ids` array inside `buildNotionAtlasTree()`

**Special Handling for parent_notion_page_id in Atlas databases that support internal nesting:**

- For Agent Scope Database and Sections & Primary Docs, `filterDirectChildren` treats null `parent_notion_page_id` as "no internal parent"
- This works because nesting overrides (Step 2) already fix any incorrect relationships from Notion's deep nesting bugs

**Lookup Maps for O(1) Access (Step 3):**

- `nodeMapByPageId`: Page ID → tree node
- `originalPageMap`: Page ID → original page
- `parentIdMap`: Child ID → parent ID
- `childrenIdsMap`: Page ID → child IDs array
- `processedIds`: Set of successfully processed page IDs
- `nodeToParentsMap`: Node ID → parent IDs (for duplicate tracking)
- Enables efficient tree construction without repeated searches

**Filtering Direct Children (Step 6):**

- **Critical Issue**: Some `child_*_ids` arrays contain ALL descendants, not just direct children
- Example: Section's `child_section_and_primary_doc_ids` includes deeply nested Core documents
- **Solution**: `filterDirectChildren` removes non-direct descendants using `parent_notion_page_id`
- Cross-database child: Keep only if `parent_notion_page_id` is null
- Same-database child: Keep only if `parent_notion_page_id === parentPageId`
- Special handling for Agent Scope Database: If `parent_notion_page_id` is still null after computation, treat as direct child

**Duplicate Handling (Step 6):**

- Duplicates are now allowed to exist in the tree data structure (temporarily - this will be reverted once we fix the last remaining duplication in Notion)
- No longer returns stub nodes for duplicate documents
- Documents can appear in multiple locations naturally (e.g., Needed Research)
- The `nodeToParentsMap` still tracks all parent relationships for reporting purposes

**Circular Reference Detection (Step 6):**

- Detects documents that exceed maximum tree depth (default: 50)
- Prevents infinite recursion during tree traversal
- Throws error when depth limit exceeded

**Orphaned Node Identification (Step 7):**

- Finds documents not connected to any root scope tree
- Uses `processedIds` Set from lookup maps to accurately determine orphaned status
- May indicate missing relationships or data quality issues
- Returned separately for manual review

**References:**

- `app/server/atlas/notion-tree/atlas-tree-builder.ts` (contains all steps 1-11)
- `app/server/atlas/nest-root-agent-documents-under-agent-section.ts` (Step 2b helper)
- `app/server/services/notion/apply-nesting-overrides.ts` (Step 2 helper)
- `app/server/atlas/notion-mapping/notion-ids.ts` (AGENT_ROOT_SECTION_UUID_FOR_NESTING)
- `app/server/atlas/notion-tree/AGENTS.md` (comprehensive API documentation)
- **[ATLAS_TREE_STRUCTURES.md](./ATLAS_TREE_STRUCTURES.md)**
- **[NOTION_NESTING_BUG_FIX.md](./NOTION_NESTING_BUG_FIX.md)**

### 3.5 Tree Processing

The constructed Notion Tree undergoes several processing steps to generate metadata and correct inconsistencies. These steps are all part of `buildNotionAtlasTree()`.

**Document Name Normalization (Step 4):**

- Extract clean document names from Notion titles
- Sections & Primary Docs: Extract text after final `" - "` separator
- Other databases: Use full title
- Example: `"A.1.6 - Facilitators - Budgets"` → `"Budgets"`

**Document Number Generation (Step 8):**

- Hierarchical numbering assigned via pre-order tree traversal
- Follows Atlas Document Numbering Rules conventions
- Examples: Scopes (`A.0`), Articles (`A.0.1`), Sections (`A.0.1.1`), Annotations (`A.0.1.0.3.1`)
- Special handling: Supporting documents use directory numbers, Needed Research uses global counter
- See **[ATLAS_DOCUMENT_NUMBERING_RULES.md](./ATLAS_DOCUMENT_NUMBERING_RULES.md)** for complete rules

**UUID Mapping: Notion Page UUID → Atlas Document UUID (Step 9):**

- Load bidirectional UUID mappings once at start
- For each node, look up Atlas UUID from Notion page UUID
- Generate two maps: `atlasUUIDsToGeneratedDocNumbers`, `atlasUUIDsToDocNames`
- These maps used for mention updates and exports
- See **[UUID_MAPPING.md](./UUID_MAPPING.md)** for complete documentation

**Rich Text Mention Updates (Step 10):**

- Problem: Notion mention `plain_text` contains outdated document numbers
- Solution: Update `plain_text` to current document number + name
- Process: Extract page ID from mention → Look up Atlas UUID → Get current doc number → Update text
- Format: `"{doc_no} - {doc_name}"` (e.g., `"A.1.3 - General Provisions"`)
- Missing mappings handled gracefully with `"[Unknown]"` placeholder

**References:**

- `app/server/atlas/notion-tree/atlas-tree-builder.ts` (orchestrates all steps)
- `app/server/atlas/notion-tree/atlas-tree-numbering.ts` (Step 8 implementation)
- `app/server/atlas/notion-tree/atlas-tree-mentions.ts` (Step 10 implementation)
- `app/server/atlas/notion-tree/atlas-tree-helpers.ts` (Step 4 implementation)
- **[UUID_MAPPING.md](./UUID_MAPPING.md)**
- **[ATLAS_DOCUMENT_NUMBERING_RULES.md](./ATLAS_DOCUMENT_NUMBERING_RULES.md)**

### 3.6 Export Transformation

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

### 3.7 Export Formats

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

The Notion sync process involves multiple transformation steps that reverse the forward pipeline transformations, converting the Export Tree back into Notion's internal format and structure.

#### 4.3.1 Export Tree → Notion Tree Conversion

The first step converts the Export Tree (external format) back to Notion Tree (internal format) with all Notion-specific metadata.

**Markdown → Rich Text Conversion:**

- Reverse of `rich-text-to-markdown.ts` transformation
- Convert markdown strings back to Notion Rich Text API format (`TextRichTextItemRequest[]`)
- Handle formatting: bold (`**text**` → bold annotation), italic (`*text*` → italic annotation), code (`` `text` `` → code annotation)
- Convert markdown links to Notion mention objects
- Convert LaTeX equations to Notion equation objects
- Preserve line breaks and paragraph structure
- Use existing `markdown-to-rich-text.ts` with Atlas UUID mention conversion
- Reference property type overrides from `NOTION_PROPERTY_TYPE_OVERRIDES` (default type is Rich Text)

**Atlas UUID → Notion UUID Mapping:**

- Query `uuid_mapping` table for bidirectional mapping: `atlas_document_uuid` ↔ `notion_page_id`
- Apply Notion page UUIDs to all document references and relationships
- Handle missing mappings:
  - New documents (no mapping exists): Will receive Notion page UUID when created via API
  - Save new mappings to Supabase after successful creation
- Use existing helper functions to load UUID mappings efficiently

**Reconstruct Notion-Specific Fields:**

- Regenerate `parent_notion_page_id` for internally nested databases (Sections & Primary Docs, Agent Scope Database)
- Build `child_*_ids` arrays from Export Tree children:
  - `child_article_ids`, `child_section_and_primary_doc_ids`, `child_annotation_ids`, etc.
  - Note: Some arrays may contain all descendants (not just direct children) to match Notion's behavior
  - Further research needed to confirm exact semantics for each relationship type
- Map extra fields back to appropriate Notion properties:
  - Type Specifications: 6 extra fields (Components, Doc Identifier Rules, etc.)
  - Scenarios: 3 extra fields (Description, Finding, Additional Guidance)
  - Scenario Variations: 3 extra fields (same as Scenarios)
  - Needed Research: 1 extra field (Content)
  - Reference property type overrides from `NOTION_PROPERTY_TYPE_OVERRIDES`

**Document Name Reconstruction:**

- Format: `"{Name}"` (e.g., `"Primitive Hub Document"`)

Sections & Primary Docs database pages have different title formatting:

- Format: `"{DocNo} - {Name}"` (e.g., `"A.1.1.1 - Universal Alignment And The Spirit Of The Atlas"`)
- Simplified from original complex format (e.g., `"A.1.1 - A1 - Spirit Of The Atlas - Universal Alignment And The Spirit Of The Atlas"`)
- Apply only to Sections & Primary Docs database pages (property: "Doc No (or Temp Name)")
- Research needed to confirm if other databases require similar title formatting
- The final specification of the format is still not finalized, it may be that we will not include the document number at all, or that the formatting will be different

**References:**

- `app/server/atlas/export/export-tree-to-notion-tree.ts` (to be created)
- `app/server/markdown/markdown-to-rich-text.ts` (extend for UUID conversion)
- `app/server/atlas/notion-mapping/notion-database-properties-and-relationships.ts`
- **[ATLAS_EXTRA_FIELDS.md](./ATLAS_EXTRA_FIELDS.md)**
- **[ATLAS_TREE_STRUCTURES.md](./ATLAS_TREE_STRUCTURES.md)**
- **[UUID_MAPPING.md](./UUID_MAPPING.md)**

#### 4.3.2 Unnest Root Agent Documents

This step reverses the artificial nesting of root Agent Scope Database documents, restoring their original Notion structure before sync.

**Process:**

- Identify artificially nested agent documents: those appearing under `AGENT_ROOT_SECTION_UUID_FOR_NESTING` in the Export Tree
- Remove these agent document IDs from the section's `child_agent_scope_ids` array
- Set their `parent_notion_page_id` to `null` (indicating root-level documents in Agent Scope Database)
- This restores the original Notion structure where Agent Scope Database is standalone without parent relationships (an existing issue in Notion)

**Why This is Necessary:**

- The nesting of agents under a section is a fix for missing relationships in Notion so that the Atlas Portal UI and markdown exports have the correct document hierarchy
- Notion databases don't have this cross-database parent-child relationship (this is an issue that we will have to fix)
- Agent Scope Database documents are root-level in Notion (no inherent parent) (this is an issue that we will have to fix)
- Must remove artificial nesting before syncing to Notion to maintain original Notion structure

**Implementation:**

- Create reverse function `unnestRootAgentDocuments()` that:
  - Takes Notion Tree with artificially nested agents
  - Identifies agents under `AGENT_ROOT_SECTION_UUID_FOR_NESTING`
  - Removes them from section's child array
  - Sets `parent_notion_page_id` to `null` (it was already null, but just to make sure)
  - Returns updated Notion Tree ready for sync

**References:**

- `app/server/atlas/unnest-root-agent-documents.ts` (to be created)
- `app/server/atlas/nest-root-agent-documents-under-agent-section.ts` (forward direction reference)
- `app/server/atlas/notion-mapping/notion-ids.ts` (AGENT_ROOT_SECTION_UUID_FOR_NESTING constant)

#### 4.3.3 Reverse Nesting Overrides

This step applies nesting bug fix mappings in reverse, moving children back to their original (incorrect) Notion parent locations to maintain compatibility with the platform's limitations.

**Process:**

- Load manual mappings from `notion_nesting_bug_mapping` table
- Apply mappings in **reverse direction** to restore original Notion relationships
- For each mapping `{ child, correctParent, incorrectNotionParent, sibling }`:
  - Remove child from correct parent's child array (where it appears in Export Tree)
  - Add child back to incorrect parent's child array (where it exists in Notion)
  - Update child's `parent_notion_page_id` to match incorrect Notion parent
  - Maintain sibling positioning if specified
- Affects databases: Sections & Primary Docs, Agent Scope Database (internally nested databases)

**Why This is Necessary:**

- Notion's sub-item feature fails at deep nesting levels (platform limitation after 10+ levels)
- Documents remain in incorrect parent locations in Notion due to this bug
- Nesting override mappings correct this for display/export (forward direction)
- Must reverse these corrections before syncing to maintain consistency with Notion's buggy state
- Changing Notion structure directly would break future import syncs

**Implementation:**

- Create new function `reverseNestingOverrides()` that:
  - Takes Notion Tree with corrected relationships
  - Loads mappings from `notion_nesting_bug_mapping` table
  - For each mapping, moves child from correct parent back to incorrect parent
  - Updates `parent_notion_page_id` to incorrect parent
  - Handles sibling positioning in reverse
  - Returns Notion Tree with original (buggy) Notion relationships restored

**References:**

- `app/server/services/notion/reverse-nesting-overrides.ts` (to be created)
- `app/server/services/notion/apply-nesting-overrides.ts` (forward direction reference)
- **[NOTION_NESTING_BUG_FIX.md](./NOTION_NESTING_BUG_FIX.md)**

#### 4.3.4 Mention UUID Rewrite

This step converts markdown links with Atlas UUIDs back to Notion mention objects with Notion page UUIDs.

**Process:**

- Scan Rich Text content for markdown links with Atlas UUID format: `[text](uuid:atlas-uuid-here)`
- For each Atlas UUID link:
  - Look up corresponding Notion page UUID in `uuid_mapping` table's preloaded lookup map
  - Convert markdown link to Notion mention object and rewrite Atlas UUID to Notion UUID
  - Handle missing mappings (document may not exist in Notion yet)
- Notion mentions auto-generate their own `plain_text` field, so we don't need to provide doc numbers

**Mention Format Conversion:**

- Input (Markdown): `[A.1.3 - General Provisions](550e8400-e29b-41d4-a716-446655440000)`
- Output (Notion API):
  ```json
  {
    "type": "mention",
    "mention": {
      "type": "page",
      "page": { "id": "12345678-1234-1234-1234-123456789abc" }
    }
  }
  ```

**Error Handling:**

- Missing UUID mappings: Log warning, keep original markdown link or replace with placeholder
- Invalid UUID format: Log error, keep original text
- Notion API errors: Handled at sync layer

**References:**

- `app/server/markdown/markdown-to-rich-text.ts` (extend with UUID conversion logic)
- `app/server/atlas/notion-tree/atlas-tree-mentions.ts` (forward direction reference - Step 10)
- **[UUID_MAPPING.md](./UUID_MAPPING.md)**

**Edge Cases:**

It may be that a new document links to another new document which doesn't have an ID in Notion yet.
We should handle this case in a robust way, e.g. in two rounds: First create the page content without the mention objects, then update those Notion blocks with the proper mention objects once all new pages have been created

#### 4.3.5 Property and Relationship Mapping

This step builds Notion API property objects using reverse mappings from the Export Tree structure.

**Property Building:**

- Use `notion-database-properties-and-relationships.ts` for database-specific property mappings
- Map Export Tree fields → Notion property names:
  - `documentName` → property name from `atlasDocumentName` mapping
  - `documentNumber` → property name from `atlasDocumentNo` mapping
  - `documentType` → property name from `atlasDocumentType` mapping
  - `content` → property name from `content` mapping
- Build typed property objects for Notion API:
  - **Title properties**: `{ title: [{ type: 'text', text: { content: '...' } }] }`
  - **Rich text properties**: `{ rich_text: [{ type: 'text', text: { content: '...' }, annotations: {...} }] }`
  - **Select properties**: `{ select: { id: 'option-id' } }` or `{ select: { name: 'option-name' } }` (values must exist already in Notion and be selectable)
  - **Number properties**: `{ number: 123.45 }`
  - **Relation properties**: `{ relation: [{ id: 'page-uuid-1' }, { id: 'page-uuid-2' }] }`
- Handle database-specific property names:
  - Sections & Primary Docs: "Doc No (or Temp Name)" for title
  - Other databases: Semi-Standard property names (e.g., "Name", "Doc No"), based on mapping

**Relationship Building:**

- Convert Export Tree child arrays → Notion relation properties
- Use `childRelationships` mappings from property configuration:
  - `child_articles` → "Articles" relation property
  - `child_section_and_primary_doc_ids` → "Subdocs" relation property
  - `child_agent_scope_ids` → "Sub-item" relation property
  - `child_annotation_ids` → "Annotations" relation property
  - etc.
- Build Same-Database bidirectional relationships for Sections & Primary Docs database and Agent Scope Database:
  - Update parent's child relation property (e.g., "Subdocs")
  - Update child's parent relation property (e.g., "Parent Doc")
- Convert Atlas UUIDs → Notion page UUIDs for all relationships (if not done already in a previous step)

**Parent Property Handling (CRITICAL):**

- Always use `parent` property with database ID, not page ID: `{ type: 'database_id', database_id: 'db-uuid' }`
- **NEVER** use `parent.page_id` for database pages (this is not how Notion databases work)
- Internal hierarchy managed exclusively through relation properties (e.g., "Parent Doc", "Subdocs")
- This is fundamental to Notion's database architecture

**References:**

- `app/server/atlas/notion-mapping/notion-property-builder.ts` (to be created)
- `app/server/atlas/notion-mapping/notion-database-properties-and-relationships.ts`

#### 4.3.6 Create/Update/Delete Operations

This step performs the actual synchronization with Notion via API calls, handling creation, updates, and deletions.

**Change Detection:**

- Compare Export Tree against current Supabase data (most recent `notion_database_pages`)
- Identify changes using Atlas UUIDs as stable identifiers:
  - **New documents**: Atlas UUID exists in markdown but no UUID mapping in `uuid_mapping` table
  - **Modified documents**: Atlas UUID exists in both, but content/properties/relationships differ
  - **Deleted documents**: Atlas UUID exists in Supabase but not in markdown Export Tree
- Generate change sets with detailed diff information
- Validate changes before any API calls (dry-run capability)

**Creating New Pages:**

- For each new document in hierarchical order (parents before children):
  - Build complete property object using property mappings
  - Set parent to appropriate database ID: `{ parent: { type: 'database_id', database_id: 'db-uuid' } }`
  - Call Notion API: `POST /pages`
  - Extract new Notion page UUID from response
  - Create UUID mapping entry: `{ atlas_document_uuid, notion_page_id }`
  - Store mapping in Supabase `uuid_mapping` table
- Handle dependencies: Create parent documents before children to enable proper relationship establishment
- Make sure that newly created Notion database page IDs are available during the sync if they are referenced in other documents that are also synced
- Don't batch operations for more reliable error handling in case of error, and better audit log of Notion API calls to change Notion content

**Updating Existing Pages:**

- For each modified document:
  - Look up Notion page UUID from Atlas UUID via `uuid_mapping` table
  - Build property update object containing only changed fields
  - Call Notion API: `PATCH /pages/{page_id}` with properties object
  - Update relationships separately if changed:
    - Update parent's child relation properties
    - Update child's parent relation properties
  - Handle retry logic with exponential backoff (already exists in our Notion client class)
- Only update fields that changed (efficient delta sync)

**Deleting Pages:**

- For each deleted document:
  - Look up Notion page UUID from Atlas UUID
  - If the page has child documents, prevent deletion to avoid implicit cascading effect or orphaned pages in Notion (use an efficient lookup map to store Notion page IDs and whether they have child documents)
  - Set `archived: true` in Notion via API
  - Call Notion API: `PATCH /pages/{page_id}` with `{ archived: true }`
  - Delete UUID mapping in Supabase
- Start from leaf nodes to avoid cascading effects, then traverse up the tree as parent nodes become leaf nodes after their child nodes are deleted

**Progress Tracking:**

- Progress tracking: Log completion percentage and estimated time remaining
- Transaction-like behavior: Validate all changes before applying (prevent partial corruption)
- If interrupted, show a modal to the user and when they confirm, reload the page to reload the remaining syncable changes - keep it simple

**Error Handling:**

- Validate markdown structure before any API calls
- Dry-run mode to preview all changes without applying
- Rollback strategy for partial failures (attempt to restore previous state) - optional if adds too much complexity
- Detailed error logs with line numbers and actionable suggestions
- Partial success tracking: Store successfully synced documents to avoid re-processing (?)

**References:**

- `app/server/atlas/sync/sync-to-notion.ts` (to be created - main orchestrator)
- `app/server/atlas/sync/create-notion-pages.ts` (to be created)
- `app/server/atlas/sync/update-notion-pages.ts` (to be created)
- `app/server/atlas/sync/delete-notion-pages.ts` (to be created)
- `app/server/atlas/sync/detect-markdown-changes.ts` (to be created)
- `app/atlas/sync/_lib/` (sync utilities)

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

| Stage                               | Input Format            | Transformation                                                                              | Output Format                             |
| ----------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **1. Notion API Fetch**             | Notion pages (API JSON) | Property mapping, relationship extraction                                                   | `NotionDatabasePage[]` arrays             |
| **2. Supabase Storage**             | `NotionDatabasePage[]`  | Versioned insert, UUID generation                                                           | Supabase `notion_database_pages` rows     |
| **3. Supabase Load**                | Supabase rows           | Load all databases, filter current                                                          | `NotionDatabasePage[]` (flat array)       |
| **4. Tree Building**                | Flat pages              | Apply nesting overrides, nest root agents, hierarchy construction, filtering, validation    | `NotionAtlasTreeNode[]` (Notion Tree)     |
| **5. Tree Processing**              | Notion Tree nodes       | Name normalization, doc numbering, UUID mapping, mention updates (all inside tree building) | Enhanced `NotionAtlasTreeNode[]`          |
| **6. Export Transform**             | Notion Tree             | Rich Text → Markdown, UUID conversion                                                       | `ExportAtlasTreeDocument[]` (Export Tree) |
| **7. Serialization**                | Export Tree             | JSON/Markdown formatting                                                                    | `atlas.md`, `atlas.json`, `atlas.yaml`    |
| **[PLANNED] 8. Markdown Parse**     | Atlas markdown file     | Parse structure, extract metadata, validate                                                 | Export Tree                               |
| **[PLANNED] 9. Export→Notion Tree** | Export Tree             | Markdown→Rich Text, Atlas UUID→Notion UUID, reconstruct Notion fields                       | Notion Tree (internal format)             |
| **[PLANNED] 10. Unnest Agents**     | Notion Tree             | Remove artificial agent nesting, restore root-level structure                               | Updated Notion Tree                       |
| **[PLANNED] 11. Reverse Overrides** | Notion Tree             | Apply nesting bug mappings in reverse, restore original Notion positions                    | Notion Tree (buggy positions)             |
| **[PLANNED] 12. Rewrite Mentions**  | Notion Tree             | Convert Atlas UUID mentions to Notion UUID mentions                                         | Notion Tree (ready for API)               |
| **[PLANNED] 13. Build Properties**  | Notion Tree             | Map to Notion property objects, build relations, title reconstruction                       | Notion API property objects               |
| **[PLANNED] 14. Sync to Notion**    | Property objects        | Detect changes, create/update/delete pages, batch operations                                | Notion pages (via API)                    |

## Workarounds and Special Cases

### Agent Document Nesting

**Rationale:**

- Agent Scope Database is a standalone database with no inherent parent
- Atlas Portal UI displays agents nested under specific section for context; Markdown Atlas file does the same
- This relationship doesn't exist in Notion but is needed for proper display

**Implementation:**

- Hardcoded section UUID: `AGENT_ROOT_SECTION_UUID_FOR_NESTING`
- Root agent documents are those with `parent_notion_page_id === null` (no internal parent within Agent Scope Database)
- Their IDs are added to section's `child_agent_scope_ids` array in-memory
- Applied inside `buildNotionAtlasTree()` (Step 2b), after nesting overrides (Step 2)
- This ensures agents re-parented by mappings are not incorrectly treated as root agents

**References:**

- `app/server/atlas/nest-root-agent-documents-under-agent-section.ts` (Step 2b helper function)
- `app/server/atlas/notion-tree/atlas-tree-builder.ts` (orchestrates Steps 2 and 2b)
- `app/server/atlas/notion-mapping/notion-ids.ts` (AGENT_ROOT_SECTION_UUID_FOR_NESTING constant)

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

- Load mappings from database (Step 1 of `buildNotionAtlasTree()`)
- Apply mappings to flat Notion page array (Step 2 of `buildNotionAtlasTree()`)
- Remove child from incorrect parent's array
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
