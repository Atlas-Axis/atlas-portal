import { queue } from '@trigger.dev/sdk/v3';

/**
 * Shared queue for Notion import tasks.
 * Ensures only one import task runs at a time to prevent race conditions
 * between the hourly scheduled import and on-demand partial imports.
 */
export const notionImportQueue = queue({
  name: 'notion-import',
  concurrencyLimit: 1, // Only one import at a time
});
