# Trigger.dev Tasks

This directory contains Trigger.dev tasks for the Atlas Axis Notion Workflow project.

## Shared Queue

### `notion-import-queue.ts`

- **Queue Name**: `notion-import`
- **Concurrency Limit**: 1
- **Purpose**: Shared queue for all Notion import tasks to prevent race conditions

Both the full import task and partial import task use this queue, ensuring only one import runs at a time. If the hourly scheduled import is running when a partial import is triggered (after Markdown sync), the partial import automatically waits in queue.

## Tasks

### `notion-full-atlas-import-task.ts`

- **ID**: `notion-database-import`
- **Purpose**: Imports all Atlas databases from Notion to Supabase
- **Duration**: Up to 60 minutes
- **Retries**: 1 attempt with exponential backoff
- **Queue**: `notion-import` (shared queue with concurrencyLimit: 1)

### `notion-partial-atlas-import-task.ts`

- **ID**: `notion-partial-atlas-import`
- **Purpose**: Imports only specified databases from Notion to Supabase
- **Duration**: Up to 60 minutes
- **Retries**: 1 attempt with exponential backoff
- **Queue**: `notion-import` (shared queue with concurrencyLimit: 1)
- **Payload**: `{ databases: AtlasDatabaseName[] }`
- **Usage**: Automatically triggered after Markdown-to-Notion sync to import only affected databases

### `hourly-notion-sync-schedule.ts`

- **ID**: `hourly-notion-import`
- **Purpose**: Scheduled task that runs the full Atlas import hourly
- **Schedule**: `0 * * * *` (cron format - hourly at minute 0)
- **Timezone**: UTC
- **Exports**: `hourlyNotionImportSchedule`

### `markdown-notion-sync-task.ts`

- **ID**: `markdown-notion-sync`
- **Purpose**: Syncs changes from Atlas Markdown to Notion databases
- **Duration**: Up to 6 hours (max duration)
- **Concurrency**: 1 (only one sync can run at a time, enforced via lock)
- **Architecture**: Delegates business logic to `@/app/server/services/markdown-notion-sync/`
- **Features**:
  - Processes all change types: additions, deletions, content changes, parent changes
  - Real-time progress tracking via metadata
  - Graceful stopping via database flag
  - Audit logging for all Notion API operations
  - UUID mapping for newly created pages
  - Depth-first ordering of additions (parents before children)
  - Parent validation before creating/updating relationships
  - **Automatic Notion import chaining**: After sync completes, triggers `notion-partial-atlas-import` for affected databases
- **Lock Table**: `markdown_notion_sync_lock` (6-hour expiry)
- **Metadata**: `{ phase, completed, total, currentDoc, succeeded, failed, skipped }`
- **Phases**: `initializing` → `content` → `additions` → `mention_updates` → `deletions` → `parent_changes` → `notion_import` → `completed`

#### Architecture

The task is split into two parts:

1. **Task file** (`markdown-notion-sync-task.ts`): Handles Trigger.dev orchestration
   - Lock acquisition/release
   - Metadata updates for real-time UI
   - Loading diff and UUID mappings
   - Error handling and cleanup
   - **Chaining the partial import task** after sync completes

2. **Sync service** (`app/server/services/markdown-notion-sync/`): Contains business logic
   - `types.ts` - Shared types
   - `sync-helpers.ts` - Utility functions (validation, sorting, formatting)
   - `sync-operations.ts` - Core CRUD operations (create, update, delete, parent updates)
   - `sync-orchestrator.ts` - Main sync logic (processes changes in 5 phases, returns affected databases)
   - `index.ts` - Public API exports

This separation keeps the Trigger.dev task file focused on orchestration while the sync service handles all sync-specific logic, making both more maintainable and testable.

#### Automatic Notion Import Chaining

After the Markdown-to-Notion sync completes successfully, the task automatically triggers a Notion-to-Supabase import for only the databases that were affected by the sync:

1. **Track Affected Databases**: The sync orchestrator tracks which databases had successful operations (content changes, additions, deletions, parent changes)
2. **Trigger Partial Import**: Uses `triggerAndWait` to call `notion-partial-atlas-import` with the list of affected databases
3. **Queue Management**: The partial import uses the shared `notion-import` queue with `concurrencyLimit: 1`, so if the hourly full import is running, it automatically waits
4. **Lock Held Until Complete**: The Markdown sync lock is held throughout the entire operation (including import) to prevent data inconsistency from overlapping sync operations
5. **UI Feedback**: The `notion_import` phase is shown in the UI while import runs

This ensures changes made to Notion are immediately imported back to Supabase without waiting for the next hourly sync.

## Usage

The scheduled task will automatically trigger the full Atlas import task every hour. This ensures that the Supabase database stays in sync with the latest changes from Notion.

## Development

To test the scheduled task locally, you can:

1. Run the Trigger.dev dev server: `npx trigger.dev dev`
2. The scheduled task will be available in the Trigger.dev dashboard
3. You can manually trigger it from the dashboard for testing

## Production

The scheduled task will automatically run in production once deployed using `npm run trigger:deploy`. No additional configuration is needed.
