import { Page, expect } from '@playwright/test';

/**
 * Selectors verified against a live InvenTree 1.5.2 instance (Platform UI). Key discovery:
 * this app labels most interactive elements via `aria-label` using stable, test-id-like names
 * (e.g. "text-field-name", "action-menu-add-parts") rather than natural-language accessible
 * names — so most locators here match on those, not on visible label text. See
 * automation/ui/README.md "Known gap" section for how this was found and
 * agents/prompts.md §7 for the correction record.
 */
export class PartsListPage {
  constructor(private readonly page: Page) {}

  /** `/web/part` defaults to the Part Categories browser; the flat Parts list is a sub-tab. */
  async goto() {
    await this.page.goto('/web/part');
    await this.partsSubTab().click();
    await expect(this.page.getByRole('tabpanel', { name: 'Parts' })).toBeVisible({ timeout: 15_000 });
  }

  private partsSubTab() {
    return this.page.getByRole('tablist', { name: 'panel-tabs-partcategory' }).getByRole('tab', { name: 'Parts' });
  }

  async search(term: string) {
    const searchBox = this.page.getByRole('textbox', { name: 'table-search-input' });
    await searchBox.fill(term);
    await expect(this.page.getByRole('row', { name: new RegExp(term, 'i') }).first()).toBeVisible({
      timeout: 15_000,
    });
  }

  /** Filters without asserting a match — for verifying something is *absent* (e.g. post-delete). */
  async filterOnly(term: string) {
    const searchBox = this.page.getByRole('textbox', { name: 'table-search-input' });
    await searchBox.fill(term);
    // The grid re-fetches on a debounce; give it a moment to settle before the caller asserts.
    await expect(searchBox).toHaveValue(term);
    await this.page.waitForLoadState('networkidle');
  }

  async openPartByName(name: string) {
    await this.search(name);
    await this.page.getByRole('cell', { name, exact: false }).first().click();
  }

  async openNewPartForm() {
    await this.page.getByRole('button', { name: 'action-menu-add-parts' }).click();
    await this.page.getByRole('menuitem', { name: 'action-menu-add-parts-create-part' }).click();
    await expect(this.page.getByRole('dialog', { name: 'Add Part' })).toBeVisible();
  }

  /**
   * Fills and submits the "Add Part" dialog. Category is a searchable tree combobox: type
   * text to filter, then click the matching option text (confirmed against a live instance —
   * it is not a plain <select>, so fill+option-click is required rather than selectOption).
   */
  async createPart(fields: {
    name: string;
    ipn?: string;
    description?: string;
    category?: string;
    units?: string;
  }) {
    await this.openNewPartForm();
    const dialog = this.page.getByRole('dialog', { name: 'Add Part' });

    await dialog.getByRole('textbox', { name: 'text-field-name' }).fill(fields.name);
    if (fields.ipn) await dialog.getByRole('textbox', { name: 'text-field-IPN' }).fill(fields.ipn);
    if (fields.description) {
      await dialog.getByRole('textbox', { name: 'text-field-description' }).fill(fields.description);
    }
    if (fields.units) await dialog.getByRole('textbox', { name: 'text-field-units' }).fill(fields.units);

    if (fields.category) {
      await dialog.getByRole('textbox', { name: 'tree-field-category' }).fill(fields.category);
      await this.page.getByText(fields.category, { exact: true }).click();
    }

    await this.submitOpenForm();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
  }

  /** Submits whichever create/edit dialog is currently open. */
  async submitOpenForm() {
    await this.page.getByRole('dialog').getByRole('button', { name: 'Submit' }).click();
  }

  async expectValidationError() {
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible(); // form stays open on validation failure
    await expect(dialog.getByText(/required/i).first()).toBeVisible({ timeout: 5_000 });
  }
}
