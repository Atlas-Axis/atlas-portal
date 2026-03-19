// DISABLED: Notion is no longer the source of truth for the Atlas.
// The portal now reads directly from the GitHub markdown file.
// This hourly sync was importing Notion → Supabase, which nothing depends on anymore.
// See atlas-axis-notion-workflow PR #12 for context.
//
// To re-enable, uncomment the code below and redeploy.

// import { schedules } from '@trigger.dev/sdk';
// import { notionFullAtlasImportTask } from './notion-full-atlas-import-task';
//
// export const hourlyNotionImportSchedule = schedules.task({
//   id: 'hourly-notion-import',
//   cron: '0 * * * *',
//   run: async (payload) => {
//     console.log(`🕐 Hourly Atlas import triggered at ${payload.timestamp.toISOString()}`);
//     const result = await notionFullAtlasImportTask.triggerAndWait({});
//     if (result.ok) {
//       console.log('✅ Hourly Atlas import completed successfully');
//       return { success: true, timestamp: payload.timestamp, syncResult: result.output };
//     } else {
//       const errorMessage = result.error instanceof Error ? result.error.message : 'Unknown error';
//       console.error('❌ Hourly Atlas import failed:', result.error);
//       throw new Error(`Hourly import failed: ${errorMessage}`);
//     }
//   },
// });
