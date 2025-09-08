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
- `root_notion_block_id` (UUID, NOT NULL) - The Notion page ID this block belongs to
- `block_type` (TEXT, NOT NULL) - Block type: paragraph, heading_1, heading_2, etc.
- `has_children` (BOOLEAN) - Whether the block contains nested blocks
- `plain_text_content` (TEXT) - Extracted plain text for searching/display
- `json_content` (JSONB) - Full rich content from Notion API
- `sort_order` (INTEGER, NOT NULL) - Position within parent (0-indexed)
- `canonical_document_title` (TEXT) - Atlas document identifier (e.g., "A.2.3.21 Some Document")

**Edit Page Fields:**

- `belongs_to_edit_page` (BOOLEAN, DEFAULT TRUE) - Whether this is an edit copy
- `edit_page_original_notion_block_id` (UUID) - Links to original block being edited
- `edit_page_original_notion_page_id` (UUID) - Links to original page being edited

#### `notion_database_pages`

Stores Notion database pages and their hierarchical relationships.

**Key Fields:**

- `notion_page_id` (UUID, PRIMARY KEY) - Notion's unique page identifier
- `parent_notion_page_id` (UUID) - Parent page ID, NULL for root database pages
- `root_notion_database_id` (UUID, NOT NULL) - The root database this page belongs to
- `page_type` (TEXT, NOT NULL) - Page type
- `has_children` (BOOLEAN) - Whether page has sub-items in the database
- `plain_text_content` (TEXT) - Page content as plain text
- `json_content` (JSONB) - Rich content from Notion API
- `plain_text_name` (TEXT) - Page title as plain text
- `json_name` (JSONB) - Rich text page title from Notion API
- `sort_order` (INTEGER, NOT NULL) - Position of sub item within parent (0-indexed)
- `canonical_document_title` (TEXT) - Atlas document identifier

#### `notion_sync_status`

Manages synchronization state and prevents concurrent syncs of the same content.

**Key Fields:**

- `id` (UUID, PRIMARY KEY) - Internal ID
- `notion_page_id` (UUID, NOT NULL, UNIQUE) - Page/database being synced
- `sync_status` (TEXT, NOT NULL) - Status: 'pending', 'in_progress', 'completed', 'failed', 'cancelled'
- `last_sync_started_at` (TIMESTAMPTZ) - When sync began
- `last_sync_completed_at` (TIMESTAMPTZ) - When sync succeeded
- `sync_error_message` (TEXT) - Error details if failed
- `is_sync_locked` (BOOLEAN) - Prevents concurrent syncs

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

### Trigger.dev Tasks (`/app/server/services/trigger`)

- `notion-sync-task.ts` - Background sync with retry logic
- Tracks Notion API call counts via metadata

## 🎨 UI Components

### Embed Pages (`/app/embed`)

Embeddable as iframes within Notion pages:

- `create-edit-page/[notion-page-id]` - UI for creating edit pages
- `diff` - Displays content differences
- Compatible with web browsers, Mac OS Notion app, not iOS/iPad Notion app

### Internal Pages For Testing

- `/import` - Manual sync triggers for pages/databases (development)
- `/visualize` - Tree visualization of content structure (development)
- `/notion-api-key-testing` - Validate Notion API keys, retries, and rate limits (development)
- `/markdown` - Preview generated markdown output (development)
- `/test-edit-database` - Create and test edit databases (development)
- `/test-edit-page` - Create and test edit pages (development)

## 🔄 Important Patterns

### Edit Page Workflow

1. Original blocks/pages have `belongs_to_edit_page = false`
2. Edit page blocks/pages have `belongs_to_edit_page = true`
3. Edit blocks reference original via `edit_page_original_notion_block_id`
4. Edit pages reference original top level (root) page/database via `edit_page_original_notion_page_id`/`edit_page_original_notion_database_id`
5. Enables efficient querying and comparison using tree comparison algorithms and tree shaking

### Sync Locking

- Prevents concurrent syncs of same content
- Locks expire after 30 minutes - automatic cleanup in error state
- Verified before each sync operation

## 🚧 Future Features

- Two-way Notion sync (not just import)
- Automated Edit Page sync when changes happen
- Human-readable Atlas Edit Proposal generation (showaggregate diffs from multiple edit pages)
- Automated background sync triggers
- Group diffs by Atlas scope and agent
- Unit tests, E2E tests
- Git hooks for linting

## 📚 Documentation

### Core Documentation Files

- **[docs/CREATE_EDIT_DATABASE.md](./docs/CREATE_EDIT_DATABASE.md)** - Documentation for creating edit databases and duplicate Notion pages functionality
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
