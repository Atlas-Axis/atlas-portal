import { defineConfig } from '@trigger.dev/sdk/v3';

export default defineConfig({
  project: 'proj_gkhctbdqrikqxvajyeaa',
  runtime: 'node',
  logLevel: 'log',
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
  maxDuration: 60 * 60, // 60 minutes
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1_000,
      maxTimeoutInMs: 10_000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ['app/server/services/trigger'],
});
