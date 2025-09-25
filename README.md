# Atlas Axis Notion Automation

A Next.js application that enables change tracking for Atlas documents stored in Notion databases. The Atlas is a collection of legal documents organized hierarchically in Notion databases. This system allows users to propose edits by creating temporary duplicate Notion pages, syncing original and changed pages to Supabase, and calculating differences using tree diffing algorithms.

## 🚀 Core Workflow

1. **Import**: Sync original Notion databases/pages to Supabase
2. **Edit**: Create temporary duplicate Notion pages for editing
3. **Track**: Sync edited Notion pages back to Supabase (stored separately from original pages)
4. **Diff**: Compare original vs edited content using tree algorithms
5. **Review**: Display human-readable diffs of proposed changes

## 🛠️ Tech Stack

### Framework & Runtime

- **Next.js 15** with App Router, server-side rendering
- **TypeScript** with strict type-safety
- **Node.js** (v20.19)

### UI & Styling

- **HeroUI (NextUI)** - React component library
- **Tailwind CSS** for styling
- **Lucide React** icons
- **tailwind-merge** (cn helper) for conditional classes

### Database & Storage

- **Supabase** (PostgreSQL database). Only used server-side
- **PostgreSQL** with public schema (public access disabled via RLS)

### Background Jobs

- **Trigger.dev** - For background sync tasks
- Manual triggers via UI buttons (future: automated)

### Development Tools

- **ESLint**, **Prettier**
- **Husky** (Git hooks)
- **Vitest** (Testing)

## 🗄️ Database Schema

### Core Tables

#### `notion_blocks`

Stores Notion page content as hierarchical blocks. This is the primary table for storing page content.

**Key Fields:**

- `notion_block_id` (UUID, PRIMARY KEY) - Notion's unique block identifier
- `parent_notion_block_id` (UUID) - Parent block ID, NULL for root blocks
- `root_notion_toggle_block_id` (UUID, NOT NULL) - The Notion page ID this block belongs to
- `block_type` (TEXT, NOT NULL) - Block type: paragraph, heading_1, heading_2, etc.
- `has_children` (BOOLEAN) - Whether the block contains nested blocks
- `plain_text_content` (TEXT) - Extracted plain text for searching/display
- `json_content` (JSONB) - Full rich content from Notion API
- `sort_order` (INTEGER, NOT NULL) - Position within parent (0-indexed)
- `canonical_document_title` (TEXT) - Atlas document identifier (e.g., "A.2.3.21 Some Document")

**Edit Page Fields:**

- `mapped_notion_page_id` (UUID) - Links to original page being edited

#### `notion_database_pages`

Stores Notion database pages and their hierarchical relationships.

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
- `sort_order` (DECIMAL(5,2), NOT NULL) - Position of sub item within parent (0-indexed, allows fractions like 1.5)
- `canonical_document_title` (TEXT) - Atlas document identifier
- `created_at` (TIMESTAMPTZ) - Database row creation time
- `updated_at` (TIMESTAMPTZ) - Auto-updates on row modification
- `last_edited_by_user_id` (TEXT) - Notion user ID who last edited

Child relationship fields (JSONB arrays of UUID strings):

- `child_scope_ids` – Children from 'Scopes'
- `child_article_ids` – Children from 'Articles'
- `child_section_and_primary_doc_ids` – Children from 'Sections & Primary Docs'
- `child_annotation_ids` – Children from 'Annotations'
- `child_tenet_ids` – Children from 'Tenets'
- `child_scenario_ids` – Children from 'Scenarios'
- `child_scenario_variation_ids` – Children from 'Scenario Variations'
- `child_active_data_ids` – Children from 'Active Data'
- `child_agent_scope_ids` – Children from 'Agent Scope Database'
- `child_needed_research_ids` – Children from 'Needed Research'

**Additional Fields:**

- `extra_fields` (JSONB) – Additional fields stored as JSON key-value pairs, defaults to empty object. This is used to store extra fields related to Type Specification Atlas documents

#### `notion_sync_status`

Manages synchronization state and prevents concurrent syncs of the same content.

**Key Fields:**

- `id` (UUID, PRIMARY KEY) - Internal ID
- `notion_database_id` (UUID, NOT NULL, UNIQUE) - Notion database being synced
- `sync_status` (TEXT, NOT NULL) - Status: 'pending', 'in_progress', 'completed', 'failed', 'cancelled'
- `last_sync_started_at` (TIMESTAMPTZ) - When sync began
- `last_sync_completed_at` (TIMESTAMPTZ) - When sync succeeded
- `sync_error_message` (TEXT) - Error details if failed
- `blocks_synced_count` (INTEGER) - Number of blocks successfully synced
- `is_sync_locked` (BOOLEAN) - Prevents concurrent syncs
- `sync_lock_acquired_at` (TIMESTAMPTZ) - When the sync lock was acquired
- `sync_lock_expires_at` (TIMESTAMPTZ) - When the sync lock expires (for cleanup of stale locks)
- `created_at` (TIMESTAMPTZ) - Database row creation time
- `updated_at` (TIMESTAMPTZ) - Auto-updates on row modification

## 📋 Atlas Database Names & Document Types

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

The Atlas documents are organized in a hierarchical structure across multiple Notion databases. The hierarchy defines the relationships between different types of documents. "Scopes" and "Sections & Primary Docs" are the two root Atlas databases.

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

## 🔧 Key Services

### Notion Integration (`/app/server/services/notion`)

- `notion-client.ts` - Notion API client with rate limiting, retries, and parallelization
- `import-page-to-supabase.ts` - Syncs Notion pages to Supabase
- `import-database-to-supabase.ts` - Syncs Notion databases to Supabase
- `fetch-blocks-recursively.ts` - Retrieves nested blocks from the Notion API recursively
- `create-edit-page.ts` - Creates temporary edit pages in Notion
- Rate limiting respects official Notion API limits, supports multiple API keys for higher throughput

### Tree Diffing (`/app/server/diff`)

- `diff-trees.ts` - Compares original vs edited trees
- `tree.ts` - Tree data structures and builders
- Detects: added, deleted, edited, moved nodes
- Handles hierarchical content changes

### Atlas Business Logic (`/app/server/services/atlas`)

- `generate-atlas-json.ts` - Generates JSON representation of Atlas hierarchy
- `generate-proposal.ts` - Generates human-readable diffs
- Canonical document titles (e.g., "A.2.3.21 Some Document") represent hierarchical position

### Notion Database Property Mapping (`/app/server/services/atlas`)

- `notion-database-properties-and-relationships.ts` - Maps Notion database page properties to Supabase fields
- Defines property mappings for each Atlas database (e.g., 'Name' → `atlasDocumentName`)
- Defines child relationship mappings (e.g., 'Articles' → `child_article_ids`)
- Used in `convert-notion-pages-to-supabase-format.ts`, `fetch-database-pages.ts`, and `compare-database-pages.ts`
- Enables consistent data transformation between Notion API responses and Supabase storage format

### Trigger.dev Tasks (`/app/server/services/trigger`)

- `notion-sync-task.ts` - Background sync with retry logic
- Tracks Notion API call counts via metadata

## 🎨 UI Components

### Embed Pages (`/app/embed`)

Embeddable as iframes within Notion pages:

- `create-edit-page/[notion-page-id]` - UI for creating edit pages
- `diff` - Displays content differences
- Compatible with web browsers, Mac OS Notion app, not iOS/iPad Notion app

### Atlas & Internal Pages

- `/atlas` - Hierarchy view of Atlas documents stored in Supabase. Similar to Atlas Explorer (https://sky-atlas.powerhouse.io)
- `/atlas/list` - List view of Atlas documents stored in Supabase, grouped by Atlas database name. Similar to the GitHub version of the Atlas
- `/edit-page-list` - List Notion "Edit Pages"
- `/notion-api-key-testing` - Validate Notion API keys, retries, and rate limits (development)
- `/markdown` - Preview generated markdown output (development)
- `/test-edit-page` - Create and test edit pages (development)

## 🔄 Important Patterns

### Sync Locking

- Prevents concurrent syncs of same content
- Locks expire after 30 minutes - automatic cleanup in error state
- Verified before each sync operation

### Temporal Tables (versioned rows)

- Rows in `notion_database_pages` are versioned using `date_valid_from` (UTC) and `date_valid_to` (UTC).
- The current version has `date_valid_to IS NULL`. A partial unique index enforces one current row per `notion_page_id`.
- Optimized index for current reads: `atlas_database_name` filtered by `date_valid_to IS NULL`.

Common queries:

- Select current rows by database:

```sql
SELECT *
FROM notion_database_pages
WHERE date_valid_to IS NULL
  AND atlas_database_name = 'Sections & Primary Docs';
```

- Insert new version(s) atomically (invalidate current, insert new):

```sql
SELECT versioned_upsert_notion_database_pages(
  '[{"notion_page_id":"00000000-0000-0000-0000-000000000001","atlas_database_name":"Sections & Primary Docs","atlas_document_type":"Section","atlas_document_number":"A.1","has_children":false,"archived":false,"in_trash":false,"json_name":{},"json_content":{},"child_scope_ids":[],"child_article_ids":[],"child_section_and_primary_doc_ids":[],"child_annotation_ids":[],"child_tenet_ids":[],"child_scenario_ids":[],"child_scenario_variation_ids":[],"child_active_data_ids":[],"child_agent_scope_ids":[],"child_needed_research_ids":[],"extra_fields":{},"sort_order":0}]'::jsonb
);
```

- Soft-delete (invalidate current):

```sql
SELECT versioned_delete_notion_database_pages(ARRAY['00000000-0000-0000-0000-000000000001']::uuid[]);
```

Supabase usage:

```ts
// Insert or upsert versioned rows
await supabase().rpc('versioned_upsert_notion_database_pages', { p_rows: payload }).throwOnError();

// Soft-delete (invalidate)
await supabase().rpc('versioned_delete_notion_database_pages', { p_ids: ids }).throwOnError();

// Load current
const { data } = await supabase()
  .from('notion_database_pages')
  .select('*')
  .is('date_valid_to', null)
  .eq('atlas_database_name', 'Sections & Primary Docs');
```

## 🚧 Future Features

- Two-way Notion sync (not just import)
- Automated Edit Page sync when changes happen
- Human-readable Atlas Edit Proposal generation (showaggregate diffs from multiple edit pages)
- Automated background sync triggers
- Group diffs by Atlas scope and agent
- Unit tests, E2E tests
- Git hooks for linting

## 📚 Documentation

### 📋 Core Project Documentation Files

This project maintains **3 synchronized documentation files** that provide high-level project overviews:

- **[README.md](./README.md)** - Human-readable project documentation (this file)
- **[.cursorrules](./.cursorrules)** - AI agent documentation for Cursor IDE
- **[.github/copilot-instructions.md](./.github/copilot-instructions.md)** - AI agent documentation for GitHub Copilot

⚠️ **Important**: When updating high-level project information, **always update all 3 files** to keep them synchronized. Reference these collectively as the "**Core Project Documentation**" files.

### Docs for Embeddable Notion Pages

- **[docs/NOTION_EMBEDS.md](./docs/NOTION_EMBEDS.md)** - Compatibility guide for embedded iframes across Notion platforms (web vs native apps)

### Atlas Services

- **[app/server/services/atlas/README.md](./app/server/services/atlas/README.md)** - Documentation for the Atlas proposal generator that converts TreeChange[] to formatted Atlas proposal markdown

## 🚀 Getting Started

### Prerequisites

- Node.js (v20.19 or higher)
- Supabase API keys
- Notion API key(s)
- Vercel CLI (logged in, project linked)

### Installation

1. Clone the Git repository
2. Clone environment variables (`vercel env pull .env.local`)
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run database migrations manually in Supabase (`app/server/database/*.sql`)
5. Start the development server:
   ```bash
   npm run dev
   ```

### Environment Variables

- `NOTION_SECRETS_READ` - Your read-only Notion integration API key to read Master Atlas DB-s
- `NOTION_SECRET_WRITE` - Your Notion integration API key to create Edit Pages
- `NOTION_WEBHOOK_VERIFICATION_TOKEN` - https://developers.notion.com/reference/webhooks#step-3-validating-event-payloads-recommended
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_API_KEY` - Your Supabase API key
- `TRIGGER_SECRET_KEY` - Trigger.dev secret key (for background jobs)
- `NODE_ENV` - Either 'development' (for `npm run dev`) or 'production' (for `npm run build`)
- `DEBUG_LOGGING` - When set, console logs will be verbose

## 🧰 Command line scripts

All commands are intended to be run from the repository root using tsx.

- **scripts/atlas-changelog.ts**: Prints a human-readable change log of Atlas documents since a time window.
  - Example:
    - ```bash
      npx tsx scripts/atlas-changelog
      ```
    - ```bash
      npx tsx scripts/atlas-changelog --since 1d --max-line-length 120
      ```

- **scripts/atlas-github-html-analytics.ts**: Analyzes the GitHub-exported Sky Atlas HTML and prints section/document analytics.
  - Example:
    - ```bash
      npx tsx scripts/atlas-github-html-analytics.ts
      ```
    - ```bash
      DEBUG_LOGGING=1 npx tsx scripts/atlas-github-html-analytics.ts
      ```

- **scripts/atlas-json/generate-atlas-json-from-github.ts**: Parses the Sky Atlas HTML into a machine-friendly JSON array and writes `.output/atlas-github.json`.
  - Example:
    - ```bash
      npx tsx scripts/atlas-json/generate-atlas-json-from-github.ts
      ```
    - ```bash
      DEBUG_LOGGING=1 npx tsx scripts/atlas-json/generate-atlas-json-from-github.ts
      ```

- **scripts/atlas-json/generate-atlas-json-from-supabase.ts**: Exports current or past Atlas data from Supabase into `.output/supabase-github.json`.
  - Example:
    - ```bash
      npx tsx scripts/atlas-json/generate-atlas-json-from-supabase.ts
      ```
    - ```bash
      npx tsx scripts/atlas-json/generate-atlas-json-from-supabase.ts --validAt 2025-01-15T12:00:00Z
      ```

- **scripts/atlas-json/generate-atlas-json-from-blue-json.ts**: Parses hierarchical Blue JSON export from `.debug-data/blue.json`, flattens it into documents, and writes categorized JSON to `.output/atlas-blue.json`.
  - Example:
    - ```bash
      npx tsx scripts/atlas-json/generate-atlas-json-from-blue-json.ts
      ```
    - ```bash
      DEBUG_LOGGING=1 npx tsx scripts/atlas-json/generate-atlas-json-from-blue-json.ts
      ```

- **scripts/experiment.ts**: Finds Notion database entries with empty "Master Status" (skips "Category" where applicable).
  - Example:
    - ```bash
      npx tsx scripts/experiment.ts
      ```

- **scripts/get-notion-database-page-count.ts**: Prints the total number of pages in a given Notion database ID.
  - Example:
    - ```bash
      npx tsx scripts/get-notion-database-page-count.ts 00000000-0000-0000-0000-000000000000
      ```
    - ```bash
      npx tsx scripts/get-notion-database-page-count.ts --verbose 00000000-0000-0000-0000-000000000000
      ```

- **scripts/import-notion-databases.ts**: Imports all configured Notion databases into Supabase, with optional local Notion API caching.
  - Example:
    - ```bash
      npx tsx scripts/import-notion-databases.ts
      ```
    - ```bash
      npx tsx scripts/import-notion-databases.ts --verbose --local-cache
      ```

- **scripts/visualize-hierarchy.ts**: Loads Atlas pages from Supabase, builds the tree, and prints an ASCII or structured visualization.
  - Example:
    - ```bash
      npx tsx scripts/visualize-hierarchy.ts
      ```
    - ```bash
      npx tsx scripts/visualize-hierarchy.ts --ascii
      ```

Non-executable helper modules (imported by scripts):

- `scripts/atlas-json/types.ts` — shared types for JSON generation scripts
- `scripts/atlas-json/constants.ts` — output file paths and configuration constants
- `scripts/atlas-json/utils.ts` — document number comparison and prefix fixing utilities
- `scripts/utils/load-env.ts` — loads Next.js environment variables for scripts

**Important relationship note:** Do not use or rely on `parent_notion_page_id` to build the Atlas tree. It is not a reliable way to construct hierarchy. Instead, construct the tree by traversing the per-type `child_*` ID arrays (e.g., `child_article_ids`, `child_section_and_primary_doc_ids`) beginning from the two top-level Atlas databases' documents: `Scopes` and `Sections & Primary Docs` (see Atlas Document Hierarchy).
