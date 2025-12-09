import { schedules } from '@trigger.dev/sdk';
import { notionFullAtlasImportTask } from './notion-full-atlas-import-task';

export const hourlyNotionImportSchedule = schedules.task({
  id: 'hourly-notion-import',
  cron: '0 * * * *', // Hourly at minute 0
  // cron: '0 0 1 1 *', // Monthly at 1st day of the month at midnight
  run: async (payload) => {
    console.log(`🕐 Hourly Atlas import triggered at ${payload.timestamp.toISOString()}`);

    // Trigger the full Atlas import task
    const result = await notionFullAtlasImportTask.triggerAndWait({});

    if (result.ok) {
      console.log('✅ Hourly Atlas import completed successfully');
      console.log(`📊 Total API calls: ${result.output.totalApiCalls}`);
      console.log(
        `📈 Databases with changes: ${result.output.changesSummary.databasesWithChanges}/${result.output.changesSummary.totalDatabases}`,
      );

      return {
        success: true,
        timestamp: payload.timestamp,
        syncResult: result.output,
      };
    } else {
      const errorMessage = result.error instanceof Error ? result.error.message : 'Unknown error';
      console.error('❌ Hourly Atlas import failed:', result.error);
      throw new Error(`Hourly import failed: ${errorMessage}`);
    }
  },
});
