import { test, expect } from '../fixtures/api.fixtures';
import { randomPartName, randomIpn } from '../utils/testData';

// Covers API-P-01..10 (test-cases/api-manual-tests.md, section 1)

test.describe('Parts CRUD', () => {
  test('API-P-01: create part with required fields only', async ({ authedRequest }) => {
    const name = randomPartName();
    const res = await authedRequest.post('/api/part/', { data: { name } });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty('pk');
    expect(body.name).toBe(name);
    expect(body.active).toBe(true);
  });

  test('API-P-02: create part with full field set', async ({ authedRequest }) => {
    const name = randomPartName();
    const ipn = randomIpn();
    const res = await authedRequest.post('/api/part/', {
      data: {
        name,
        IPN: ipn,
        description: 'Full field set part',
        units: 'pcs',
        assembly: true,
        component: true,
        trackable: false,
        active: true,
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      name,
      IPN: ipn,
      description: 'Full field set part',
      units: 'pcs',
      assembly: true,
      component: true,
    });
  });

  test('API-P-03: retrieve a part by id', async ({ authedRequest }) => {
    const created = await authedRequest.post('/api/part/', { data: { name: randomPartName() } });
    const { pk } = await created.json();

    const res = await authedRequest.get(`/api/part/${pk}/`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.pk).toBe(pk);
    expect(body).toHaveProperty('in_stock');
    expect(body).toHaveProperty('full_name');
  });

  test('API-P-04: list parts returns paginated envelope', async ({ authedRequest }) => {
    // Ensure at least a few parts exist.
    await Promise.all(
      [1, 2, 3].map(() => authedRequest.post('/api/part/', { data: { name: randomPartName() } })),
    );

    // InvenTree only returns the paginated envelope when `limit`/`offset` is present —
    // a bare GET /api/part/ returns a plain JSON array (confirmed against a live instance).
    const res = await authedRequest.get('/api/part/?limit=20');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('count');
    expect(body).toHaveProperty('results');
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results.length).toBeLessThanOrEqual(body.count);
  });

  test('API-P-05: partial update via PATCH only changes targeted field', async ({ authedRequest }) => {
    const created = await authedRequest.post('/api/part/', {
      data: { name: randomPartName(), description: 'original' },
    });
    const before = await created.json();

    const res = await authedRequest.patch(`/api/part/${before.pk}/`, {
      data: { description: 'updated' },
    });

    expect(res.status()).toBe(200);
    const after = await res.json();
    expect(after.description).toBe('updated');
    expect(after.name).toBe(before.name);
  });

  test('API-P-06: full update via PUT sets fields exactly as given', async ({ authedRequest }) => {
    const created = await authedRequest.post('/api/part/', { data: { name: randomPartName() } });
    const before = await created.json();
    const newName = randomPartName('QA Renamed');

    const res = await authedRequest.put(`/api/part/${before.pk}/`, {
      data: { name: newName, description: 'replaced via PUT' },
    });

    expect(res.status()).toBe(200);
    const after = await res.json();
    expect(after.name).toBe(newName);
    expect(after.description).toBe('replaced via PUT');
  });

  test('API-P-07: delete a part with no references', async ({ authedRequest }) => {
    const created = await authedRequest.post('/api/part/', { data: { name: randomPartName() } });
    const { pk } = await created.json();

    // InvenTree unconditionally rejects deleting an *active* part — confirmed against a live
    // instance ("Cannot delete this part as it is still active"), not documented on the static
    // schema page. Deactivate first, matching the only supported delete path.
    await authedRequest.patch(`/api/part/${pk}/`, { data: { active: false } });

    const del = await authedRequest.delete(`/api/part/${pk}/`);
    expect(del.status()).toBe(204);

    const getAfter = await authedRequest.get(`/api/part/${pk}/`);
    expect(getAfter.status()).toBe(404);
  });

  test('API-P-08: retrieve non-existent part returns 404', async ({ authedRequest }) => {
    const res = await authedRequest.get('/api/part/999999999/');
    expect(res.status()).toBe(404);
  });

  test('API-P-09: update non-existent part returns 404', async ({ authedRequest }) => {
    const res = await authedRequest.patch('/api/part/999999999/', { data: { description: 'x' } });
    expect(res.status()).toBe(404);
  });

  test('API-P-10: an inactive part with stock can be deleted (stock alone does not block deletion)', async ({
    authedRequest,
  }) => {
    // The original assumption behind this case (test-cases/api-manual-tests.md API-P-10) was
    // that a stock reference alone blocks deletion, by analogy with the BOM-reference block
    // (API-R covers that). Verified against a live instance: it does not — only the `active`
    // flag gates deletion (see API-P-07). This test asserts the actual, confirmed behaviour;
    // see agents/prompts.md §7 for the correction.
    const createdPart = await authedRequest.post('/api/part/', {
      data: { name: randomPartName(), trackable: false },
    });
    const part = await createdPart.json();

    const stockRes = await authedRequest.post('/api/stock/', {
      data: { part: part.pk, quantity: 5 },
    });
    test.skip(!stockRes.ok(), 'Could not create prerequisite stock item on this instance');

    await authedRequest.patch(`/api/part/${part.pk}/`, { data: { active: false } });

    const del = await authedRequest.delete(`/api/part/${part.pk}/`);
    expect(del.status()).toBe(204);

    const afterDelete = await authedRequest.get(`/api/part/${part.pk}/`);
    expect(afterDelete.status()).toBe(404);
  });
});
