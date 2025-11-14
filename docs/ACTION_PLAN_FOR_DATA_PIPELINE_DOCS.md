# Create ATLAS_DATA_PIPELINE.md Documentation

Create a new documentation file `docs/ATLAS_DATA_PIPELINE.md` that provides a comprehensive overview of the Atlas data pipeline, covering both Notion → Supabase → Markdown and Markdown → Notion workflows.

## Document Structure

### 1. Overview Section

- Brief introduction to the Atlas data pipeline
- Purpose and scope of the pipeline
- Two main workflows: Notion → Supabase → Markdown and Markdown → Notion (planned)

### 2. Comprehensive ASCII Flowchart

- Detailed vertical flowchart showing the complete pipeline with all major stages
- Annotate each stage with key transformations and workarounds:
- Property/relationship mapping (Notion properties & relationships → Supabase fields)
- UUID generation (new pages)
- Agent nesting rewrite (root agents → under section)
- Nesting bug fixes (manual parent-child remapping)
- Tree construction (flat pages → hierarchical tree)
- Direct children filtering (remove nested descendants)
- Duplicate/cycle detection
- Document number generation
- UUID mapping (Notion page UUID → Atlas document UUID)
- Mention updates (stale doc numbers → current)
- Link label rewriting
- Rich Text → Markdown conversion
- Export Tree transformation
- Keep annotations brief (1-3 words), detailed explanations in sections below
- Show bidirectional flow (Notion ↔ Supabase ↔ Markdown)
- Mark future/planned features clearly with notation like [PLANNED]

### 3. Notion → Supabase → Markdown Pipeline

#### 3.1 Import from Notion

- Fetching via Notion API (reference `import-database-to-supabase.ts`)
- Automated execution: Runs hourly on Trigger.dev, takes ~15 minutes to complete
- Property and relationship mapping (reference `notion-database-properties-and-relationships.ts`)
- In-database and inter-database relationships
- Sync locking mechanism
- Change detection (new, deleted, modified pages)

#### 3.2 Storage in Supabase

- Versioned row storage (temporal tables)
- UUID mapping generation for new pages (reference `UUID_MAPPING.md`)
- Batched inserts and updates

#### 3.3 Loading from Supabase

- Loading pages grouped by Atlas database (reference `load-atlas-from-supabase.ts`)
- Current vs historical data loading

#### 3.4 Pre-Processing Workarounds

- Agent nesting: Root Agent Scope Database documents under section (reference `AGENT_ROOT_SECTION_UUID_FOR_NESTING`, `nest-root-agent-documents-under-agent-section.ts`)
- Nesting bug fix: Manual parent-child rewriting (reference `NOTION_NESTING_BUG_FIX.md`)

#### 3.5 Tree Construction

- Building Notion Tree from flat pages (reference `ATLAS_TREE_STRUCTURES.md` and notion-tree `AGENTS.md`)
- Lookup maps for O(1) access
- Filtering direct children vs nested descendants (reference filterDirectChildren logic)
- Duplicate detection and removal
- Circular reference detection
- Orphaned node identification

#### 3.6 Tree Processing

- Document number generation from hierarchy and document type conventions
- UUID mapping: Notion page UUID → Atlas document UUID (reference `UUID_MAPPING.md`)
- Rich text mention updates with current document numbers
- Document name normalization

#### 3.7 Export Transformation

- Notion Tree → Export Tree conversion
- Rich text to markdown conversion (`json_content` → `content`)
- Link label rewriting to match generated document numbers
- Extra fields handling for specific document types

#### 3.8 Export Formats

- Markdown export (reference `ATLAS_MARKDOWN_IMPORT_EXPORT.md`)
- JSON export
- API endpoints serving exports

### 4. Markdown → Notion Pipeline (Planned/In Progress)

#### 4.1 External Markdown Editing

- Central GitHub repository workflow
- Markdown-first editing by organization members
- Validation with `validate-atlas-markdown.ts`

#### 4.2 Markdown Import

- Parsing Atlas markdown to Export Tree
- Validation and error detection

#### 4.3 Notion Sync

- Converting Export Tree to Notion pages
- Creating/updating/deleting pages via Notion API
- Relationship establishment
- Property building with correct types

#### 4.4 Automated Sync

- Hourly Trigger.dev task for Notion → Supabase sync
- Future: Trigger sync after markdown changes

### 5. Key Transformations Summary

Table format showing:

- Stage → Input Format → Transformation → Output Format

### 6. Workarounds and Special Cases

- Agent document nesting rationale
- Notion nesting bug and manual mappings
- Direct children filtering for deeply nested Core documents
- Duplicate handling policies (Needed Research, Tenets, others)

### 7. Related Documentation

Links to all referenced documentation files with brief descriptions

## Content Guidelines

- Keep descriptions compact and reference-focused
- No code examples (as requested)
- Use tables and lists for clarity
- Mark future features clearly with [PLANNED] notation
- Create thorough but compact ASCII flowchart with brief annotations
- Cross-reference existing documentation extensively
