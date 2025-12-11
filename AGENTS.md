# Core Project Documentation

# AI Agent Instructions

- If my prompt is ambiguous, please ask me clarifying questions to resolve any confusion. This will help prevent generating incorrect code, even if it means I'll need to put in extra effort to answer your questions.
- When you ask me questions, assign numbers to each question so I can answer them more easily
- When you finish a refactoring task, do a code review on the changes and fix major issues you may find
- Don't run Supabase migrations directly. Instead, update the related SQL file in the `database` folder. Also show me with the SQL command that I can copy and paste to migrate my live Supabase database afterwards.

# Project Overview

This Next.js application provides a complete data pipeline for managing the Atlas, which is a collection of internal rules and policies in the Sky crypto ecosystem. The **canonical Atlas** is stored as a Markdown file in a GitHub repository. **Notion is used as an editing and collaboration tool** where the Atlas is maintained across 10 databases (~7,000 documents) for easier editing by the team. The system enables bidirectional synchronization between the canonical GitHub Markdown, Notion (editing environment), and Supabase PostgreSQL (central storage layer).

**Key Capabilities:**

- **Notion → Supabase Import**: Hourly automated sync of Atlas documents from Notion editing environment to PostgreSQL with temporal versioning
- **Markdown → Notion Sync**: Bidirectional workflow that syncs changes from the canonical GitHub Markdown back to the Notion editing environment
- **Atlas Portal**: Interactive web viewer for browsing Atlas hierarchy with search and export capabilities
- **Export Generation**: Export the Atlas from Supabase to multiple file formats (Markdown, JSON, YAML) via web API or CLI
- **Historical Tracking**: Complete change history via temporal tables and audit logging
- **UUID Mapping**: Stable document references independent of Notion infrastructure

**Architecture**: The canonical Atlas lives in GitHub as Markdown. Notion serves as the editing/collaboration environment. Supabase acts as the central hub connecting these systems, enabling exports in multiple formats (Markdown, JSON, YAML). The system uses a dual-tree architecture (Notion Tree for internal storage, Export Tree for external formats) with UUID-based stable references.

# Tech Stack

## Framework & Runtime

- Next.js 16 with App Router, server-side rendering
- TypeScript with strict type-safety
- Node.js (v22)

## UI & Styling

- HeroUI (NextUI) - React component library
- Tailwind CSS
- Lucide React icons

## Database & Storage

- Supabase (PostgreSQL database) - Cloud-based in production; local development via `npm run supabase:start`
- PostgreSQL with public schema

## Background Jobs

- Trigger.dev - For background sync tasks (automated hourly imports, manual sync triggers)

## Development Tools

- ESLint, Prettier
- Husky (Git hooks)
- Vitest (Testing)

## Testing Guidance (Vitest)

- The project uses Vitest with `jsdom` and React Testing Library.
- Config: `vitest.config.ts` enables globals, automatic JSX via esbuild, and coverage via v8.
- Setup: `vitest.setup.ts` registers `@testing-library/jest-dom/vitest`.
- Path alias `@/*` is available in tests.
- Example tests:
  - Unit: `app/shared/utils/__tests__/utils.test.ts`
  - Component: `app/atlas/__tests__/type-chip.test.tsx`

Scripts:

```bash
npm test                 # watch mode (not CI-fiendly)
npm run test:run         # single run (CI-friendly)
npm run test:coverage    # coverage report (text, html, lcov)
npm run test:ui          # Vitest UI
# Run a single test file (CI-style single run)
npm run test:run -- app/shared/utils/__tests__/utils.test.ts
# Run a single test file in watch mode
npm test -- app/atlas/__tests__/type-chip.test.tsx
# Run a single test by name/pattern
npm run test:run -- app/atlas/__tests__/type-chip.test.tsx -t "renders the provided type text"
```

AI agent notes for generating tests:

- Prefer RTL patterns (`render`, `screen`); avoid testing implementation details.
- Use automatic JSX; do not add `import React` unless necessary.
- Default env is `jsdom`. For Node-only tests, add `// @vitest-environment node` to the top of the file.
- Mock Next.js routing when needed:
  ```ts
  vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
  ```
- Mock `fetch` or other globals with `vi.stubGlobal`.
- Keep tests colocated under `__tests__` or alongside files using `*.test.ts(x)` naming.

# Workflows

This section describes the main workflows and features available in the application. The Atlas data pipeline consists of several interconnected workflows that enable bidirectional synchronization between Notion, Supabase, and Markdown formats.

## 1. Notion → Supabase Import

**Status**: ✅ **Active** - Runs hourly via Trigger.dev

**Purpose**: Import Atlas documents from Notion databases to Supabase for storage and processing.

**Description**: Synchronizes approximately 7,000 Atlas documents from 10 Notion databases to PostgreSQL. Uses intelligent delta sync to detect changes (new/modified/deleted pages), relationship mapping, and temporal versioning for historical data tracking. Takes ~15 minutes for full sync. This captures edits made by the team in Notion and brings them into Supabase for export generation.

**Key Features**:

- Delta sync with change detection (new/deleted/modified pages)
- Property and relationship mapping via centralized configuration
- Sync locking to prevent concurrent operations
- Batched processing (500 pages per batch)
- UUID mapping generation for stable document references
- Temporal versioning (`date_valid_from`/`date_valid_to`)

**Access**:

- Automated: Runs hourly via Trigger.dev scheduled task
- Manual: Command-line script `scripts/import-notion-databases.ts`
- Partial: Triggered automatically after Markdown → Notion sync (only affected databases)

**Related Documentation**:

- **[docs/NOTION_IMPORT_PROCESS.md](../docs/NOTION_IMPORT_PROCESS.md)** - Complete import process documentation
- **[docs/ATLAS_DATA_PIPELINE.md](../docs/ATLAS_DATA_PIPELINE.md)** - Overall data pipeline architecture

## 2. Markdown → Notion Sync

**Status**: ✅ **Active** - Manual trigger via UI

**Purpose**: Synchronize changes from the canonical GitHub Markdown Atlas back to the Notion editing environment.

**Description**: Syncs changes from the canonical Atlas Markdown file (stored in GitHub repository) back to Notion databases. This enables external contributors to edit the canonical Markdown directly, with changes then flowing back to the Notion editing environment for the team to see. Automatically detects changes (new/modified/moved/deleted documents), handles mention conversion, and provides real-time progress tracking via Trigger.dev background task.

**Key Features**:

- Change detection (new, modified, moved, deleted documents)
- Mention post-processing (converts markdown links to Notion mentions)
- Background processing with real-time progress tracking
- Automatic round-trip: After syncing to Notion, automatically imports affected databases back to Supabase
- Audit logging of all Notion API operations
- UUID mapping for document references
- Graceful error handling and partial success tracking

**Access**:

- UI: `/atlas/sync` - Visual diff preview and sync controls
- Loads from: **Canonical GitHub Atlas** repository (`pppdns/next-gen-atlas`, branch `main`, file `Sky Atlas/Sky Atlas.md`)
- Local development: Automatically uses `exported-atlas/truncated-atlas.md` if present

**Related Documentation**:

- **[docs/MARKDOWN_TO_NOTION_SYNC.md](../docs/MARKDOWN_TO_NOTION_SYNC.md)** - High-level sync workflow
- **[app/atlas/sync/AGENTS.md](../app/atlas/sync/AGENTS.md)** - Detailed implementation guide
- **[docs/ATLAS_DATA_PIPELINE.md](../docs/ATLAS_DATA_PIPELINE.md)** - Complete pipeline architecture

## 3. Export the Atlas as a File

**Status**: ✅ **Active** - Manual and API-based

**Purpose**: Generate Atlas exports from Supabase data in Markdown, JSON, or YAML formats.

**Description**: Builds Export Tree structure from Supabase data (which mirrors the Notion editing environment) and exports to various formats. These exports can be used to update the canonical GitHub Markdown or for other purposes. The Export Tree uses stable Atlas UUIDs (not Notion page IDs) for document references, making exports independent of Notion infrastructure.

**Key Features**:

- Multiple export formats: Markdown, JSON, YAML
- Stable UUID-based document references
- Hierarchical tree structure preservation
- Web API access for programmatic exports from the Atlas Portal
- Command-line scripts for local development

**Access**:

- **Web API**:
  - `/api/atlas.md` - Markdown export
  - `/api/atlas.json` - JSON export
  - `/api/atlas.yaml` - YAML export
- **Command-line scripts**:
  - `npx tsx scripts/atlas-export/generate-atlas-markdown.ts` - Export to `exported-atlas/atlas.md`
  - `npx tsx scripts/atlas-export/generate-atlas-json.ts` - Export to `exported-atlas/atlas.json`
  - `npx tsx scripts/atlas-export/json-to-yaml.ts` - Convert JSON to YAML

**Related Documentation**:

- **[docs/ATLAS_MARKDOWN_SYNTAX.md](../docs/ATLAS_MARKDOWN_SYNTAX.md)** - Markdown format specification
- **[docs/ATLAS_MARKDOWN_IMPORT_EXPORT.md](../docs/ATLAS_MARKDOWN_IMPORT_EXPORT.md)** - Export/import workflows
- **[docs/ATLAS_TREE_STRUCTURES.md](../docs/ATLAS_TREE_STRUCTURES.md)** - Dual tree architecture (Notion Tree vs Export Tree)

## 4. Atlas Portal (Viewer)

**Status**: ✅ **Active** - Primary UI for Atlas browsing

**Purpose**: Read-only web interface for browsing the Atlas hierarchy stored in Supabase.

**Description**: Interactive viewer that displays the complete Atlas hierarchy with search functionality, document type filtering, and export capabilities. Loads data from Supabase (which mirrors the Notion editing environment) and converts to Export Tree format for display. Similar to the external Atlas Explorer (https://sky-atlas.io) but uses internal Supabase data that reflects the current state of Notion.

**Key Features**:

- Hierarchical tree view of all Atlas documents
- Search across all document names and numbers
- Document type filtering and color-coding
- Download Atlas as file (Markdown, JSON, YAML)
- Mobile-responsive design
- Real-time search with keyboard navigation

**Access**:

- UI: `/atlas` - Main Atlas viewer page
- Statically pre-rendered for fast page loads
- Automatically revalidated after Notion imports

**Related Documentation**:

- **[docs/ATLAS_TREE_STRUCTURES.md](../docs/ATLAS_TREE_STRUCTURES.md)** - Tree architecture and data structures
- **[app/server/atlas/notion-tree/AGENTS.md](../app/server/atlas/notion-tree/AGENTS.md)** - Tree building algorithms

## 5. Atlas Changelog

**Status**: ✅ **Active** - Historical data viewer

**Purpose**: View historical changes to Atlas documents over time. Data comes from Supabase.

**Access**:

- UI: `/atlas/changelog` - Web-based changelog viewer
- Command-line: `npx tsx scripts/atlas-changelog.ts --since 1d` - CLI changelog report

## 6. Notion Nesting Bug Management

**Status**: ✅ **Active** - Workaround management UI

**Purpose**: Manage manual parent-child relationship corrections for Notion's sub-item relationship bug at deep nesting levels.

**Access**:

- UI: `/atlas/notion-nesting-fix` - Password-protected management interface

**Related Documentation**:

- **[docs/NOTION_NESTING_BUG_FIX.md](../docs/NOTION_NESTING_BUG_FIX.md)** - Complete nesting bug documentation

## 7. Edit Page Generation (Obsolete)

**Status**: ❌ **Obsolete** - Prototype only, not actively maintained

**Purpose**: Create temporary duplicate Notion pages for proposing edits to Atlas documents.

**Description**: This was a prototype feature that created duplicate Notion pages where users could propose changes to Atlas documents. The edited pages would be synced to Supabase separately and compared against originals using tree diffing algorithms.

**Current State**:

- Code exists but is obsolete and not compatible with current codebase
- Located in: `app/edit-page-list/`, `app/embed/create-edit-page/`, `app/test-edit-page/`
- Not maintained or tested
- Will be reimplemented in the future with updated architecture

**Related Code** (for reference only):

- `app/edit-page-list/` - UI for listing edit pages
- `app/embed/create-edit-page/` - Embedded UI for creating edit pages
- `app/test-edit-page/` - Testing interface

## 8. Proposal Generation (Obsolete)

**Status**: ❌ **Obsolete** - Prototype only, not actively maintained

**Purpose**: Generate human-readable diffs/proposals showing changes between original and edited Atlas documents.

**Description**: This was a prototype feature that would compare original vs edited content using tree diffing algorithms and generate formatted proposals showing all changes. Would have displayed differences in a human-readable format for review and approval.

**Current State**:

- Code exists but is obsolete and not compatible with current codebase
- Located in: `app/server/atlas/proposal-generation/old/`
- Not maintained or tested
- Will be reimplemented in the future with updated architecture

**Related Code** (for reference only):

- `app/server/atlas/proposal-generation/old/` - Old proposal generation logic
- `app/embed/diff/` - Old diff visualization UI
- `app/server/diff/` - Tree diffing utilities (some still used by Markdown → Notion sync)

# Database Schema

## Core Tables (Detailed)

### `notion_blocks`

Stores Notion page content as hierarchical blocks.

**Key Fields:**

- `notion_block_id` (UUID, PRIMARY KEY) - Notion's unique block identifier
- `parent_notion_block_id` (UUID) - Parent block ID, NULL for root blocks. Has CASCADE DELETE constraint
- `root_notion_toggle_block_id` (UUID, NOT NULL) - The Notion page ID this block belongs to
- `block_type` (TEXT, NOT NULL) - Block type: paragraph, heading_1, heading_2, heading_3, bulleted_list_item, numbered_list_item, etc.
- `has_children` (BOOLEAN) - Whether the block contains nested blocks
- `archived` (BOOLEAN) - Notion archive status
- `in_trash` (BOOLEAN) - Notion trash status
- `plain_text_content` (TEXT) - Extracted plain text for searching/display
- `json_content` (JSONB) - Full rich content from Notion API (formatting, links, etc.)
- `sort_order` (INTEGER, NOT NULL) - Position within parent (0-indexed) for maintaining order
- `canonical_document_title` (TEXT) - Atlas document identifier (e.g., "A.2.3.21")
- `created_at` (TIMESTAMPTZ) - Database row creation time
- `updated_at` (TIMESTAMPTZ)
- `last_edited_by_user_id` (TEXT) - Notion user ID who last edited

**Edit Page Fields:**

- `mapped_notion_page_id` (UUID) - Links to original page being edited

**Cascade deletes:**

- Foreign key: parent_notion_block_id CASCADE DELETE

### `notion_database_pages`

Stores Notion database pages and their hierarchical relationships.

**Key Fields:**

- `notion_page_id` (UUID, PRIMARY KEY) - Notion's unique page identifier
- `atlas_document_type` (ENUM, NOT NULL) - Page type. Enum values: 'Section', 'Core', 'Type Specification', 'Active Data Controller', 'Action Tenet', 'Active Data', 'Annotation', 'Scope', 'Article', 'Scenario', 'Scenario Variation', 'Needed Research'.
- `atlas_document_number` (TEXT, NOT NULL, DEFAULT '') - Document number of the Atlas document this page belongs to (e.g. 'A.1.2.3')
- `atlas_database_name` (ENUM, NOT NULL) - Database name. Enum values: 'Scopes', 'Articles', 'Sections & Primary Docs', 'Annotations', 'Tenets', 'Scenarios', 'Scenario Variations', 'Active Data', 'Agent Scope Database', 'Needed Research', 'Original Context Data'.
- `has_children` (BOOLEAN) - Whether page has sub-items in the database
- `archived` (BOOLEAN) - Notion archive status
- `in_trash` (BOOLEAN) - Notion trash status
- `plain_text_content` (TEXT) - Page content as plain text (used for display purposes only)
- `json_content` (JSONB) - Rich Text content from Notion API (used for two-way sync between Notion and the Markdown Atlas)
- `plain_text_name` (TEXT) - Page title as plain text
- `json_name` (JSONB) - Rich text page title from Notion API
- `parent_notion_page_id` (UUID) - Internal parent page ID for same-database nesting (used by Sections & Primary Docs and Agent Scope Database). NULL for cross-database children. Used by tree builder to filter direct children and as a workaround for Notion's bidirectional relationship bug.
- `sort_order` (DECIMAL(5,2)) - This field is DEPRECATED, don't use it. Previously: Position of sub item within parent (0-indexed, allows fractions like 1.5)
- `created_at`, `updated_at`, `last_edited_by_user_id` - Same as in notion_blocks table

Child relationship fields (JSONB arrays of UUID strings):

- `child_scope_ids`
- `child_article_ids`
- `child_section_and_primary_doc_ids`
- `child_annotation_ids`
- `child_tenet_ids`
- `child_scenario_ids`
- `child_scenario_variation_ids`
- `child_active_data_ids`
- `child_agent_scope_ids`
- `child_needed_research_ids`

**Additional Fields:**

- `extra_fields` (JSONB) - Additional fields stored as JSON key-value pairs, defaults to empty object. This is used to store extra fields related to some Atlas document types (Type Specification, Scenario, Scenario Variation)

Relationship modeling note:

- Parent-child relationships are modeled via per-type child ID arrays, not a parent foreign key. Cleanup of stale child IDs is handled at the application/import layer.

### `notion_database_pages_current`

A Postgres view that filters `notion_database_pages` to show only current, active rows.

**Filter Conditions:**

- `date_valid_to IS NULL` - Only current versions
- `in_trash = FALSE` - Excludes trashed pages
- `archived = FALSE` - Excludes archived pages

**Notes:**

- Same columns as `notion_database_pages` table
- RLS is automatically inherited from the underlying `notion_database_pages` table
- Provides convenient access to active Atlas documents without manually applying filters

### `notion_sync_status`

Manages Notion to Supabase synchronization state and prevents concurrent syncs of the same content.

### `import_logs`

Tracks Notion to Supabase import operations with detailed metrics and change tracking.

### `uuid_mapping`

Maintains bidirectional mappings between Notion page UUIDs and Atlas document UUIDs.

**Key Fields:**

- `notion_page_id` (UUID, NOT NULL, UNIQUE) - Notion page UUID
- `atlas_document_uuid` (UUID, NOT NULL, UNIQUE) - Atlas document UUID

**Purpose:**

Maps Notion's internal page identifiers to stable Atlas document UUIDs used in exported formats. This allows external systems to reference Atlas documents consistently regardless of Notion's internal IDs.

See **[docs/UUID_MAPPING.md](../docs/UUID_MAPPING.md)** for detailed documentation.

### `notion_nesting_bug_mapping`

Manual workaround mapping for Notion's sub-item relationship bug at deep nesting levels.

**Key Fields:**

- `child_notion_page_id` (UUID, NOT NULL) - Child page UUID
- `parent_notion_page_id` (UUID, NOT NULL) - Parent page UUID
- `atlas_database_name` (ENUM, NOT NULL) - Database containing these pages
- `child_label` (TEXT) - Human-readable child page label
- `parent_label` (TEXT) - Human-readable parent page label
- `place_after_sibling_notion_page_id` (UUID) - Sibling to position after (for ordering)
- `place_after_sibling_label` (TEXT) - Human-readable sibling label
- Composite PRIMARY KEY on (child_notion_page_id, parent_notion_page_id)

**Purpose:**

Stores manual parent-child relationship corrections for cases where Notion's API fails to properly maintain sub-item relationships at deep nesting levels (typically 4+ levels deep). This table is used by the Notion-Markdown sync automations to apply and restore proper hierarchies.

See **[docs/NOTION_NESTING_BUG_FIX.md](../docs/NOTION_NESTING_BUG_FIX.md)** for detailed documentation.

# Atlas

## Introduction to Atlas

The Atlas is a hierarchical corpus of internal rules and policies (like legal documents) in the Sky ecosystem. The **canonical Atlas** is stored as a Markdown file in a GitHub repository (`pppdns/next-gen-atlas`). **Notion is used as an editing and collaboration tool** where the Atlas is organized across multiple databases to enable easier editing and team collaboration. Think of it as a large, interconnected library of approximately 7,000 legal documents with specific types, numbers, and relationships. Each Atlas document has a document type (e.g. 'Section'), document name (e.g. 'Previously Warned Aligned Delegates'), document number (e.g. 'A.1.2.3').

**Data Flow**: Edits made in Notion → Imported to Supabase → Exported to Markdown → Committed to GitHub (canonical). Changes made directly to the canonical GitHub Markdown can be synced back to Notion via the Markdown → Notion sync workflow.

In the Notion editing environment, the Atlas is stored in the "Master Atlas DBs", which are a collection of 10 Notion databases. Documents reside in the database that corresponds to their type. General rule: each document type has its own database (e.g. Section type documents are in the Sections database in Notion). Exception #1: The database named `Sections & Primary Docs` contains four document types: `Section`, `Core`, `Type Specification`, and `Active Data Controller`. Exception #2: The database named `Agent Scope Database` contains two document types: `Core`, `Active Data Controller`.

### Document Type Categories

- **Immutable Documents**: Scopes, Articles, Sections
- **Primary Documents**: Core, Active Data Controller
- **Supporting Documents**: Active Data, Annotation, Needed Research, Action Tenet, Scenario, Scenario Variation
  - Supporting Documents must have a Target Document (an Immutable or Primary Document they attach to). For example, `Active Data` targets an `Active Data Controller`. The Target Document can also be referred to as the parent document.

## Atlas Databases & Document Types

### Atlas Database Names

The system works with 10 Notion databases that contain Atlas documents:

- **Scopes** - Top-level scope documents
- **Articles** - Article documents that contain sections
- **Sections & Primary Docs** - Core section and primary documents
- **Annotations** - Annotation documents
- **Tenets** - Tenet documents that contain scenarios
- **Scenarios** - Scenario documents that contain variations
- **Scenario Variations** - Individual scenario variations
- **Active Data** - Active data documents
- **Agent Scope Database** - Agent-specific scope documents
- **Needed Research** - Research items that need investigation

### Atlas Document Types

Each document in the Atlas has a specific type from the following enum:

- **Section**
- **Core**
- **Type Specification**
- **Active Data Controller**
- **Action Tenet**
- **Active Data**
- **Annotation**
- **Scope**
- **Article**
- **Scenario**
- **Scenario Variation**
- **Needed Research**

## Atlas Database Hierarchy

The Atlas documents are organized in a hierarchical structure across multiple Notion databases. The hierarchy defines the relationships between documents in different Atlas databases. "Scopes" and "Agent Scope Database" are the two root Atlas databases.

```
Scopes
└── Articles
    ├── Sections & Primary Docs
    │   ├── Annotations
    │   └── Tenets
    │   │   └── Scenarios
    │   │       └── Scenario Variations
    └── Agent Scope Database
        ├── Annotations
        ├── Tenets
        │   └── Scenarios
        │       └── Scenario Variations
        └── Active Data

"Needed Research" documents may be nested under any other document type
```

This hierarchy is respected by the Markdown→Notion sync engine, which creates pages in hierarchical order (parents before children) to ensure proper relationship establishment.

See Atlas Document Numbering rules: **[docs/ATLAS_DOCUMENT_NUMBERING_RULES.md](../docs/ATLAS_DOCUMENT_NUMBERING_RULES.md)**.

**Internal Nesting**: Some databases support internal hierarchy where documents can be nested under other documents of the same type:

- **Sections & Primary Docs** - Can have multiple levels of internal nesting
- **Agent Scope Database** - Can have multiple levels of internal nesting

This hierarchical structure is implemented in the `ATLAS_DATABASES` constant and managed through the `notion-database-properties-and-relationships.ts` mapping system.

## Atlas Document Hierarchy

The Atlas document numbering system follows a hierarchical structure where each document's number inherits from its parent document with additional segments appended. The numbering reflects the document's position in the Atlas hierarchy and its relationship to sibling documents.

```
Scope Documents (A.0, A.1, A.2, ...)
├── Article Documents (A.1.1, A.1.2, A.2.1, ...)
│   └── Section Documents (A.1.1.1, A.1.1.2, A.1.2.1, ...)
│       ├── Primary Documents:
│       │   ├── Core Documents (A.1.1.1.1, A.1.1.1.2, ...)
│       │   │   └── Nested Core Documents (A.1.1.1.1.1, A.1.1.1.1.2, ...)
│       │   ├── Active Data Controller (A.1.1.2.1, A.1.1.2.2, ...)
│       │   │   └── Active Data (.0.6.1, .0.6.2, ...)
│       │   └── Type Specification (A.1.1.3.1, A.1.1.3.2, ...)
│       └── Supporting Documents:
│           ├── Annotations (.0.3.1, .0.3.2, ...)
│           └── Tenets (.0.4.1, .0.4.2, ...)
│               └── Scenarios (.1.1, .1.2, ...)
│                   └── Scenario Variations (.var1, .var2, ...)

Global Documents:
└── Needed Research (NR-1, NR-2, NR-3, ...)
```

**Key Numbering Patterns:**

- **Sequential Inheritance**: Most documents inherit their parent's full number and append their own segment
- **Supporting Documents**: Use special directory numbers (0.3 for Annotations, 0.4 for Tenets, 0.6 for Active Data)
- **Global Numbering**: Needed Research documents use independent global numbering (NR-X)
- **Mixed Type Numbering**: When multiple document types exist under the same parent, they use sequential numbering across all types

## Atlas Database to Atlas Document Type Mapping

Each Atlas database contains specific types of documents. Here's the mapping of database names to their possible document types:

- **Scopes**
  - Scope

- **Articles**
  - Article

- **Sections & Primary Docs**
  - Section
  - Core
  - Type Specification
  - Active Data Controller

- **Annotations**
  - Annotation

- **Tenets**
  - Action Tenet

- **Scenarios**
  - Scenario

- **Scenario Variations**
  - Scenario Variation

- **Active Data**
  - Active Data

- **Agent Scope Database**
  - Core
  - Active Data Controller

- **Needed Research**
  - Needed Research

# Key Services

## Notion Integration (`/app/server/services/notion`)

- `notion-client.ts` - Notion API client with rate limiting
- `import-page-to-supabase.ts` - Syncs Notion pages to Supabase
- `import-database-to-supabase.ts` - Syncs Notion databases to Supabase
- `fetch-blocks-recursively.ts` - Retrieves nested blocks from the Notion API
- `create-edit-page.ts` - Creates temporary edit pages in Notion
- Rate limiting respects official Notion API limits, but supports higher throughput via supporting more than one API key

## Tree Diffing (`/app/server/diff`)

- `diff-trees.ts` - Compares original vs edited trees
- `tree.ts` - Tree data structures and builders
- Detects: added, deleted, edited, moved nodes
- Handles hierarchical content changes

## Atlas Business Logic (`/app/server/atlas`)

- `generate-atlas-json.ts` - Will generate JSON representation of Atlas hierarchy
- `generate-proposal.ts` - Will generate human-readable diffs
- Canonical document titles (e.g., "A.2.3.21") represent hierarchical position

### Atlas Configuration Files

- `atlas-types.ts` - Type definitions for Atlas (AtlasDatabaseName, AtlasDocumentType, etc.)
- `constants.ts` - Atlas constants (database names, document types, etc.) and re-exports from other files. Conditionally imports Notion IDs based on environment
- `notion-ids.ts` - Hard-coded Notion-specific identifiers (database IDs, status IDs, agent UUIDs) for production use
- `notion-ids-dev.ts` - Notion identifiers for development and manual QA environments
- `notion-ids-unit-test.ts` - Made-up UUIDs for unit tests (consistent test data)
- `type-color-map.ts` - UI color mappings for document types

**Environment-based Notion ID Loading:**

The `constants.ts` file conditionally imports Notion IDs from one of three files based on environment (in priority order):

1. **Unit Tests** (highest priority): Uses `notion-ids-unit-test.ts` (made-up UUIDs) when `isTestEnv() === true`
   - Provides consistent, realistic-looking UUIDs for unit tests
2. **Development/QA**: Uses `notion-ids-dev.ts` when `NODE_ENV !== 'production'`
   - Separate dev/QA IDs prevent accidental access to production data during local development and manual QA
3. **Production**: Uses `notion-ids.ts` (real IDs) when `NODE_ENV === 'production'`
   - Real Notion database and page IDs for production use

This three-tier system ensures:

- Unit tests use consistent made-up UUIDs that don't require real credentials
- Development and manual QA environments automatically use separate IDs
- Production uses real production Notion IDs

## Notion Database Property Mapping (`/app/server/atlas`)

- `notion-database-properties-and-relationships.ts` - Maps Notion database page properties to Supabase fields
- Defines property mappings for each Atlas database (e.g., 'Name' → `atlasDocumentName`)
- Defines child relationship mappings (e.g., 'Articles' → `child_article_ids`)
- Used in `convert-notion-pages-to-supabase-format.ts`, `fetch-database-pages.ts`, and `compare-database-pages.ts`
- Enables consistent data transformation between Notion API responses and Supabase storage format
- See **[docs/NOTION_PROPERTY_MAPPING.md](../docs/NOTION_PROPERTY_MAPPING.md)** for complete property and relationship mapping reference

## Trigger.dev Tasks (`/app/server/services/trigger`)

- `notion-sync-task.ts` - Background sync with retry logic
- Tracks Notion API call counts via metadata

# UI Components

## Main Pages

- **`/atlas`** - Atlas Portal: Interactive hierarchy viewer for browsing Atlas documents stored in Supabase. Includes search, filtering, and export capabilities. Similar to Atlas Explorer (https://sky-atlas.io)
- **`/atlas/sync`** - Markdown → Notion Sync: Visual diff preview and sync controls for synchronizing markdown changes back to Notion
- **`/atlas/sync/logs`** - Sync Audit Logs: View detailed logs of Notion API operations from sync tasks
- **`/atlas/changelog`** - Atlas Changelog: Historical view of Atlas document changes over time
- **`/atlas/notion-nesting-fix`** - Nesting Bug Management: Password-protected UI for managing Notion nesting bug mappings
- **`/notion-api-key-testing`** - Notion API Testing: Validate API keys, test rate limits, and verify retry logic (development tool)

## Embed Pages (`/app/embed`) - Mostly Obsolete

- **`/embed/create-edit-page/[notion-page-id]`** - ❌ Obsolete: UI for creating edit pages (not maintained)
- **`/embed/diff/[edit-page-id]`** - ❌ Obsolete: Displays content differences for edit pages (not maintained)
- Embeddable as iframes within Notion pages
- Compatible with web browsers, not iOS/iPad Notion app

## Obsolete Pages (Reference Only)

- **`/edit-page-list`** - ❌ Obsolete: List Notion "Edit Pages" (not maintained)
- **`/test-edit-page`** - ❌ Obsolete: Create and test edit pages (not maintained)

# Future Features

- Reimplementation of Edit Page generation with updated architecture
- Reimplementation of Proposal Generation (human-readable diffs) with updated architecture
- Automated webhook-based sync triggers (GitHub Markdown → Notion)

# Additional Documentation

## Atlas Architecture & Core Concepts

- **[docs/ATLAS_TREE_STRUCTURES.md](../docs/ATLAS_TREE_STRUCTURES.md)** - Comprehensive guide to the dual tree architecture: Notion Tree (internal) vs Export Tree (external)
- **[docs/UUID_MAPPING.md](../docs/UUID_MAPPING.md)** - UUID mapping system that maintains bidirectional mappings between Notion page UUIDs and Atlas document UUIDs
- **[docs/ATLAS_DOCUMENT_NUMBERING_RULES.md](../docs/ATLAS_DOCUMENT_NUMBERING_RULES.md)** - Comprehensive rules for Atlas document numbering, hierarchy, and relationships
- **[docs/ATLAS_EXTRA_FIELDS.md](../docs/ATLAS_EXTRA_FIELDS.md)** - Documentation for extra fields in Atlas documents (Type Specifications, Scenarios, Scenario Variations)
- **[docs/NOTION_PROPERTY_MAPPING.md](../docs/NOTION_PROPERTY_MAPPING.md)** - Complete reference for Notion property and relationship mappings to Supabase fields across all Atlas databases
- **[docs/ATLAS_DATA_PIPELINE.md](../docs/ATLAS_DATA_PIPELINE.md)** - Overview of the Atlas data pipeline and data flow architecture

## Atlas Data Formats & Export

- **[docs/ATLAS_MARKDOWN_SYNTAX.md](../docs/ATLAS_MARKDOWN_SYNTAX.md)** - Markdown syntax specification for Atlas document representation
- **[docs/ATLAS_MARKDOWN_IMPORT_EXPORT.md](../docs/ATLAS_MARKDOWN_IMPORT_EXPORT.md)** - Import/export workflows for converting between Notion and Markdown formats
- **[docs/MARKDOWN_TO_NOTION_SYNC.md](../docs/MARKDOWN_TO_NOTION_SYNC.md)** - Documentation for the Markdown to Notion synchronization process

## Edit Pages & Workflows (Obsolete)

- **[docs/EDIT_PAGE_GENERATION_USAGE.md](../docs/EDIT_PAGE_GENERATION_USAGE.md)** - ❌ Obsolete: Guide for creating and managing Edit Pages in Notion (feature not maintained, will be reimplemented in future)

## Notion Integration & Data Import

- **[docs/NOTION_EMBEDS.md](../docs/NOTION_EMBEDS.md)** - Compatibility guide for embedded iframes across Notion platforms (web vs native apps)
- **[docs/NOTION_NESTING_BUG_FIX.md](../docs/NOTION_NESTING_BUG_FIX.md)** - Manual workaround for Notion's sub-item relationship bug at deep nesting levels
- **[docs/NOTION_IMPORT_PROCESS.md](../docs/NOTION_IMPORT_PROCESS.md)** - Documentation for the Notion to Supabase import process

## Action Plans & Findings

- **[docs/action-plans/CONTENT_TRUNCATION_PREVENTION_ACTION_PLAN.md](../docs/action-plans/CONTENT_TRUNCATION_PREVENTION_ACTION_PLAN.md)** - Action plan for preventing content truncation issues
- **[docs/action-plans/NOTION_EDIT_PAGES_WITH_TOGGLE_BLOCKS_ACTION_PLAN.md](../docs/action-plans/NOTION_EDIT_PAGES_WITH_TOGGLE_BLOCKS_ACTION_PLAN.md)** - Action plan for handling toggle blocks in Edit Pages
- **[docs/action-plans/NOTION_PROPERTY_STANDARDIZATION_ACTION_PLAN.md](../docs/action-plans/NOTION_PROPERTY_STANDARDIZATION_ACTION_PLAN.md)** - Action plan for standardizing Notion property names and types
- **[docs/findings/NOTION_SUBITEM_RELATIONSHIP_FIX.md](../docs/findings/NOTION_SUBITEM_RELATIONSHIP_FIX.md)** - Findings and fixes for Notion sub-item relationship issues

## Component & Service Implementation Guides

These AGENTS.md files contain detailed implementation guides and context for specific features:

- **[app/atlas/sync/AGENTS.md](../app/atlas/sync/AGENTS.md)** - Markdown to Notion synchronization implementation details
- **[app/server/atlas/notion-tree/AGENTS.md](../app/server/atlas/notion-tree/AGENTS.md)** - Atlas tree system data structures and algorithms implementation
- **[app/server/services/trigger/AGENTS.md](../app/server/services/trigger/AGENTS.md)** - Trigger.dev background tasks implementation details
- **[app/notion-api-key-testing/AGENTS.md](../app/notion-api-key-testing/AGENTS.md)** - Notion API key testing page implementation
- **[app/server/atlas/README.md](../app/server/atlas/README.md)** - ❌ Obsolete: Documentation for the Atlas proposal generator (feature not maintained, will be reimplemented in future)

## Important Command line scripts

All commands are intended to be run from the repository root using `npx tsx`.

### Atlas Data Import/Export

- **scripts/import-notion-databases.ts** — Imports all configured Notion databases into Supabase, with optional local Notion API caching and Notion database selection.
  - Examples:
    - ```bash
      npx tsx scripts/import-notion-databases.ts
      ```

- **scripts/atlas-export/generate-atlas-markdown.ts** — Builds "Export Tree" Atlas trees from Supabase and exports to Markdown format. Output: `exported-atlas/atlas.md`
  - Example:
    - ```bash
      npx tsx scripts/atlas-export/generate-atlas-markdown.ts
      ```

- **scripts/atlas-export/generate-atlas-json.ts** — Builds "Export Tree" Atlas trees from Supabase and exports to JSON format. Output: `exported-atlas/atlas.json`
  - Example:
    - ```bash
      npx tsx scripts/atlas-export/generate-atlas-json.ts
      ```

### Atlas Validation & Analysis

- **scripts/validate-atlas-markdown.ts** — Validates Atlas Markdown files for syntax errors and structural issues. Checks title line format, heading level progression, document numbering, extra fields, UUID uniqueness, and parent-child relationships.
  - Examples:
    - ```bash
      npx tsx scripts/validate-atlas-markdown.ts
      ```
    - ```bash
      npx tsx scripts/validate-atlas-markdown.ts exported-atlas/atlas.md
      ```
    - ```bash
      npx tsx scripts/validate-atlas-markdown.ts --verbose
      ```

- **scripts/validate-atlas-json.ts** — Validates Atlas JSON files for structural integrity and consistency. Defaults to `exported-atlas/atlas.json` if no file path provided.
  - Examples:
    - ```bash
      npx tsx scripts/validate-atlas-json.ts
      ```
    - ```bash
      npx tsx scripts/validate-atlas-json.ts path/to/atlas.json
      ```

- **scripts/atlas-changelog.ts** — Prints a human-readable change log of Atlas documents since a time window. Data is loaded from the temporal table in Supabase (`notion_database_pages`).
  - Examples:
    - ```bash
      npx tsx scripts/atlas-changelog --since 1d
      ```

### Notion Database Utilities

- **scripts/create-test-notion-databases.ts** — Creates test versions of all Atlas databases in Notion for safe testing of Markdown→Notion sync automation. All test databases are created with [TEST] prefix.
  - Examples:
    - ```bash
      npx tsx scripts/create-test-notion-databases.ts
      ```
    - ```bash
      npx tsx scripts/create-test-notion-databases.ts --delete-existing
      ```

- **scripts/generate-uuid-mapping.ts** — Generates UUID mappings for all current Notion database pages. Reads from `notion_database_pages` and inserts into `uuid_mapping` table.
  - Example:
    - ```bash
      npx tsx scripts/generate-uuid-mapping.ts
      ```

### Utility Scripts

- **scripts/agent-notification.ts** — Sends notification when AI agent completes a task (internal utility).

Helper modules (imported by scripts):

- `scripts/atlas-export/utils.ts` — document number comparison and prefix fixing utilities
- `scripts/utils/load-env.ts` — loads Next.js environment variables for scripts

Important: Do not use or rely on `parent_notion_page_id` to build the Atlas tree structure. Build hierarchy using the per-type `child_*` ID arrays (e.g., `child_article_ids`, `child_section_and_primary_doc_ids`) starting from the two top-level Atlas databases' documents: `Scopes` and `Sections & Primary Docs` (see Atlas Document Hierarchy). `parent_notion_page_id` is only used for same-database hierarchies in the "Sections & Primary Docs" and "Agent Scope Database" Notion databases

## Critical Edge Cases: Child Relationship Arrays

**CRITICAL: Core Document Filtering Logic**

The `child_section_and_primary_doc_ids` and `child_agent_scope_ids` arrays present complex filtering challenges for nested Core documents:

1. **The Child Array Problem**: When a Section contains nested Core documents (Core → Core → Core), ALL nested Core document IDs appear in the parent Section's `child_section_and_primary_doc_ids` array, not just direct children.

2. **Filtering Challenge**: The `filterDirectChildren` function must distinguish between:
   - **Direct children** (Core documents that should be immediate children of the Section)
   - **Nested descendants** (Core documents that are descendants of other Core documents)

3. **The Solution (Generalized Direct-Child Rules)**:
   - Cross-database → internally nested DB child: keep only if `parent_notion_page_id` is null.
   - Same internally nested DB (Sections & Primary Docs, Agent Scope Database): keep only if `parent_notion_page_id === parentPageId`.
   - Apply to all document types in those DBs.

4. **Implementation Requirements**:
   - Pass `parentPageId` to `filterDirectChildren` and apply the rules above.
   - Keep cycle guards and depth caps where traversal occurs.

5. **Real-World Impact**: Prevents nested docs from appearing under both parent and grandparent.

**Duplicates Policy**

Treat as modeling issues; filtering should avoid them or raise an error.
