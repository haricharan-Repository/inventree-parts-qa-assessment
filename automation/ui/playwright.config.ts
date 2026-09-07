import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: require.resolve('./global-setup'),
  // Deletes every "QA "-prefixed Part/Category this run created, once, after the whole suite
  // finishes (pass or fail) — see scripts/teardown.js for why this exists and how it works.
  globalTeardown: require.resolve('./scripts/teardown.js'),
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8000',
    storageState: 'storageState.json',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
