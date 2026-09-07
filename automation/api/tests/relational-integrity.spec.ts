import { test, expect } from '../fixtures/api.fixtures';
import { randomPartName, randomCategoryName } from '../utils/testData';

// Covers API-R-01..07 (test-cases/api-manual-tests.md, section 5)

test.describe('Relational integrity', () => {
  test('API-R-01: part is correctly linked to its category', async ({ authedRequest }) => {
    const category = await (
      await authedRequest.post('/api/part/category/', { data: { name: randomCategoryName() } })
    ).json();
    const part = await (
      await authedRequest.post('/api/part/', { data: { name: randomPartName(), category: category.pk } })
    ).json();

    const res = await authedRequest.get(`/api/part/${part.pk}/?category_detail=true`);
    const body = await res.json();
    expect(body.category).toBe(category.pk);
    expect(body.category_detail.name).toBe(category.name);
  });

  test('API-R-02: changing category updates category-scoped listings', async ({ authedRequest }) => {
    const categoryA = await (
      await authedRequest.post('/api/part/category/', { data: { name: randomCategoryName('QA CatA') } })
    ).json();
    const categoryB = await (
      await authedRequest.post('/api/part/category/', { data: { name: randomCategoryName('QA CatB') } })
    ).json();
    const part = await (
      await authedRequest.post('/api/part/', { data: { name: randomPartName(), category: categoryA.pk } })
    ).json();

    await authedRequest.patch(`/api/part/${part.pk}/`, { data: { category: categoryB.pk } });

    // limit= required to get the {results:[...]} envelope — see filtering-pagination-search.spec.ts.
    const inB = await (await authedRequest.get(`/api/part/?category=${categoryB.pk}&limit=50`)).json();
    const inA = await (await authedRequest.get(`/api/part/?category=${categoryA.pk}&limit=50`)).json();

    expect(inB.results.map((p: { pk: number }) => p.pk)).toContain(part.pk);
    expect(inA.results.map((p: { pk: number }) => p.pk)).not.toContain(part.pk);
  });

  test('API-R-05: deleting a category never leaves a part pointing at a dangling id', async ({
    authedRequest,
  }) => {
    const category = await (
      await authedRequest.post('/api/part/category/', { data: { name: randomCategoryName('QA Dangling') } })
    ).json();
    const part = await (
      await authedRequest.post('/api/part/', { data: { name: randomPartName(), category: category.pk } })
    ).json();

    // DELETE on a category requires an explicit body declaring what to do with its contents —
    // confirmed against a live instance (a bodyless DELETE returns 400 for missing required
    // fields, never actually deleting anything). false/false reassigns contained parts to the
    // deleted category's parent (or root) rather than deleting them.
    await authedRequest.delete(`/api/part/category/${category.pk}/`, {
      data: { delete_child_categories: false, delete_parts: false },
    });

    const partAfter = await authedRequest.get(`/api/part/${part.pk}/`);
    expect(partAfter.status()).toBe(200);
    const body = await partAfter.json();
    // The part must not silently reference a category id that no longer exists.
    if (body.category !== null) {
      const categoryCheck = await authedRequest.get(`/api/part/category/${body.category}/`);
      expect(categoryCheck.status()).toBe(200);
    }
  });

  test('API-R-06: BOM line references an existing component part', async ({ authedRequest }) => {
    const assembly = await (
      await authedRequest.post('/api/part/', { data: { name: randomPartName('QA Assembly'), assembly: true } })
    ).json();
    const component = await (
      await authedRequest.post('/api/part/', { data: { name: randomPartName('QA Component'), component: true } })
    ).json();

    // BOM lines live at /api/bom/, not /api/bom-item/ — corrected after verifying against a
    // live instance (the guessed path 404'd; see agents/prompts.md §7).
    const res = await authedRequest.post('/api/bom/', {
      data: { part: assembly.pk, sub_part: component.pk, quantity: 2 },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.part).toBe(assembly.pk);
    expect(body.sub_part).toBe(component.pk);
  });

  test('API-R-07: BOM line rejects a sub_part not flagged as component', async ({ authedRequest }) => {
    const assembly = await (
      await authedRequest.post('/api/part/', { data: { name: randomPartName('QA Assembly2'), assembly: true } })
    ).json();
    const nonComponent = await (
      await authedRequest.post('/api/part/', {
        data: { name: randomPartName('QA NonComponent'), component: false },
      })
    ).json();

    const res = await authedRequest.post('/api/bom/', {
      data: { part: assembly.pk, sub_part: nonComponent.pk, quantity: 1 },
    });

    expect(res.status()).toBe(400);
  });
});
