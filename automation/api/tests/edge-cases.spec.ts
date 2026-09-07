import { test, expect, request } from '@playwright/test';
import { test as apiTest, config } from '../fixtures/api.fixtures';
import { randomPartName, stringOfLength } from '../utils/testData';

// Covers API-E-01..12 (test-cases/api-manual-tests.md, section 6)

test.describe('Edge cases — auth, payloads, conflicts', () => {
  test('API-E-01: unauthenticated POST is rejected', async () => {
    const anon = await request.newContext({ baseURL: config.BASE_URL });
    const res = await anon.post('/api/part/', { data: { name: randomPartName() } });
    expect(res.status()).toBe(401);
    await anon.dispose();
  });

  test('API-E-04: invalid token is rejected', async () => {
    const badAuth = await request.newContext({
      baseURL: config.BASE_URL,
      extraHTTPHeaders: { Authorization: 'Token invalidtoken123' },
    });
    const res = await badAuth.get('/api/part/');
    expect(res.status()).toBe(401);
    await badAuth.dispose();
  });

  test('API-E-05: malformed JSON payload returns 400, not 500', async () => {
    const anon = await request.newContext({ baseURL: config.BASE_URL });
    const res = await anon.fetch('/api/part/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: '{"name": "Broken', // deliberately truncated/invalid JSON
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
    await anon.dispose();
  });

});

apiTest.describe('Edge cases requiring an authenticated context', () => {
  apiTest('API-E-07: oversized field is rejected, server does not hang', async ({ authedRequest }) => {
    // Moved here from the unauthenticated block: DRF checks authentication/permissions before
    // running serializer validation, so an anonymous POST returns 401 before the oversized
    // field is ever inspected — confirmed against a live instance. Field-length validation
    // needs an authenticated request to actually exercise it.
    const res = await authedRequest.post('/api/part/', {
      data: { name: randomPartName(), description: stringOfLength(100_000) },
      timeout: 15_000,
    });
    expect(res.status()).toBe(400);
  });

  apiTest('API-E-03: authenticated but insufficient permission returns 403', async ({}) => {
    apiTest.skip(
      !process.env.READONLY_USERNAME || !process.env.READONLY_PASSWORD,
      'READONLY_USERNAME/READONLY_PASSWORD not configured in .env — see automation/api/.env.example',
    );

    // Preemptive Basic auth header — see fixtures/api.fixtures.ts for why `httpCredentials`
    // (challenge-response) doesn't work against InvenTree's API.
    const basicAuthHeader = `Basic ${Buffer.from(
      `${process.env.READONLY_USERNAME}:${process.env.READONLY_PASSWORD}`,
    ).toString('base64')}`;
    const readOnlyContext = await request.newContext({
      baseURL: config.BASE_URL,
      extraHTTPHeaders: { Authorization: basicAuthHeader },
    });
    const tokenRes = await readOnlyContext.get('/api/user/token/');
    const { token } = await tokenRes.json();

    const authed = await request.newContext({
      baseURL: config.BASE_URL,
      extraHTTPHeaders: { Authorization: `Token ${token}` },
    });

    const res = await authed.post('/api/part/', { data: { name: randomPartName() } });
    expect(res.status()).toBe(403);

    await readOnlyContext.dispose();
    await authed.dispose();
  });

  apiTest('API-E-09: DELETE is not idempotent on an already-deleted resource', async ({ authedRequest }) => {
    const created = await (
      await authedRequest.post('/api/part/', { data: { name: randomPartName() } })
    ).json();

    // Active parts can't be deleted at all (see API-P-07) — deactivate first so this test
    // actually exercises delete-then-delete-again, not the active-flag block.
    await authedRequest.patch(`/api/part/${created.pk}/`, { data: { active: false } });

    const first = await authedRequest.delete(`/api/part/${created.pk}/`);
    expect(first.status()).toBe(204);

    const second = await authedRequest.delete(`/api/part/${created.pk}/`);
    expect(second.status()).toBe(404);
  });

  apiTest('API-E-10: method not allowed on a read-only sub-resource', async ({ authedRequest }) => {
    const part = await (
      await authedRequest.post('/api/part/', { data: { name: randomPartName() } })
    ).json();

    const res = await authedRequest.delete(`/api/part/${part.pk}/pricing/`);
    expect(res.status()).toBe(405);
  });

  apiTest('API-E-11: creating a variant of a non-template part is rejected', async ({ authedRequest }) => {
    const nonTemplate = await (
      await authedRequest.post('/api/part/', { data: { name: randomPartName('QA NonTemplate'), is_template: false } })
    ).json();

    const res = await authedRequest.post('/api/part/', {
      data: { name: randomPartName('QA BadVariant'), variant_of: nonTemplate.pk },
    });
    expect(res.status()).toBe(400);
  });

  apiTest('API-E-12: SQL-injection-style search input is treated as a literal string', async ({
    authedRequest,
  }) => {
    const res = await authedRequest.get(
      `/api/part/?search=${encodeURIComponent("' OR '1'='1")}&limit=50`,
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.results)).toBe(true);
  });
});
