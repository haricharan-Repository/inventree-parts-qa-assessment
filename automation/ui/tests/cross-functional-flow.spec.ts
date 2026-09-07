import { test, expect } from '../fixtures/ui.fixtures';

/**
 * Cross-functional flow required by Phase 3 of the assessment brief:
 *   create a part -> add a parameter -> create a stock item -> verify it surfaces
 *   in the category view.
 *
 * This intentionally exercises four different subsystems (part creation, parameter
 * templates, stock, category listings) in one continuous journey rather than as isolated
 * unit-style checks, mirroring how a real user would move through the app.
 */
test('cross-functional: create part -> add parameter -> add stock -> verify in category view', async ({
  page,
  partsListPage,
  partDetailPage,
  categoryPage,
}) => {
  const categoryName = 'Electronics';
  const partName = `QA Cross-Functional Part ${Date.now()}`;

  await test.step('Create the part under a known category', async () => {
    await partsListPage.goto();
    await partsListPage.createPart({
      name: partName,
      category: categoryName,
      description: 'End-to-end cross-functional flow part',
    });
    await partDetailPage.expectLoaded(partName);
  });

  await test.step('Add a parameter value', async () => {
    await partDetailPage.addParameter('Resistance', '4k7');
  });

  await test.step('Create a stock item', async () => {
    await partDetailPage.addStockItem(50);
    await partDetailPage.expectStockQuantity(50);
  });

  await test.step('Verify the part surfaces in the category view with its stock', async () => {
    await categoryPage.gotoCategory(categoryName);
    await categoryPage.expectPartListed(partName);

    // The category's part list surfaces total in-stock quantity per row — confirm the
    // stock created above is reflected there, not just that the row exists.
    const row = page.getByRole('row', { name: new RegExp(partName, 'i') });
    await expect(row.getByText(/50/)).toBeVisible({ timeout: 15_000 });
  });
});
