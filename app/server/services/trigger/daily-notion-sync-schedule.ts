import { schedules } from '@trigger.dev/sdk';
import { notionFullAtlasImportTask } from './notion-full-atlas-import-task';

export const dailyNotionImportSchedule = schedules.task({
  id: 'daily-notion-import',
  cron: '0 4 * * *', // Daily at 4:00 AM UTC
  run: async (payload) => {
    console.log(`🕐 Daily Atlas import triggered at ${payload.timestamp.toISOString()}`);

    // Trigger the full Atlas import task
    const result = await notionFullAtlasImportTask.triggerAndWait({});

    if (result.ok) {
      console.log('✅ Daily Atlas import completed successfully');
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
      console.error('❌ Daily Atlas import failed:', result.error);
      throw new Error(`Daily import failed: ${errorMessage}`);
    }
  },
});
