import { test, expect } from '../fixtures/api.fixtures';
import { randomPartName, stringOfLength, uniqueStringOfLength } from '../utils/testData';

// Covers API-V-01..13 (test-cases/api-manual-tests.md, section 4)

test.describe('Field-level validation', () => {
  test('API-V-01: missing required "name" is rejected', async ({ authedRequest }) => {
    const res = await authedRequest.post('/api/part/', { data: {} });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('name');
  });

  test('API-V-02: name exceeding max length (101 chars) is rejected', async ({ authedRequest }) => {
    const res = await authedRequest.post('/api/part/', { data: { name: stringOfLength(101) } });
    expect(res.status()).toBe(400);
  });

  test('API-V-03: name at exact max length boundary (100 chars) is accepted', async ({ authedRequest }) => {
    // Part.name is part of a (name, IPN, revision) uniqueness set — a fixed repeated-char
    // string collided with itself on repeated suite runs, confirmed against a live instance
    // ("The fields name, IPN, revision must make a unique set."). Use a unique-but-still-
    // exactly-100-char name instead.
    const name = uniqueStringOfLength(100);
    const res = await authedRequest.post('/api/part/', { data: { name } });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.name).toHaveLength(100);
  });

  test('API-V-04: description exceeding max length (251 chars) is rejected', async ({ authedRequest }) => {
    const res = await authedRequest.post('/api/part/', {
      data: { name: randomPartName(), description: stringOfLength(251) },
    });
    expect(res.status()).toBe(400);
  });

  test('API-V-05: nullable field (category) accepts null', async ({ authedRequest }) => {
    const category = await (
      await authedRequest.post('/api/part/category/', { data: { name: `QA Nullable Cat ${Date.now()}` } })
    ).json();
    const part = await (
      await authedRequest.post('/api/part/', { data: { name: randomPartName(), category: category.pk } })
    ).json();

    const res = await authedRequest.patch(`/api/part/${part.pk}/`, { data: { category: null } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.category).toBeNull();
  });

  test('API-V-06: non-nullable field (name) rejects null', async ({ authedRequest }) => {
    const part = await (
      await authedRequest.post('/api/part/', { data: { name: randomPartName() } })
    ).json();

    const res = await authedRequest.patch(`/api/part/${part.pk}/`, { data: { name: null } });
    expect(res.status()).toBe(400);
  });

  test('API-V-07: writing a read-only field does not change its value', async ({ authedRequest }) => {
    const part = await (
      await authedRequest.post('/api/part/', { data: { name: randomPartName() } })
    ).json();
    const before = await (await authedRequest.get(`/api/part/${part.pk}/`)).json();

    // Read-only fields are typically silently ignored by DRF rather than causing a 400 —
    // the meaningful assertion is that the stored value never changes either way.
    await authedRequest.patch(`/api/part/${part.pk}/`, { data: { in_stock: 9999 } });

    const after = await (await authedRequest.get(`/api/part/${part.pk}/`)).json();
    expect(after.in_stock).toBe(before.in_stock);
  });

  test('API-V-08: invalid type for boolean field is rejected', async ({ authedRequest }) => {
    // DRF's BooleanField coerces common truthy/falsy *strings* ("yes", "true", "1", ...) rather
    // than rejecting them — confirmed against a live instance (assembly: "yes" -> 201, true).
    // Use a genuinely non-coercible value (a nested object) to exercise real type validation.
    const res = await authedRequest.post('/api/part/', {
      data: { name: randomPartName(), assembly: { nested: true } },
    });
    expect(res.status()).toBe(400);
  });

  test('API-V-09: foreign key referencing non-existent category is rejected', async ({ authedRequest }) => {
    const res = await authedRequest.post('/api/part/', {
      data: { name: randomPartName(), category: 999999999 },
    });
    expect(res.status()).toBe(400);
  });

  test('API-V-10: negative minimum_stock is rejected', async ({ authedRequest }) => {
    const res = await authedRequest.post('/api/part/', {
      data: { name: randomPartName(), minimum_stock: -1 },
    });
    expect(res.status()).toBe(400);
  });

  test('API-V-11: revision_of pointing to a template part is rejected', async ({ authedRequest }) => {
    const template = await (
      await authedRequest.post('/api/part/', { data: { name: randomPartName('QA Template'), is_template: true } })
    ).json();

    const res = await authedRequest.post('/api/part/', {
      data: { name: randomPartName(), revision_of: template.pk },
    });
    expect(res.status()).toBe(400);
  });

  test('API-V-12: revision_of pointing to self is rejected', async ({ authedRequest }) => {
    const part = await (
      await authedRequest.post('/api/part/', { data: { name: randomPartName() } })
    ).json();

    const res = await authedRequest.patch(`/api/part/${part.pk}/`, { data: { revision_of: part.pk } });
    expect(res.status()).toBe(400);
  });

  test('API-V-13: duplicate revision code under the same revision_of is rejected', async ({
    authedRequest,
  }) => {
    const original = await (
      await authedRequest.post('/api/part/', { data: { name: randomPartName('QA Original') } })
    ).json();
    const firstRevision = await authedRequest.post('/api/part/', {
      data: { name: randomPartName('QA Rev'), revision_of: original.pk, revision: 'B' },
    });
    test.skip(!firstRevision.ok(), 'Could not create prerequisite first revision on this instance');

    const res = await authedRequest.post('/api/part/', {
      data: { name: randomPartName('QA Rev Dup'), revision_of: original.pk, revision: 'B' },
    });
    expect(res.status()).toBe(400);
  });
});
