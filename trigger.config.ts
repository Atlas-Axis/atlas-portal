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
      minTimeoutInMs: 1_000, // The minimum time to wait before retrying
      maxTimeoutInMs: 10_000, // The maximum time to wait before retrying
      factor: 2, // The exponential factor to use for backoff. Each subsequent retry will be calculated as `previousTimeout * factor`
      randomize: true, // Prevent the thundering herd problem where all retries happen at the same time.
    },
  },
  dirs: ['app/server/services/trigger'],
});
