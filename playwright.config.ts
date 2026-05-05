import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration.
 *
 * The e2e suite is intentionally NOT in the default `vitest` run — it
 * requires running portal builds and is gated behind explicit invocation
 * (`npx playwright test`). The companion `visual-parity.test.ts` proves the
 * compose path is byte-identical to the monolith path, so the unit-level
 * suite already covers parity by construction.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.PARITY_CANDIDATE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
