# Trigger.dev Tasks

This directory contains Trigger.dev tasks for the Atlas Axis Notion Workflow project.

## Tasks

### `notion-full-atlas-import-task.ts`

- **ID**: `notion-database-import`
- **Purpose**: Imports all Atlas databases from Notion to Supabase
- **Duration**: Up to 60 minutes
- **Retries**: 1 attempt with exponential backoff

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
- **Concurrency**: 1 (only one sync can run at a time)
- **Features**:
  - Processes all change types: additions, deletions, content changes, parent changes
  - Real-time progress tracking via metadata
  - Graceful stopping via database flag
  - Audit logging for all Notion API operations
  - UUID mapping for newly created pages
- **Lock Table**: `markdown_notion_sync_lock` (6-hour expiry)
- **Metadata**: `{ phase, completed, total, currentDoc, succeeded, failed, skipped }`

## Usage

The scheduled task will automatically trigger the full Atlas import task every hour. This ensures that the Supabase database stays in sync with the latest changes from Notion.

## Development

To test the scheduled task locally, you can:

1. Run the Trigger.dev dev server: `npx trigger.dev dev`
2. The scheduled task will be available in the Trigger.dev dashboard
3. You can manually trigger it from the dashboard for testing

## Production

The scheduled task will automatically run in production once deployed using `npm run trigger:deploy`. No additional configuration is needed.
