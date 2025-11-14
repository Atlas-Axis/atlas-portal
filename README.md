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
- **Node.js** (v22)

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

## 🧪 Testing (Vitest)

This project uses Vitest with jsdom and React Testing Library.

- Config: `vitest.config.ts` (jsdom env, globals, coverage via v8, automatic JSX)
- Setup: `vitest.setup.ts` (registers `@testing-library/jest-dom/vitest`)
- Path alias: `@/*` works in tests (matches project tsconfig)
- Example tests:
  - Unit: `app/shared/utils/__tests__/utils.test.ts`
  - Component: `app/atlas/__tests__/type-chip.test.tsx`

Scripts:

```bash
npm test                 # watch mode
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

Tips:

- Automatic JSX is enabled; you do not need to `import React` in tests.
- Default environment is `jsdom`. For Node-only tests add at the top of a file:
  `// @vitest-environment node`
- Prefer Testing Library patterns: `render`, `screen`, and user interactions from `@testing-library/user-event`.
- To mock Next.js modules (e.g., navigation), you can use:
  ```ts
  vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
  ```
- To mock global fetch:
  ```ts
  vi.stubGlobal('fetch', vi.fn());
  ```

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
- `atlas_document_type` (ENUM, NOT NULL) - Page type. Enum values: 'Section', 'Core', 'Type Specification', 'Active Data Controller', 'Spell SP Controller', 'Action Tenet', 'Active Data', 'Annotation', 'Scope', 'Article', 'Scenario', 'Scenario Variation', 'Needed Research'.
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
- `created_at` (TIMESTAMPTZ) - Database row creation time
- `updated_at` (TIMESTAMPTZ)
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

- `extra_fields` (JSONB) – Additional fields stored as JSON key-value pairs, defaults to empty object. This is used to store extra fields related to some Atlas document types (Type Specification, Scenario, Scenario Variation)

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

## 📋 Atlas

### Introduction to Atlas

The Atlas is a large, hierarchical body of interlinked legal documents maintained in a set of Notion databases (the "Master Atlas DBs"). Each Atlas entry has a specific document type and lives in a database that matches that type. General rule: every document type has its own database. Exception #1: The database named `Sections & Primary Docs` contains four document types: `Section`, `Core`, `Type Specification`, and `Active Data Controller`. Exception #2: The database named `Agent Scope Database` contains two document types: `Core`, `Active Data Controller`.

### Document Type Categories

- **Immutable Documents**: Scopes, Articles, Sections
- **Primary Documents**: Core, Active Data Controller
- **Supporting Documents**: Active Data, Annotation, Needed Research, Action Tenet, Scenario, Scenario Variation
  - Supporting Documents must always have a Target Document, which is an Immutable or Primary Document they attach to (for example, `Active Data` attaches to an `Active Data Controller`). The Target Document can also be referred to as the parent document.

### Atlas Database Names & Document Types

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
- **Action Tenet** - Action-oriented tenet documents
- **Active Data** - Active data items
- **Annotation** - Annotation items
- **Scope** - Scope items
- **Article** - Article items
- **Scenario** - Scenario items
- **Scenario Variation** - Individual scenario variations
- **Needed Research** - Research items

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

See Atlas Document Numbering rules: **[docs/ATLAS_DOCUMENT_NUMBERING_RULES.md](./docs/ATLAS_DOCUMENT_NUMBERING_RULES.md)**.

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
│       └── Supporting Documents: TODO: Fix in all 3 Core Project Docs - Supporting Documents can be nested under any Primary Document
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

### Atlas Business Logic (`/app/server/atlas`)

- `generate-atlas-json.ts` - Generates JSON representation of Atlas hierarchy
- `generate-proposal.ts` - Generates human-readable diffs
- Canonical document titles (e.g., "A.2.3.21 Some Document") represent hierarchical position

#### Atlas Configuration Files

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
   - Agent root UUIDs are properly set for tests that check agent ancestry
2. **Development/QA**: Uses `notion-ids-dev.ts` when `USE_DEV_NOTION_IDS === 'true'`
   - Separate dev/QA IDs prevent accidental access to production data during local development and manual QA
   - Must be explicitly set to 'true' to enable
3. **Production** (lowest priority, default): Uses `notion-ids.ts` (real IDs) when `USE_DEV_NOTION_IDS !== 'true'`
   - Real Notion database and page IDs for production use
   - This is the default when USE_DEV_NOTION_IDS is not set or set to any value other than 'true'

This three-tier system ensures:

- Unit tests use consistent made-up UUIDs that don't require real credentials
- Development and manual QA environments use separate IDs when explicitly opted-in via `USE_DEV_NOTION_IDS='true'`
- Production uses real production Notion IDs by default (safe default)
- Explicit control via `USE_DEV_NOTION_IDS` environment variable

### Notion Database Property Mapping (`/app/server/atlas`)

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

- `/atlas` - Hierarchy view of Atlas documents stored in Supabase. Similar to Atlas Explorer (https://sky-atlas.io)
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

This project maintains **2 synchronized documentation files** that provide high-level project overviews:

- **[README.md](./README.md)** - Human-readable project documentation (this file)
- **[.cursorrules](./.cursorrules)** - AI agent documentation for Cursor IDE

⚠️ **Important**: When updating high-level project information, **always update all 2 files** to keep them synchronized. Reference these collectively as the "**Core Project Documentation**" files.

### Atlas Architecture & Core Concepts

- **[docs/UUID_MAPPING.md](./docs/UUID_MAPPING.md)** - UUID mapping system that maintains bidirectional mappings between Notion page UUIDs and Atlas document UUIDs
- **[docs/ATLAS_DOCUMENT_NUMBERING_RULES.md](./docs/ATLAS_DOCUMENT_NUMBERING_RULES.md)** - Comprehensive rules for Atlas document numbering, hierarchy, and relationships
- **[docs/ATLAS_EXTRA_FIELDS.md](./docs/ATLAS_EXTRA_FIELDS.md)** - Documentation for extra fields in Atlas documents (Type Specifications, Scenarios, Scenario Variations)
- **[docs/ATLAS_DIFFING.md](./docs/ATLAS_DIFFING.md)** - Tree diffing algorithms and change detection for Atlas documents

### Atlas Data Formats & Export

- **[docs/ATLAS_MARKDOWN_SYNTAX.md](./docs/ATLAS_MARKDOWN_SYNTAX.md)** - Markdown syntax specification for Atlas document representation
- **[docs/ATLAS_MARKDOWN_IMPORT_EXPORT.md](./docs/ATLAS_MARKDOWN_IMPORT_EXPORT.md)** - Import/export workflows for converting between Notion and Markdown formats

### Edit Pages & Workflows

- **[docs/EDIT_PAGE_GENERATION_USAGE.md](./docs/EDIT_PAGE_GENERATION_USAGE.md)** - Guide for creating and managing Edit Pages in Notion
- **[docs/NOTION_EDIT_PAGES_WITH_TOGGLE_BLOCKS_ACTION_PLAN.md](./docs/NOTION_EDIT_PAGES_WITH_TOGGLE_BLOCKS_ACTION_PLAN.md)** - Action plan for handling toggle blocks in Edit Pages

### Notion Integration

- **[docs/NOTION_EMBEDS.md](./docs/NOTION_EMBEDS.md)** - Compatibility guide for embedded iframes across Notion platforms (web vs native apps)
- **[docs/NOTION_NESTING_BUG_FIX.md](./docs/NOTION_NESTING_BUG_FIX.md)** - Manual workaround for Notion's sub-item relationship bug at deep nesting levels

### Action Plans & Future Features

- **[docs/ACTION_PLAN_FIX_AGENT_DUPLICATE_DETECTION.md](./docs/ACTION_PLAN_FIX_AGENT_DUPLICATE_DETECTION.md)** - Action plan for fixing agent duplicate detection issues

### Component & Service Documentation

- **[app/server/atlas/README.md](./app/server/atlas/README.md)** - Documentation for the Atlas proposal generator that converts TreeChange[] to formatted Atlas proposal markdown _(planned)_
- **[app/atlas/sync/README.md](./app/atlas/sync/README.md)** - Markdown to Notion synchronization workflow that enables pushing Atlas changes from Markdown format back to Notion databases _(planned)_

## 🚀 Getting Started

### Prerequisites

- Node.js (v22 or higher)
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
- `USE_DEV_NOTION_IDS` - When set to `'true'`, uses dev Notion IDs instead of production IDs. Defaults to `false` (production IDs) when not set. Useful for development and manual QA to prevent accidental production data access
- `DEBUG_LOGGING` - When set, console logs will be verbose

## 🧰 Command line scripts

All commands are intended to be run from the repository root using tsx.

### Atlas Data Import/Export

- **scripts/import-notion-databases.ts**: Imports all configured Notion databases into Supabase, with optional local Notion API caching.
  - Examples:
    - ```bash
      npx tsx scripts/import-notion-databases.ts
      ```
    - ```bash
      npx tsx scripts/import-notion-databases.ts --verbose --local-cache
      ```

- **scripts/atlas-export/generate-atlas-json.ts**: Builds standardized Atlas trees from Supabase and exports to JSON format. Output: `.debug-data/standardized-atlas/atlas.json`
  - Example:
    - ```bash
      npx tsx scripts/atlas-export/generate-atlas-json.ts
      ```

- **scripts/atlas-export/generate-atlas-markdown.ts**: Builds standardized Atlas trees from Supabase and exports to Markdown format. Output: `.debug-data/standardized-atlas/atlas.md`
  - Example:
    - ```bash
      npx tsx scripts/atlas-export/generate-atlas-markdown.ts
      ```

- **scripts/atlas-export/convert-atlas-markdown-to-json.ts**: Parses Atlas Markdown file and converts it to JSON format. Input: `.debug-data/standardized-atlas/atlas.md`, Output: `.debug-data/standardized-atlas/markdown-to-json.json`
  - Example:
    - ```bash
      npx tsx scripts/atlas-export/convert-atlas-markdown-to-json.ts
      ```

- **scripts/atlas-export/json-to-yaml.ts**: Converts JSON files to YAML format. Defaults to Atlas JSON if no input file provided.
  - Examples:
    - ```bash
      npx tsx scripts/atlas-export/json-to-yaml.ts
      ```
    - ```bash
      npx tsx scripts/atlas-export/json-to-yaml.ts path/to/file.json
      ```
    - ```bash
      npx tsx scripts/atlas-export/json-to-yaml.ts --help
      ```

### Atlas Validation & Analysis

- **scripts/validate-atlas-markdown.ts**: Validates Atlas Markdown files for syntax errors and structural issues. Checks title line format, heading level progression, document numbering, extra fields, UUID uniqueness, and parent-child relationships.
  - Examples:
    - ```bash
      npx tsx scripts/validate-atlas-markdown.ts
      ```
    - ```bash
      npx tsx scripts/validate-atlas-markdown.ts .debug-data/atlas.md
      ```
    - ```bash
      npx tsx scripts/validate-atlas-markdown.ts --verbose
      ```

- **scripts/validate-atlas-json.ts**: Validates standardized Atlas JSON files for structural integrity and consistency. Defaults to `.debug-data/standardized-atlas/atlas.json` if no file path provided.
  - Examples:
    - ```bash
      npx tsx scripts/validate-atlas-json.ts
      ```
    - ```bash
      npx tsx scripts/validate-atlas-json.ts path/to/atlas.json
      ```

- **scripts/atlas-changelog.ts**: Prints a human-readable change log of Atlas documents since a time window.
  - Examples:
    - ```bash
      npx tsx scripts/atlas-changelog
      ```
    - ```bash
      npx tsx scripts/atlas-changelog --since 1d --max-line-length 120
      ```

### Notion Database Utilities

- **scripts/get-notion-database-page-count.ts**: Prints the total number of pages in a given Notion database ID.
  - Examples:
    - ```bash
      npx tsx scripts/get-notion-database-page-count.ts 00000000-0000-0000-0000-000000000000
      ```
    - ```bash
      npx tsx scripts/get-notion-database-page-count.ts --verbose 00000000-0000-0000-0000-000000000000
      ```

- **scripts/create-test-notion-databases.ts**: Creates test versions of all Atlas databases in Notion for safe testing of Markdown→Notion sync automation. All test databases are created with [TEST] prefix.
  - Examples:
    - ```bash
      npx tsx scripts/create-test-notion-databases.ts
      ```
    - ```bash
      npx tsx scripts/create-test-notion-databases.ts --delete-existing
      ```

- **scripts/generate-uuid-mapping.ts**: Generates UUID mappings for all current Notion database pages. Reads from `notion_database_pages` and inserts into `uuid_mapping` table.
  - Example:
    - ```bash
      npx tsx scripts/generate-uuid-mapping.ts
      ```

### Utility Scripts

- **scripts/agent-notification.ts**: Sends notification when AI agent completes a task (internal utility).

Non-executable helper modules (imported by scripts):

- `scripts/atlas-export/utils.ts` — document number comparison and prefix fixing utilities
- `scripts/utils/load-env.ts` — loads Next.js environment variables for scripts

**Important relationship note:** Do not use or rely on `parent_notion_page_id` to build the Atlas tree. It is not a reliable way to construct hierarchy. Instead, construct the tree by traversing the per-type `child_*` ID arrays (e.g., `child_article_ids`, `child_section_and_primary_doc_ids`) beginning from the two top-level Atlas databases' documents: `Scopes` and `Sections & Primary Docs` (see Atlas Document Hierarchy).

## Critical Edge Cases: Child Relationship Arrays

**CRITICAL: Core Document Filtering Logic**

The `child_section_and_primary_doc_ids` and `child_agent_scope_ids` arrays present complex filtering challenges for nested Core documents:

1. **The Child Array Problem**: When a Section contains nested Core documents (Core → Core → Core), ALL nested Core document IDs appear in the parent Section's `child_section_and_primary_doc_ids` array, not just direct children.

2. **Filtering Challenge**: The `filterDirectChildren` function must distinguish between:
   - **Direct children** (Core documents that should be immediate children of the Section)
   - **Nested descendants** (Core documents that are descendants of other Core documents)

3. **The Solution (Generalized Direct-Child Rules)**:
   - Cross-database parent → child in an internally nested database: keep only if child.parent_notion_page_id is null.
   - Same internally nested database (Sections & Primary Docs, Agent Scope Database): keep only if child.parent_notion_page_id === parentPageId.
   - This applies to all document types in those databases (not just Core/Active Data Controller).

4. **Implementation Requirements**:
   - Pass `parentPageId` to `filterDirectChildren` and decide directness using the rules above (no ancestry walk needed).
   - Keep defensive cycle guards and depth caps in code paths that traverse relations.

5. **Real-World Impact**: Without proper filtering, nested documents appear under both parent and grandparent. With these rules, only direct children remain.

**Duplicates Policy**:

- Needed Research: duplicates across multiple parents are allowed; log as info.
- Tenets (Action Tenet): duplicates are allowed; log a warning.
- Others: duplicates indicate a modeling issue; filtering should prevent these.

**Agent Scope Database**: Follows the same direct-child rules for all types.
