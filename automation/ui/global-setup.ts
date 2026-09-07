import { chromium, FullConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
import { LoginPage } from './pages/LoginPage';

dotenv.config();

/**
 * Logs in once via the real UI and persists storage state, so individual specs
 * don't each pay the cost (and flake risk) of a fresh login.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = process.env.BASE_URL ?? 'http://localhost:8000';
  const username = process.env.INVENTREE_USERNAME ?? 'admin';
  const password = process.env.INVENTREE_PASSWORD ?? 'inventree';

  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });

  try {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
  } catch (err) {
    await browser.close();
    throw new Error(
      `Could not reach InvenTree at ${baseURL}. Is the instance running (docker compose up)? ` +
        `Original error: ${(err as Error).message}`,
    );
  }

  const loginPage = new LoginPage(page);
  await loginPage.login(username, password);

  await page.context().storageState({ path: 'storageState.json' });
  await browser.close();
}
