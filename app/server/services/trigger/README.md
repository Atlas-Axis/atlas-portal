# Trigger.dev Tasks

This directory contains Trigger.dev tasks for the Atlas Axis Notion Workflow project.

## Tasks

### `notion-full-atlas-import-task.ts`

- **ID**: `notion-database-import`
- **Purpose**: Imports all Atlas databases from Notion to Supabase
- **Duration**: Up to 60 minutes
- **Retries**: 2 attempts with exponential backoff

### `daily-notion-import-schedule.ts`

- **ID**: `daily-notion-import`
- **Purpose**: Scheduled task that runs the full Atlas import hourly
- **Schedule**: `0 * * * *` (cron format)
- **Timezone**: UTC

## Usage

The scheduled task will automatically trigger the full Atlas import task every hour. This ensures that the Supabase database stays in sync with the latest changes from Notion.

## Development

To test the scheduled task locally, you can:

1. Run the Trigger.dev dev server: `npx trigger.dev dev`
2. The scheduled task will be available in the Trigger.dev dashboard
3. You can manually trigger it from the dashboard for testing

## Production

The scheduled task will automatically run in production once deployed using `npm run trigger:deploy`. No additional configuration is needed.
