import { Page, expect } from '@playwright/test';

export class CategoryPage {
  constructor(private readonly page: Page) {}

  /**
   * Navigates into a category via the Categories browser's search+click (confirmed against a
   * live instance — category names are plain table cells, not links, and there are two matching
   * cells per row once filtered, since Name and Path both show the name — `.first()` is
   * required). Lands on the category's Subcategories sub-tab by default; clicks into its own
   * "Parts" sub-tab to see the parts actually assigned to it.
   */
  async gotoCategory(categoryName: string) {
    await this.page.goto('/web/part');
    const categoriesTab = this.page
      .getByRole('tablist', { name: 'panel-tabs-partcategory' })
      .getByRole('tab', { name: 'Part Categories' });
    await categoriesTab.click();

    await this.page.getByRole('textbox', { name: 'table-search-input' }).fill(categoryName);
    await this.page.getByRole('cell', { name: categoryName, exact: true }).first().click();

    await expect(this.page.getByText('Part Category', { exact: true })).toBeVisible({ timeout: 15_000 });
    // Confirmed against a live instance: this sidebar reuses the same tablist accessible name
    // ("panel-tabs-partcategory") as the flat Parts list view — scope to it so this doesn't
    // accidentally match the top nav's own "Parts" tab.
    await this.page
      .getByRole('tablist', { name: 'panel-tabs-partcategory' })
      .getByRole('tab', { name: 'Parts', exact: true })
      .click();
  }

  async expectPartListed(partName: string) {
    await expect(this.page.getByRole('row', { name: new RegExp(partName, 'i') })).toBeVisible({
      timeout: 15_000,
    });
  }
}
