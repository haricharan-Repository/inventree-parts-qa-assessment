import { Page, expect } from '@playwright/test';

/**
 * All tab names below are now verified against a live instance, including the conditional ones
 * — created a part with `is_template=true, assembly=true, testable=true` simultaneously and a
 * separate revision pair to check. Two real corrections came out of that:
 *   - The BOM tab's actual label is **"Bill of Materials"**, not "BOM" (the guessed name).
 *   - There is **no "Revisions" tab at all.** The revision switcher is a "Select Part Revision"
 *     dropdown rendered inside the *Part Details* tab's own content, not a sibling tab — the
 *     original `PartTab` type included a tab that has never existed. It doesn't appear in this
 *     union for that reason (see `expectRevisionSelectorVisible` for the actual widget).
 * "Build Orders" was also confirmed for real (present for the assembly part) — not previously
 * spot-checked.
 */
export type PartTab =
  | 'Part Details'
  | 'Stock'
  | 'Allocations'
  | 'Used In'
  | 'Part Pricing'
  | 'Suppliers'
  | 'Purchase Orders'
  | 'Build Orders'
  | 'Related Parts'
  | 'Parameters'
  | 'Attachments'
  | 'Notes'
  | 'Bill of Materials'
  | 'Variants'
  | 'Test Templates';

export class PartDetailPage {
  constructor(private readonly page: Page) {}

  private tablist() {
    return this.page.getByRole('tablist', { name: 'panel-tabs-part' });
  }

  async expectLoaded(partName: string) {
    // The header renders as a paragraph (not a semantic heading, so getByRole('heading') never
    // matches — confirmed against a live instance), reading "Part: <name>" normally but
    // "Part: <IPN> | <name>" when the part has an IPN set. Match the name as a substring rather
    // than assuming either exact format.
    const escaped = partName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await expect(this.page.getByText(new RegExp(`Part:.*${escaped}`))).toBeVisible({
      timeout: 15_000,
    });
  }

  async openTab(tab: PartTab) {
    const tabControl = this.tablist().getByRole('tab', { name: tab, exact: true });
    await expect(tabControl).toBeVisible({ timeout: 10_000 });
    await tabControl.click();
    await expect(tabControl).toHaveAttribute('aria-selected', 'true');
  }

  /** PDV-17/18: the revision switcher — confirmed live as a "Select Part Revision" widget
   * inside the Part Details tab's own content, not a separate tab (see the PartTab doc comment). */
  async expectRevisionSelectorVisible(expected: boolean) {
    await this.openTab('Part Details');
    const selector = this.page.getByText('Select Part Revision', { exact: true });
    if (expected) {
      await expect(selector).toBeVisible({ timeout: 10_000 });
    } else {
      await expect(selector).toHaveCount(0);
    }
  }

  async expectTabHidden(tab: PartTab) {
    await expect(this.tablist().getByRole('tab', { name: tab, exact: true })).toHaveCount(0);
  }

  async addParameter(templateName: string, value: string) {
    await this.openTab('Parameters');
    await this.page.getByRole('button', { name: 'action-menu-add-parameters' }).click();
    await this.page.getByRole('menuitem', { name: 'action-menu-add-parameters-create-parameter' }).click();

    const dialog = this.page.getByRole('dialog', { name: 'Add Parameter' });
    await dialog.getByRole('combobox', { name: 'related-field-template' }).click();
    await this.page.keyboard.type(templateName);
    await this.page.getByRole('option', { name: new RegExp(templateName, 'i') }).click();
    await dialog.getByRole('textbox', { name: 'text-field-data' }).fill(value);
    await dialog.getByRole('button', { name: 'Submit' }).click();

    await expect(dialog).toBeHidden({ timeout: 10_000 });
    await expect(this.page.getByRole('row', { name: new RegExp(templateName, 'i') })).toBeVisible();
  }

  /**
   * Creates a stock item. InvenTree navigates away to the new Stock Item's own detail page on
   * success (confirmed against a live instance — it does not stay on the Part's Stock tab), so
   * this asserts the item's own QUANTITY badge, then returns to the part page via history back.
   */
  async addStockItem(quantity: number) {
    await this.openTab('Stock');
    await this.page.getByRole('button', { name: 'action-button-add-stock-item' }).click();

    const dialog = this.page.getByRole('dialog', { name: 'Add Stock Item' });
    await dialog.getByRole('textbox', { name: 'number-field-quantity' }).fill(String(quantity));
    await dialog.getByRole('button', { name: 'Submit' }).click();
    await expect(dialog).toBeHidden({ timeout: 10_000 });

    // Not `exact: true` — confirmed against a live instance that the badge's accessible text
    // node doesn't exact-match despite looking identical (likely nested/whitespace structure
    // inside the badge component); substring match is reliable.
    await expect(this.page.getByText(`QUANTITY: ${quantity}`)).toBeVisible({
      timeout: 15_000,
    });
    await this.page.goBack();
    await expect(this.tablist()).toBeVisible({ timeout: 15_000 });
  }

  async expectStockQuantity(quantity: number) {
    await this.openTab('Stock');
    await expect(this.page.getByRole('cell', { name: String(quantity), exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });
  }

  /**
   * InvenTree refuses to delete an *active* part ("Cannot delete this part as it is still
   * active" — confirmed against a live instance, and the Delete menu item is `disabled` in the
   * DOM until deactivated). Deactivates via Edit first, matching the only supported path.
   */
  async deletePart() {
    await this.page.getByRole('button', { name: 'action-menu-part-actions' }).click();
    await this.page.getByRole('menuitem', { name: 'action-menu-part-actions-edit' }).click();

    const editDialog = this.page.getByRole('dialog', { name: 'Edit Part' });
    await expect(editDialog).toBeVisible({ timeout: 10_000 });
    const activeSwitch = editDialog.getByRole('switch', { name: 'boolean-field-active' });
    if (await activeSwitch.isChecked()) {
      await activeSwitch.click();
    }
    await editDialog.getByRole('button', { name: 'Submit' }).click();
    await expect(editDialog).toBeHidden({ timeout: 10_000 });

    await this.page.getByRole('button', { name: 'action-menu-part-actions' }).click();
    const deleteItem = this.page.getByRole('menuitem', { name: 'action-menu-part-actions-delete' });
    await expect(deleteItem).toBeEnabled({ timeout: 10_000 });
    await deleteItem.click();

    const confirmDialog = this.page.getByRole('dialog');
    await confirmDialog.getByRole('button', { name: /delete/i }).click();
  }
}
