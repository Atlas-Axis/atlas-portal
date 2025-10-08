import { schedules } from '@trigger.dev/sdk';
import { notionFullAtlasSyncTask } from './notion-full-atlas-sync-task';

export const notionDailySyncSchedule = schedules.task({
  id: 'notion-daily-sync',
  cron: '0 4 * * *', // Daily at 4:00 AM UTC
  run: async (payload) => {
    console.log(`🕐 Daily Atlas sync triggered at ${payload.timestamp.toISOString()}`);

    // Trigger the full Atlas sync task
    const result = await notionFullAtlasSyncTask.triggerAndWait();

    if (result.ok) {
      console.log('✅ Daily Atlas sync completed successfully');
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
      console.error('❌ Daily Atlas sync failed:', result.error);
      throw new Error(`Daily sync failed: ${errorMessage}`);
    }
  },
});
