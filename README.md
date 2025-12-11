# Atlas Axis Notion Workflow

A Next.js application that provides a complete data pipeline for managing the Atlas—a collection of internal rules and policies in the Sky crypto ecosystem. The **canonical Atlas** is stored as Markdown in a GitHub repository. **Notion serves as the editing and collaboration tool** where the Atlas is organized across 10 databases (~7,000 documents) for easier team editing. The system enables bidirectional synchronization between GitHub (canonical), Notion (editing), and Supabase PostgreSQL (central storage).

## 🛠️ Tech Stack

- **Next.js 16** with App Router, TypeScript, Node.js v22
- **HeroUI (NextUI)** + Tailwind CSS + Lucide React icons
- **Supabase** (PostgreSQL) - Cloud production, local dev via `npm run supabase:start`
- **Trigger.dev** - Background sync tasks
- **Vitest** - Testing framework

## 🔄 Main Workflows

### 1. Notion → Supabase Import

**Status**: ✅ Active (Hourly via Trigger.dev)

Imports Atlas documents from Notion databases to Supabase. Captures edits made by the team in Notion using intelligent delta sync, relationship mapping, and temporal versioning. Takes ~15 minutes for full sync.

**Access**: Automated hourly, or manual via `npx tsx scripts/import-notion-databases.ts`

### 2. Markdown → Notion Sync

**Status**: ⚠️ Under active development, almost complete, but don't use it yet (Manual via UI)

Syncs changes from the canonical GitHub Markdown back to the Notion editing environment. Enables external contributors to edit the canonical Markdown directly, with changes flowing back to Notion for the team.

**Access**: UI at `/atlas/sync` | Loads from: GitHub repo `pppdns/next-gen-atlas`

### 3. Export Atlas as File

**Status**: ✅ Active

Generates Atlas exports from Supabase in Markdown, JSON, or YAML formats. These exports can update the canonical GitHub Markdown or serve other purposes.

**Access**:

- Web API: `/api/atlas.md`, `/api/atlas.json`, `/api/atlas.yaml`
- CLI: `npx tsx scripts/atlas-export/generate-atlas-markdown.ts`

### 4. Atlas Portal (Viewer)

**Status**: ✅ Active

Interactive web viewer for browsing the Atlas hierarchy with search, filtering, and export capabilities. Displays data from Supabase (which mirrors Notion).

**Access**: UI at `/atlas`

### 5. Atlas Changelog

**Status**: ✅ Active

View historical changes to Atlas documents using Supabase's temporal versioning system.

**Access**: UI at `/atlas/changelog` | CLI: `npx tsx scripts/atlas-changelog.ts --since 1d`

### 6. Notion Nesting Bug Management

**Status**: ✅ Active

Password-protected UI for managing manual parent-child relationship corrections for Notion's sub-item bug at deep nesting levels.

**Access**: UI at `/atlas/notion-nesting-fix`

**Related**: [docs/NOTION_NESTING_BUG_FIX.md](./docs/NOTION_NESTING_BUG_FIX.md)

### 7. Edit Page Generation & Proposal Generation

**Status**: ❌ Obsolete (Prototypes only, will be reimplemented)

Original features for creating temporary Notion edit pages and generating human-readable diffs. Code exists but is not maintained or compatible with current architecture.

## 🗄️ Database Schema

### Core Tables

#### `notion_database_pages`

Stores Atlas documents with hierarchical relationships and temporal versioning.

**Key Fields**:

- `notion_page_id` (UUID, PK) - Notion page identifier
- `atlas_document_type` (ENUM) - Document type (Section, Core, Type Specification, etc.)
- `atlas_document_number` (TEXT) - Document number (e.g., "A.1.2.3")
- `atlas_database_name` (ENUM) - Database name (Scopes, Articles, etc.)
- `plain_text_content`, `json_content` - Page content
- `plain_text_name`, `json_name` - Page title
- `parent_notion_page_id` (UUID) - Internal parent for same-database nesting
- `child_*_ids` (JSONB arrays) - Child relationship arrays by type
- `extra_fields` (JSONB) - Type-specific extra fields
- `date_valid_from`, `date_valid_to` (TIMESTAMPTZ) - Temporal versioning

**Temporal Versioning**: Current rows have `date_valid_to IS NULL`. Uses `versioned_upsert_notion_database_pages` and `versioned_delete_notion_database_pages` RPC functions.

#### `notion_database_pages_current`

View filtering `notion_database_pages` to show only current, active rows (not archived, not in trash).

#### `uuid_mapping`

Bidirectional mappings between Notion page UUIDs and Atlas document UUIDs for stable references.

**See**: [docs/UUID_MAPPING.md](./docs/UUID_MAPPING.md)

#### `notion_nesting_bug_mapping`

Manual corrections for Notion's sub-item relationship bug at deep nesting levels.

**See**: [docs/NOTION_NESTING_BUG_FIX.md](./docs/NOTION_NESTING_BUG_FIX.md)

#### `notion_sync_status`

Manages sync state and prevents concurrent operations with lock expiration.

#### `import_logs`

Tracks Notion→Supabase imports with metrics (duration, changes, errors).

#### `notion_blocks`

Stores Notion page content as hierarchical blocks (used for Edit Pages feature - currently obsolete).

## 📋 Atlas

### Introduction

The **canonical Atlas** is stored in GitHub as Markdown (`pppdns/next-gen-atlas`). **Notion is the editing environment** where the Atlas is organized across 10 databases for team collaboration.

**Data Flow**: Notion edits → Supabase → Markdown export → GitHub (canonical). Changes to canonical GitHub can sync back to Notion.

### Atlas Databases & Document Types

**10 Databases**:

- **Scopes** - Scope documents
- **Articles** - Article documents
- **Sections & Primary Docs** - Section, Core, Type Specification, Active Data Controller
- **Annotations** - Annotation documents
- **Tenets** - Action Tenet documents
- **Scenarios** - Scenario documents
- **Scenario Variations** - Scenario Variation documents
- **Active Data** - Active Data documents
- **Agent Scope Database** - Core, Active Data Controller (agent-specific)
- **Needed Research** - Research items

### Document Hierarchy

```
Scopes
└── Articles
    ├── Sections & Primary Docs
    │   ├── Annotations
    │   └── Tenets
    │       └── Scenarios
    │           └── Scenario Variations
    └── Agent Scope Database
        ├── Annotations
        ├── Tenets
        │   └── Scenarios
        │       └── Scenario Variations
        └── Active Data

"Needed Research" documents may be nested under any document type
```

**Internal Nesting**: "Sections & Primary Docs" and "Agent Scope Database" support multi-level internal nesting.

**See**: [docs/ATLAS_DOCUMENT_NUMBERING_RULES.md](./docs/ATLAS_DOCUMENT_NUMBERING_RULES.md)

## 🧪 Testing (Vitest)

```bash
npm test                 # watch mode
npm run test:run         # single run (CI-friendly)
npm run test:coverage    # coverage report
npm run test:ui          # Vitest UI
```

- Config: `vitest.config.ts` (jsdom, globals, automatic JSX)
- Path alias `@/*` available in tests
- Examples: `app/shared/utils/__tests__/`, `app/atlas/__tests__/`

## 🚀 Getting Started

### Prerequisites

- Node.js v22+
- Docker
- Supabase API keys
- Notion API key(s)
- Vercel CLI (logged in, project linked)

### Installation

1. Clone repository
2. Pull environment variables: `vercel env pull .env.local`
3. Install dependencies: `npm install`
4. Start local Supabase services: `npm run supabase:start`
5. Run database migrations manually in Supabase (`app/server/database/*.sql`)
6. Start dev server: `npm run dev`
7. (Optional) Start Trigger.dev background processing: `npm run trigger:dev`

### Environment Variables

- `NOTION_API_KEY` - Notion integration key (comma-separated for load balancing)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_API_KEY` - Supabase API key
- `TRIGGER_SECRET_KEY` - Trigger.dev secret key
- `DEBUG_LOGGING` - Enable verbose logging

## 🧰 Command Line Scripts

All commands run from repository root using `npx tsx`.

### Atlas Data Import/Export

```bash
# Import Notion databases to Supabase
npx tsx scripts/import-notion-databases.ts
npx tsx scripts/import-notion-databases.ts --verbose --local-cache

# Export Atlas to Markdown
npx tsx scripts/atlas-export/generate-atlas-markdown.ts

# Export Atlas to JSON
npx tsx scripts/atlas-export/generate-atlas-json.ts
```

### Atlas Validation & Analysis

```bash
# Validate Atlas Markdown
npx tsx scripts/validate-atlas-markdown.ts
npx tsx scripts/validate-atlas-markdown.ts exported-atlas/atlas.md --verbose

# Validate Atlas JSON
npx tsx scripts/validate-atlas-json.ts
npx tsx scripts/validate-atlas-json.ts path/to/atlas.json

# View changelog
npx tsx scripts/atlas-changelog.ts --since 1d
```

### Notion Database Utilities

```bash
# Create test databases
npx tsx scripts/create-test-notion-databases.ts
npx tsx scripts/create-test-notion-databases.ts --delete-existing

# Generate UUID mappings
npx tsx scripts/generate-uuid-mapping.ts
```

## 📚 Documentation

### Core Documentation

- **[AGENTS.md](./AGENTS.md)** - Complete AI agent documentation (authoritative)
- **README.md** - This file (human-readable overview)

### Architecture & Concepts

- [docs/ATLAS_TREE_STRUCTURES.md](./docs/ATLAS_TREE_STRUCTURES.md) - Dual tree architecture (Notion Tree vs Export Tree)
- [docs/ATLAS_DATA_PIPELINE.md](./docs/ATLAS_DATA_PIPELINE.md) - Complete data pipeline overview
- [docs/UUID_MAPPING.md](./docs/UUID_MAPPING.md) - UUID mapping system
- [docs/ATLAS_DOCUMENT_NUMBERING_RULES.md](./docs/ATLAS_DOCUMENT_NUMBERING_RULES.md) - Document numbering rules
- [docs/ATLAS_EXTRA_FIELDS.md](./docs/ATLAS_EXTRA_FIELDS.md) - Extra fields for Type Specs, Scenarios, etc.
- [docs/NOTION_PROPERTY_MAPPING.md](./docs/NOTION_PROPERTY_MAPPING.md) - Property/relationship mappings

### Data Formats & Workflows

- [docs/ATLAS_MARKDOWN_SYNTAX.md](./docs/ATLAS_MARKDOWN_SYNTAX.md) - Markdown syntax specification
- [docs/ATLAS_MARKDOWN_IMPORT_EXPORT.md](./docs/ATLAS_MARKDOWN_IMPORT_EXPORT.md) - Import/export workflows
- [docs/MARKDOWN_TO_NOTION_SYNC.md](./docs/MARKDOWN_TO_NOTION_SYNC.md) - Markdown→Notion sync workflow
- [docs/NOTION_IMPORT_PROCESS.md](./docs/NOTION_IMPORT_PROCESS.md) - Notion→Supabase import process

### Notion Integration

- [docs/NOTION_EMBEDS.md](./docs/NOTION_EMBEDS.md) - Iframe compatibility guide
- [docs/NOTION_NESTING_BUG_FIX.md](./docs/NOTION_NESTING_BUG_FIX.md) - Nesting bug workaround

### Implementation Guides

- [app/atlas/sync/AGENTS.md](./app/atlas/sync/AGENTS.md) - Markdown→Notion sync implementation
- [app/server/atlas/notion-tree/AGENTS.md](./app/server/atlas/notion-tree/AGENTS.md) - Atlas tree algorithms
- [app/server/services/trigger/AGENTS.md](./app/server/services/trigger/AGENTS.md) - Trigger.dev tasks
- [app/notion-api-key-testing/AGENTS.md](./app/notion-api-key-testing/AGENTS.md) - API key testing

### Obsolete (Reference Only)

- [docs/EDIT_PAGE_GENERATION_USAGE.md](./docs/EDIT_PAGE_GENERATION_USAGE.md) - ❌ Edit Pages guide (feature obsolete)
- [app/server/atlas/README.md](./app/server/atlas/README.md) - ❌ Proposal generator (feature obsolete)

## 🚧 Future Features

- Reimplementation of Edit Page generation with updated architecture
- Reimplementation of Proposal Generation (human-readable diffs)
- Automated webhook-based sync triggers (GitHub Markdown → Notion)
