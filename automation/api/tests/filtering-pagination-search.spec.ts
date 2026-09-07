import { test, expect } from '../fixtures/api.fixtures';
import { randomPartName, randomIpn } from '../utils/testData';

// Covers API-F-01..13 (test-cases/api-manual-tests.md, section 3)
//
// InvenTree's `/api/part/` only returns the paginated `{count, next, previous, results}`
// envelope when a `limit` (or `offset`) query param is present; without one it returns a bare
// JSON array of every matching part. Every list call below that expects `.results` therefore
// explicitly passes `limit=` — confirmed against a live instance, not documented on the static
// schema page (see agents/prompts.md §7 for this and the other live-run corrections).

test.describe('Parts list — filtering, pagination, search', () => {
  test('API-F-01: search by keyword matches name', async ({ authedRequest }) => {
    const keyword = `Resistor${Date.now()}`;
    await authedRequest.post('/api/part/', { data: { name: `${keyword} 10k` } });

    const res = await authedRequest.get(`/api/part/?search=${keyword}&limit=50`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.results.length).toBeGreaterThan(0);
    for (const part of body.results) {
      expect(part.name.toLowerCase()).toContain(keyword.toLowerCase());
    }
  });

  test('API-F-02: filter by exact IPN', async ({ authedRequest }) => {
    const ipn = randomIpn();
    await authedRequest.post('/api/part/', { data: { name: randomPartName(), IPN: ipn } });

    const res = await authedRequest.get(`/api/part/?IPN=${ipn}&limit=50`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.results.length).toBeGreaterThan(0);
    for (const part of body.results) {
      expect(part.IPN).toBe(ipn);
    }
  });

  test('API-F-03: filter by category id', async ({ authedRequest }) => {
    const category = await (
      await authedRequest.post('/api/part/category/', { data: { name: `QA Filter Cat ${Date.now()}` } })
    ).json();
    await authedRequest.post('/api/part/', { data: { name: randomPartName(), category: category.pk } });

    const res = await authedRequest.get(`/api/part/?category=${category.pk}&limit=50`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.results.length).toBeGreaterThan(0);
    for (const part of body.results) {
      expect(part.category).toBe(category.pk);
    }
  });

  test('API-F-04: cascade filter includes sub-category parts', async ({ authedRequest }) => {
    const parent = await (
      await authedRequest.post('/api/part/category/', { data: { name: `QA Cascade Parent ${Date.now()}` } })
    ).json();
    const child = await (
      await authedRequest.post('/api/part/category/', {
        data: { name: `QA Cascade Child ${Date.now()}`, parent: parent.pk },
      })
    ).json();
    const childPart = await (
      await authedRequest.post('/api/part/', { data: { name: randomPartName(), category: child.pk } })
    ).json();

    const res = await authedRequest.get(`/api/part/?category=${parent.pk}&cascade=true&limit=50`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    const ids = body.results.map((p: { pk: number }) => p.pk);
    expect(ids).toContain(childPart.pk);
  });

  for (const flag of ['assembly', 'component', 'trackable', 'purchaseable', 'salable', 'active'] as const) {
    test(`API-F-06: boolean filter "${flag}=true" returns only matching parts`, async ({ authedRequest }) => {
      await authedRequest.post('/api/part/', { data: { name: randomPartName(), [flag]: true } });

      const res = await authedRequest.get(`/api/part/?${flag}=true&limit=50`);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.results.length).toBeGreaterThan(0);
      for (const part of body.results) {
        expect(part[flag]).toBe(true);
      }
    });
  }

  test('API-F-08: pagination — sequential pages do not overlap', async ({ authedRequest }) => {
    await Promise.all(
      Array.from({ length: 10 }, () => authedRequest.post('/api/part/', { data: { name: randomPartName() } })),
    );

    const page1 = await (await authedRequest.get('/api/part/?limit=5&offset=0')).json();
    const page2 = await (await authedRequest.get('/api/part/?limit=5&offset=5')).json();

    expect(page1.results.length).toBeLessThanOrEqual(5);
    expect(page1.count).toBe(page2.count);
    const ids1 = new Set(page1.results.map((p: { pk: number }) => p.pk));
    const ids2 = page2.results.map((p: { pk: number }) => p.pk);
    for (const id of ids2) {
      expect(ids1.has(id)).toBe(false);
    }
  });

  test('API-F-09: offset beyond result count returns empty results, correct count', async ({
    authedRequest,
  }) => {
    const res = await authedRequest.get('/api/part/?limit=5&offset=100000');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
    expect(typeof body.count).toBe('number');
  });

  test('API-F-10: ordering ascending vs descending by name', async ({ authedRequest }) => {
    // Reimplementing Postgres's actual sort order client-side is a dead end: its collation
    // (locale-aware, ICU on most installs) weighs punctuation/whitespace differently from both
    // plain codepoint comparison and JS's `localeCompare` — confirmed against a live instance,
    // where neither reproduced the server's own ordering consistently. The algorithm-independent
    // property that *does* hold regardless of collation is that descending is the exact reverse
    // of ascending for the same underlying data — but only if both calls see the *entire*
    // matching set in one page: with more matches than `limit`, asc[0:limit] and desc[0:limit]
    // are different windows of the full order (confirmed — this genuinely failed against a live
    // instance with 60+ parts and limit=20). Scope to a handful of parts created just for this
    // test so one page covers all of them.
    const prefix = `QA Order ${Date.now()}`;
    await Promise.all(
      ['Charlie', 'Alpha', 'Echo', 'Bravo', 'Delta'].map((suffix) =>
        authedRequest.post('/api/part/', { data: { name: `${prefix} ${suffix}` } }),
      ),
    );

    const asc = await (
      await authedRequest.get(`/api/part/?search=${encodeURIComponent(prefix)}&ordering=name&limit=50`)
    ).json();
    const desc = await (
      await authedRequest.get(`/api/part/?search=${encodeURIComponent(prefix)}&ordering=-name&limit=50`)
    ).json();

    const ascNames = asc.results.map((p: { name: string }) => p.name);
    const descNames = desc.results.map((p: { name: string }) => p.name);

    expect(descNames).toEqual([...ascNames].reverse());
    // And ordering must actually be doing something, not returning arbitrary/identical order.
    if (ascNames.length > 1) {
      expect(ascNames).not.toEqual(descNames);
    }
  });

  test('API-F-11: invalid filter value does not 500', async ({ authedRequest }) => {
    const res = await authedRequest.get('/api/part/?created_after=not-a-date');
    expect(res.status()).toBeLessThan(500);
  });

  test('API-F-13: category_detail=true includes nested category object', async ({ authedRequest }) => {
    const category = await (
      await authedRequest.post('/api/part/category/', { data: { name: `QA Detail Cat ${Date.now()}` } })
    ).json();
    await authedRequest.post('/api/part/', { data: { name: randomPartName(), category: category.pk } });

    const res = await authedRequest.get(`/api/part/?category=${category.pk}&category_detail=true&limit=50`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results[0]).toHaveProperty('category_detail');
    expect(body.results[0].category_detail.pk).toBe(category.pk);
  });
});
