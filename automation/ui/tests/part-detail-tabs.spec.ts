import { test, expect } from '../fixtures/ui.fixtures';

// Covers PDV-03, PDV-04, PDV-09, PDV-10, PDV-13, PDV-22 (test-cases/ui-manual-tests.md, section 3)

function uniqueName(prefix: string) {
  return `${prefix} ${Date.now()}`;
}

test.describe('Part detail view — tabs', () => {
  test('PDV-09/PDV-10: Parameters tab lists and accepts a new value', async ({
    partsListPage,
    partDetailPage,
  }) => {
    const name = uniqueName('QA Param Part');
    await partsListPage.goto();
    await partsListPage.createPart({ name });
    await partDetailPage.expectLoaded(name);

    await partDetailPage.addParameter('Resistance', '10k');
  });

  test('PDV-13: Variants tab hidden for a non-template part', async ({ partsListPage, partDetailPage }) => {
    const name = uniqueName('QA Non-Template');
    await partsListPage.goto();
    await partsListPage.createPart({ name });
    await partDetailPage.expectLoaded(name);

    await partDetailPage.expectTabHidden('Variants');
  });

  test('PDV-22: Test Templates tab hidden for a non-testable part', async ({
    partsListPage,
    partDetailPage,
  }) => {
    const name = uniqueName('QA Non-Testable');
    await partsListPage.goto();
    await partsListPage.createPart({ name });
    await partDetailPage.expectLoaded(name);

    await partDetailPage.expectTabHidden('Test Templates');
  });

  test('PDV-01/PDV-02: Stock tab lists items and supports creating a new one', async ({
    partsListPage,
    partDetailPage,
  }) => {
    const name = uniqueName('QA Stock Part');
    await partsListPage.goto();
    await partsListPage.createPart({ name });
    await partDetailPage.expectLoaded(name);

    await partDetailPage.addStockItem(25);
    await partDetailPage.expectStockQuantity(25);
  });
});
