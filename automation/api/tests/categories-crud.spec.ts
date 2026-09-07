import { test, expect } from '../fixtures/api.fixtures';
import { randomCategoryName, randomPartName } from '../utils/testData';

// Covers API-C-01..08 (test-cases/api-manual-tests.md, section 2)

test.describe('Part Categories CRUD', () => {
  test('API-C-01: create top-level category', async ({ authedRequest }) => {
    const res = await authedRequest.post('/api/part/category/', {
      data: { name: randomCategoryName() },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.parent).toBeNull();
  });

  test('API-C-02: create nested category', async ({ authedRequest }) => {
    const parent = await (
      await authedRequest.post('/api/part/category/', { data: { name: randomCategoryName('QA Parent') } })
    ).json();

    const res = await authedRequest.post('/api/part/category/', {
      data: { name: randomCategoryName('QA Child'), parent: parent.pk },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.parent).toBe(parent.pk);
  });

  test('API-C-03: retrieve category tree reflects nesting', async ({ authedRequest }) => {
    const parent = await (
      await authedRequest.post('/api/part/category/', { data: { name: randomCategoryName('QA TreeParent') } })
    ).json();
    const child = await (
      await authedRequest.post('/api/part/category/', {
        data: { name: randomCategoryName('QA TreeChild'), parent: parent.pk },
      })
    ).json();

    const res = await authedRequest.get('/api/part/category/tree/');
    expect(res.status()).toBe(200);
    const tree = await res.json();
    const ids = JSON.stringify(tree);
    expect(ids).toContain(String(parent.pk));
    expect(ids).toContain(String(child.pk));
  });

  test('API-C-04: update category description', async ({ authedRequest }) => {
    const category = await (
      await authedRequest.post('/api/part/category/', { data: { name: randomCategoryName() } })
    ).json();

    const res = await authedRequest.patch(`/api/part/category/${category.pk}/`, {
      data: { description: 'Updated description' },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.description).toBe('Updated description');
  });

  test('API-C-05: delete empty category', async ({ authedRequest }) => {
    const category = await (
      await authedRequest.post('/api/part/category/', { data: { name: randomCategoryName() } })
    ).json();

    // DELETE on a category requires a body declaring what to do with any children/parts it
    // holds — confirmed against a live instance (a bodyless DELETE returns 400, "This field is
    // required", for delete_child_categories/delete_parts, never actually deleting anything).
    const res = await authedRequest.delete(`/api/part/category/${category.pk}/`, {
      data: { delete_child_categories: false, delete_parts: false },
    });
    expect(res.status()).toBe(204);
  });

  test('API-C-06: delete category containing parts does not silently delete parts', async ({
    authedRequest,
  }) => {
    const category = await (
      await authedRequest.post('/api/part/category/', { data: { name: randomCategoryName('QA WithParts') } })
    ).json();
    const part = await (
      await authedRequest.post('/api/part/', { data: { name: randomPartName(), category: category.pk } })
    ).json();

    // delete_parts: false -> contained parts are reassigned (to the deleted category's parent,
    // or null at root) rather than deleted — confirmed against a live instance.
    const del = await authedRequest.delete(`/api/part/category/${category.pk}/`, {
      data: { delete_child_categories: false, delete_parts: false },
    });
    expect(del.status()).toBe(204);

    const partAfter = await authedRequest.get(`/api/part/${part.pk}/`);
    expect(partAfter.status()).toBe(200);
    const partBody = await partAfter.json();
    expect(partBody.category).not.toBe(category.pk);
  });

  test('API-C-07: category cycle is rejected', async ({ authedRequest }) => {
    const parent = await (
      await authedRequest.post('/api/part/category/', { data: { name: randomCategoryName('QA CycleParent') } })
    ).json();
    const child = await (
      await authedRequest.post('/api/part/category/', {
        data: { name: randomCategoryName('QA CycleChild'), parent: parent.pk },
      })
    ).json();

    const res = await authedRequest.patch(`/api/part/category/${parent.pk}/`, {
      data: { parent: child.pk },
    });

    expect(res.status()).toBe(400);
  });

  test('API-C-08: category self-parent is rejected', async ({ authedRequest }) => {
    const category = await (
      await authedRequest.post('/api/part/category/', { data: { name: randomCategoryName() } })
    ).json();

    const res = await authedRequest.patch(`/api/part/category/${category.pk}/`, {
      data: { parent: category.pk },
    });

    expect(res.status()).toBe(400);
  });
});
