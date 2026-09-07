import { test, expect } from '../fixtures/ui.fixtures';

// Covers PC-01, PC-02, PC-03, PC-06 (test-cases/ui-manual-tests.md, section 1)

function uniqueName(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

test.describe('Part CRUD workflows', () => {
  test('PC-01: create part with required fields only', async ({ page, partsListPage, partDetailPage }) => {
    const name = uniqueName('QA Resistor');

    await partsListPage.goto();
    await partsListPage.createPart({ name });

    await expect(page).toHaveURL(/\/part\/\d+/);
    await partDetailPage.expectLoaded(name);
  });

  test('PC-02: create part with all fields populated', async ({ partsListPage, partDetailPage }) => {
    const name = uniqueName('QA Capacitor');

    await partsListPage.goto();
    await partsListPage.createPart({
      name,
      ipn: `QA-IPN-${Date.now()}`,
      description: 'Created by UI automation',
      units: 'pcs',
    });

    await partDetailPage.expectLoaded(name);
  });

  test('PC-03: name is required', async ({ partsListPage }) => {
    await partsListPage.goto();
    await partsListPage.openNewPartForm();

    // Submit without filling Name.
    await partsListPage.submitOpenForm();

    await partsListPage.expectValidationError();
  });

  test('PC-06: assign category on creation and verify it appears in that category', async ({
    partsListPage,
    partDetailPage,
    categoryPage,
    page,
  }) => {
    const categoryName = 'Electronics';
    const name = uniqueName('QA Under Category');

    await partsListPage.goto();
    await partsListPage.createPart({ name, category: categoryName });
    await partDetailPage.expectLoaded(name);

    // Two elements render "Electronics" text (a labelled breadcrumb link plus a plain one) —
    // confirmed against a live instance; .first() is enough to confirm the breadcrumb rendered.
    await expect(page.getByText(new RegExp(categoryName, 'i')).first()).toBeVisible();

    await categoryPage.gotoCategory(categoryName);
    await categoryPage.expectPartListed(name);
  });

  test('delete a part with no references', async ({ partsListPage, partDetailPage, page }) => {
    const name = uniqueName('QA Deletable');

    await partsListPage.goto();
    await partsListPage.createPart({ name });
    await partDetailPage.expectLoaded(name);

    await partDetailPage.deletePart();

    // Deleting navigates away from the deleted part's own detail URL — re-open the Parts list
    // fresh and confirm the part is gone. Uses filterOnly (not search) since search() itself
    // waits for a matching row, which is the wrong assertion when expecting zero results.
    await partsListPage.goto();
    await partsListPage.filterOnly(name);
    await expect(page.getByRole('row', { name: new RegExp(name, 'i') })).toHaveCount(0);
  });
});
