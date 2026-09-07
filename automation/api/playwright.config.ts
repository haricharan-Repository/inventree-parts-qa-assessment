import { defineConfig } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // Parts CRUD tests share state (categories, IPNs) — keep deterministic
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  // Deletes every "QA "-prefixed Part/Category this run created, once, after the whole suite
  // finishes (pass or fail) — see scripts/teardown.js for why this exists and how it works.
  globalTeardown: require.resolve('./scripts/teardown.js'),
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8000',
    extraHTTPHeaders: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  },
});
