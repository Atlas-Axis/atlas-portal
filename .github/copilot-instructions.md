# GitHub Copilot Instructions

> **📋 Core Project Documentation**
>
> This file is part of the **Core Project Documentation** consisting of 3 synchronized files that provide high-level project overviews:
>
> - **[README.md](../README.md)** - Human-readable project documentation
> - **[.cursorrules](../.cursorrules)** - AI agent documentation for Cursor IDE
> - **This file** - AI agent documentation for GitHub Copilot
>
> ⚠️ **Important**: When updating high-level project information, **always update all 3 files** to keep them synchronized. Reference these collectively as the "**Core Project Documentation**" files.

# Copilot AI Agent Instructions

- If my prompt is ambiguous, please ask me clarifying questions to resolve any confusion. This will help prevent generating incorrect code, even if it means I'll need to put in extra effort to answer your questions.
- Don't ask for permission to run console commands (tests, etc.), just run them.
- When you ask me questions, assign numbers to each question so that I can answer them more easily

# Project Overview

This Next.js application enables change tracking for Atlas documents stored in Notion databases. The Atlas is a collection of legal documents (laws) organized hierarchically in Notion databases. This system allows users to propose edits by creating temporary duplicate Notion pages, syncing changes to Supabase, and visualizing differences using tree diffing algorithms.

## Core Workflow

1. **Import**: Sync original Notion databases/pages to Supabase
2. **Edit**: Create temporary duplicate Notion pages for editing
3. **Track**: Sync edited pages back to Supabase (stored separately)
4. **Diff**: Compare original vs edited content using tree algorithms
5. **Review**: Display human-readable diffs of proposed changes

# Tech Stack

## Framework & Runtime

- Next.js 15 with App Router, server-side rendering
- TypeScript with strict type-safety
- Node.js (v20.19)

## UI & Styling

- HeroUI (NextUI) - React component library
- Tailwind CSS
- Lucide React icons
- tailwind-merge (cn helper) for conditional classes

## Database & Storage

- Supabase (PostgreSQL database)
- PostgreSQL with public schema

## Background Jobs

- Trigger.dev - For background sync tasks
- Manual triggers via UI buttons (future: automated)

## Development Tools

- ESLint, Prettier
- Husky (Git hooks)
- Vitest (Testing)

# Database Schema

## Core Tables (Detailed)

### `notion_blocks`

Stores Notion page content as hierarchical blocks. This is the primary table for storing page content.

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
- `updated_at` (TIMESTAMPTZ) - Auto-updates on row modification
- `last_edited_by_user_id` (TEXT) - Notion user ID who last edited

**Edit Page Fields:**

- `mapped_notion_page_id` (UUID) - Links to original page being edited

**Cascade deletes:**

- Foreign key: parent_notion_block_id CASCADE DELETE

### `notion_database_pages`

Stores Notion database pages and their hierarchical relationships. Structure mirrors notion_blocks.

**Key Fields:**

- `notion_page_id` (UUID, PRIMARY KEY) - Notion's unique page identifier
- `atlas_document_type` (ENUM, NOT NULL) - Page type. Enum values: 'Section', 'Core', 'Type Specification', 'Active Data Controller', 'Spell SP Controller', 'Placeholder', 'Category', 'Action Tenet', 'Active Data', 'Annotation', 'Scope', 'Article', 'Scenario', 'Scenario Variation', 'Needed Research'.
- `atlas_document_number` (TEXT, NOT NULL, DEFAULT '') - Document number of the Atlas document this page belongs to
- `atlas_database_name` (ENUM, NOT NULL) - Database name. Enum values: 'Scopes', 'Articles', 'Sections & Primary Docs', 'Annotations', 'Tenets', 'Scenarios', 'Scenario Variations', 'Active Data', 'Agent Scope Database', 'Needed Research', 'Original Context Data'.
- `has_children` (BOOLEAN) - Whether page has sub-items in the database
- `archived` (BOOLEAN) - Notion archive status
- `in_trash` (BOOLEAN) - Notion trash status
- `plain_text_content` (TEXT) - Page content as plain text
- `json_content` (JSONB) - Rich content from Notion API
- `plain_text_name` (TEXT) - Page title as plain text
- `json_name` (JSONB) - Rich text page title from Notion API
- `parent_notion_page_id` (UUID) - Parent Notion page ID (if any) - This field is deprecated, don't use it
- `sort_order` (DECIMAL(5,2)) - Position of sub item within parent (0-indexed, allows fractions like 1.5)
- `canonical_document_title` (TEXT) - Atlas document identifier
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

- `extra_fields` (JSONB) - Additional fields stored as JSON key-value pairs, defaults to empty object. This is used to store extra fields related to Type Specification Atlas documents

Relationship modeling note:

- Parent-child relationships are modeled via per-type child ID arrays, not a parent foreign key. Cleanup of stale child IDs is handled at the application/import layer.

### `notion_sync_status`

Manages synchronization state and prevents concurrent syncs of the same content.

**Key Fields:**

- `id` (UUID, PRIMARY KEY, DEFAULT gen_random_uuid()) - Internal ID
- `notion_database_id` (UUID, NOT NULL, UNIQUE) - Notion database being synced
- `sync_status` (TEXT, NOT NULL) - Status: 'pending', 'in_progress', 'completed', 'failed', 'cancelled'
- `last_sync_started_at` (TIMESTAMPTZ) - When sync began
- `last_sync_completed_at` (TIMESTAMPTZ) - When sync succeeded
- `sync_error_message` (TEXT) - Error details if failed
- `blocks_synced_count` (INTEGER) - Progress tracking
- `is_sync_locked` (BOOLEAN) - Prevents concurrent syncs
- `sync_lock_acquired_at` (TIMESTAMPTZ) - Lock timestamp
- `sync_lock_expires_at` (TIMESTAMPTZ) - Auto-unlock time for stale locks
- `created_at`, `updated_at` - Standard timestamps

## Atlas Database Names & Document Types

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

- **Section** - Hierarchical section documents
- **Core** - Core legal documents
- **Type Specification** - Technical specification documents
- **Active Data Controller** - Documents controlling active data
- **Spell SP Controller** - Documents controlling spell SP
- **Placeholder** - Placeholder documents
- **Category** - Categorization documents
- **Action Tenet** - Action-oriented tenet documents
- **Active Data** - Active data items
- **Annotation** - Annotation items
- **Scope** - Scope items
- **Article** - Article items
- **Scenario** - Scenario items
- **Scenario Variation** - Individual scenario variations
- **Needed Research** - Research items

## Atlas Document Hierarchy

The Atlas documents are organized in a hierarchical structure across multiple Notion databases. The hierarchy defines the relationships between different types of documents. "Scopes" and "Scopes" are the two root Atlas databases:

```
Scopes
├── Articles
│   ├── Sections & Primary Docs
│   │   ├── Annotations
│   │   └── Tenets
│   │       └── Scenarios
│   │           └── Scenario Variations
Agent Scope Database
├── Annotations
├── Tenets
│   └── Scenarios
│       └── Scenario Variations
└── Active Data

"Needed Research" documents may be nested under any other document type
```

See Atlas Document Numbering rules: **[docs/ATLAS_DOCUMENT_NUMBERING_RULES.md](../docs/ATLAS_DOCUMENT_NUMBERING_RULES.md)**.

**Internal Nesting**: Some databases support internal hierarchy where documents can be nested under other documents of the same type:

- **Sections & Primary Docs** - Can have multiple levels of internal nesting
- **Agent Scope Database** - Can have multiple levels of internal nesting

This hierarchical structure is implemented in the `ATLAS_DATABASES` constant and managed through the `notion-database-properties-and-relationships.ts` mapping system.

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

## Atlas Business Logic (`/app/server/services/atlas`)

- `generate-atlas-json.ts` - Will generate JSON representation of Atlas hierarchy
- `generate-proposal.ts` - Will generate human-readable diffs
- Canonical document titles (e.g., "A.2.3.21") represent hierarchical position

## Notion Database Property Mapping (`/app/server/services/atlas`)

- `notion-database-properties-and-relationships.ts` - Maps Notion database page properties to Supabase fields
- Defines property mappings for each Atlas database (e.g., 'Name' → `atlasDocumentName`)
- Defines child relationship mappings (e.g., 'Articles' → `child_article_ids`)
- Used in `convert-notion-pages-to-supabase-format.ts`, `fetch-database-pages.ts`, and `compare-database-pages.ts`
- Enables consistent data transformation between Notion API responses and Supabase storage format

## Trigger.dev Tasks (`/app/server/services/trigger`)

- `notion-sync-task.ts` - Background sync with retry logic
- Tracks Notion API call counts via metadata

# UI Components

## Embed Pages (`/app/embed`)

- Embeddable as iframes within Notion pages
- `create-edit-page/[notion-page-id]` - UI for creating edit pages
- `diff` - Displays content differences
- Compatible with web browsers, not iOS/iPad Notion app

## Main Pages

- `/atlas` - Hierarchy view of Atlas documents stored in Supabase. Similar to Atlas Explorer (https://sky-atlas.powerhouse.io)
- `/atlas/list` - List view of Atlas documents stored in Supabase, grouped by Atlas database name. Similar to the GitHub version of the Atlas
- `/edit-page-list` - List Notion "Edit Pages"
- `/notion-api-key-testing` - Validate Notion API keys, retries, and rate limits (development)
- `/markdown` - Preview generated markdown output (development)
- `/test-edit-page` - Create and test edit pages (development)

# Important Patterns

## Sync Locking

- Prevents concurrent syncs of same content
- Lock expiration for cleanup
- Verified before each sync operation

## Temporal Tables (versioned rows)

- The `notion_database_pages` table is temporal: `date_valid_from`/`date_valid_to` (UTC) define row validity.
- The current row has `date_valid_to IS NULL` and is enforced unique per `notion_page_id`.
- We index `atlas_database_name` filtered by `date_valid_to IS NULL` for fast current reads.

Usage examples:

- Load current rows by database:

```sql
SELECT * FROM notion_database_pages WHERE date_valid_to IS NULL AND atlas_database_name = 'Scopes';
```

- Versioned upsert via Supabase RPC:

```ts
await supabase().rpc('versioned_upsert_notion_database_pages', { p_rows: payload }).throwOnError();
```

- Soft-delete via Supabase RPC:

```ts
await supabase().rpc('versioned_delete_notion_database_pages', { p_ids: ids }).throwOnError();
```

## Future Features

- Two-way Notion sync (not just import)
- Automated Edit Page creation
- Human-readable edit proposal generation (show diffs, aggregated from multiple edit pages)
- Automated background sync triggers

# Additional Documentation

## Core Documentation Files

- **[README.md](../README.md)** - Project overview and getting started guide (coming soon)
- **[docs/NOTION_EMBEDS.md](../docs/NOTION_EMBEDS.md)** - Compatibility guide for embedded iframes across Notion platforms (web vs native apps)

## Atlas Services

- **[app/server/services/atlas/README.md](../app/server/services/atlas/README.md)** - Documentation for the Atlas proposal generator that converts TreeChange[] to formatted Atlas proposal markdown

## Command line scripts

All commands are intended to be run from the repository root using tsx.

- **scripts/atlas-changelog.ts** — Prints a human-readable change log of Atlas documents since a time window.
  - Examples:
    - ```bash
      npx tsx scripts/atlas-changelog
      ```
    - ```bash
      npx tsx scripts/atlas-changelog --since 1d --max-line-length 120
      ```

- **scripts/atlas-github-html-analytics.ts** — Analyzes the GitHub-exported Sky Atlas HTML and prints section/document analytics.
  - Examples:
    - ```bash
      npx tsx scripts/atlas-github-html-analytics.ts
      ```
    - ```bash
      DEBUG_LOGGING=1 npx tsx scripts/atlas-github-html-analytics.ts
      ```

- **scripts/atlas-json/generate-atlas-json-from-github.ts** — Parses the Sky Atlas HTML into a machine-friendly JSON array and writes `.output/atlas-github.json`.
  - Examples:
    - ```bash
      npx tsx scripts/atlas-json/generate-atlas-json-from-github.ts
      ```
    - ```bash
      DEBUG_LOGGING=1 npx tsx scripts/atlas-json/generate-atlas-json-from-github.ts
      ```

- **scripts/atlas-json/generate-atlas-json-from-supabase.ts** — Exports current or past Atlas data from Supabase into `.output/supabase-github.json`.
  - Examples:
    - ```bash
      npx tsx scripts/atlas-json/generate-atlas-json-from-supabase.ts
      ```
    - ```bash
      npx tsx scripts/atlas-json/generate-atlas-json-from-supabase.ts --validAt 2025-01-15T12:00:00Z
      ```

- **scripts/atlas-json/generate-atlas-json-from-blue-json.ts** — Parses hierarchical Blue JSON export from `.debug-data/blue.json`, flattens it into documents, and writes categorized JSON to `.output/atlas-blue.json`.
  - Examples:
    - ```bash
      npx tsx scripts/atlas-json/generate-atlas-json-from-blue-json.ts
      ```
    - ```bash
      DEBUG_LOGGING=1 npx tsx scripts/atlas-json/generate-atlas-json-from-blue-json.ts
      ```

- **scripts/generate-blue-json.ts** — Generates a Blue-style hierarchical JSON from Supabase (child\_\* relationships only; excludes Agent Scope Database) and writes `.debug-data/atlas-json-generated/blue-from-supabase.json`.
  - Examples:
    - ```bash
      npx tsx scripts/generate-blue-json.ts
      ```
    - ```bash
      DEBUG_LOGGING=1 npx tsx scripts/generate-blue-json.ts
      ```

- **scripts/filter-blue-json-inactive-docs.ts** — Filters `.debug-data/blue.json` to exclude all `inactive: 1` documents (including their subdocuments) and writes `.debug-data/blue-without-inactive.json`.
  - Examples:
    - ```bash
      npx tsx scripts/filter-blue-json-inactive-docs.ts
      ```

- **scripts/atlas-json/strip-blue-json-last-modified.ts** — Recursively replaces any `*_last_modified` fields with empty strings to reduce diff noise.
  - Outputs:
    - `.debug-data/atlas-json-generated/blue-from-supabase-without-dates.json`
    - `.debug-data/blue-without-inactive-without-dates.json`
  - Examples:
    - ```bash
      npx tsx scripts/atlas-json/strip-blue-json-last-modified.ts
      ```

- **scripts/experiment.ts** — Finds Notion database entries with empty "Master Status" (skips "Category" where applicable).
  - Example:
    - ```bash
      npx tsx scripts/experiment.ts
      ```

- **scripts/get-notion-database-page-count.ts** — Prints the total number of pages in a given Notion database ID.
  - Examples:
    - ```bash
      npx tsx scripts/get-notion-database-page-count.ts 00000000-0000-0000-0000-000000000000
      ```
    - ```bash
      npx tsx scripts/get-notion-database-page-count.ts --verbose 00000000-0000-0000-0000-000000000000
      ```

- **scripts/import-notion-databases.ts** — Imports all configured Notion databases into Supabase, with optional local Notion API caching.
  - Examples:
    - ```bash
      npx tsx scripts/import-notion-databases.ts
      ```
    - ```bash
      npx tsx scripts/import-notion-databases.ts --verbose --local-cache
      ```

- **scripts/visualize-hierarchy.ts** — Loads Atlas pages from Supabase, builds the tree, and prints an ASCII or structured visualization.
  - Examples:
    - ```bash
      npx tsx scripts/visualize-hierarchy.ts
      ```
    - ```bash
      npx tsx scripts/visualize-hierarchy.ts --ascii
      ```

Helper modules (imported by scripts):

- `scripts/atlas-json/types.ts` — shared types for JSON generation scripts
- `scripts/atlas-json/constants.ts` — output file paths and configuration constants
- `scripts/atlas-json/utils.ts` — document number comparison and prefix fixing utilities
- `scripts/utils/load-env.ts` — loads Next.js environment variables for scripts

Important: Avoid using `parent_notion_page_id` to derive hierarchy. It is not reliable for building the Atlas tree. Use the per-type `child_*` ID arrays (e.g., `child_article_ids`, `child_section_and_primary_doc_ids`) and traverse from the two top-level Atlas databases' documents: `Scopes` and `Sections & Primary Docs` (see Atlas Document Hierarchy).
