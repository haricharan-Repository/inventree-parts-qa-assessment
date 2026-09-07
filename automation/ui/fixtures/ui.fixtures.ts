import { test as base } from '@playwright/test';
import { PartsListPage } from '../pages/PartsListPage';
import { PartDetailPage } from '../pages/PartDetailPage';
import { CategoryPage } from '../pages/CategoryPage';

type UiFixtures = {
  partsListPage: PartsListPage;
  partDetailPage: PartDetailPage;
  categoryPage: CategoryPage;
};

// `page` arrives already authenticated via storageState (see global-setup.ts / playwright.config.ts).
export const test = base.extend<UiFixtures>({
  partsListPage: async ({ page }, use) => use(new PartsListPage(page)),
  partDetailPage: async ({ page }, use) => use(new PartDetailPage(page)),
  categoryPage: async ({ page }, use) => use(new CategoryPage(page)),
});

export { expect } from '@playwright/test';
