#!/usr/bin/env node
/**
 * Best-effort cleanup of everything this suite creates. Every test in this repo names its data
 * with a "QA " prefix (see automation/api/utils/testData.ts and this project's own
 * pages/*.ts helpers) — this script deletes every Part and Part Category matching that prefix,
 * so repeated runs against a shared instance don't accumulate data forever. It does NOT touch
 * the fixtures `npm run seed` creates ("Electronics" category, "Resistance" parameter
 * template), since neither starts with "QA ".
 *
 * Wired as Playwright's globalTeardown (`playwright.config.ts`) — runs once after the full
 * suite, pass or fail. Also runnable standalone: `npm run teardown`.
 *
 * Non-fatal by design: a cleanup failure should never fail the test run that triggered it.
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8000';
const USERNAME = process.env.INVENTREE_USERNAME ?? 'admin';
const PASSWORD = process.env.INVENTREE_PASSWORD ?? 'inventree';

async function getToken() {
  const res = await fetch(`${BASE_URL}/api/user/token/`, {
    headers: { Authorization: `Basic ${Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')}` },
  });
  if (!res.ok) throw new Error(`Could not obtain a token for "${USERNAME}" (${res.status})`);
  return (await res.json()).token;
}

/** Paginates through a list endpoint, collecting every result regardless of `limit`/envelope shape. */
async function fetchAll(token, path) {
  const all = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const sep = path.includes('?') ? '&' : '?';
    const res = await fetch(`${BASE_URL}${path}${sep}limit=${limit}&offset=${offset}`, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!res.ok) break;
    const body = await res.json();
    const results = Array.isArray(body) ? body : body.results;
    if (!results || results.length === 0) break;
    all.push(...results);
    if (results.length < limit) break;
    offset += limit;
  }
  return all;
}

async function deleteBomLinesReferencing(token, partIds) {
  const lines = await fetchAll(token, '/api/bom/');
  let deleted = 0;
  for (const line of lines) {
    if (partIds.has(line.part) || partIds.has(line.sub_part)) {
      const res = await fetch(`${BASE_URL}/api/bom/${line.pk}/`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` },
      }).catch(() => null);
      if (res?.ok) deleted++;
    }
  }
  if (deleted) console.log(`  Deleted ${deleted} BOM line(s) referencing QA-prefixed parts.`);
}

async function deleteQaParts(token) {
  const parts = (await fetchAll(token, '/api/part/')).filter((p) => p.name?.startsWith('QA'));
  if (parts.length === 0) return;

  await deleteBomLinesReferencing(token, new Set(parts.map((p) => p.pk)));

  let deleted = 0;
  // Two passes: a part blocked on pass 1 by another QA part's BOM/revision reference may be
  // deletable on pass 2, once that referencing part is gone.
  for (let pass = 0; pass < 2; pass++) {
    for (const part of parts) {
      if (part._deleted) continue;
      if (part.active) {
        await fetch(`${BASE_URL}/api/part/${part.pk}/`, {
          method: 'PATCH',
          headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: false }),
        }).catch(() => {});
      }
      const res = await fetch(`${BASE_URL}/api/part/${part.pk}/`, {
        method: 'DELETE',
        headers: { Authorization: `Token ${token}` },
      }).catch(() => null);
      if (res && (res.ok || res.status === 404)) {
        part._deleted = true;
        deleted++;
      }
    }
  }
  console.log(`Parts: deleted ${deleted}/${parts.length} (name starts with "QA").`);
}

async function deleteQaCategories(token) {
  const categories = (await fetchAll(token, '/api/part/category/')).filter((c) => c.name?.startsWith('QA'));
  if (categories.length === 0) return;

  let deleted = 0;
  for (const category of categories) {
    // delete_parts: true acts as a catch-all for any QA part that survived deleteQaParts()
    // (e.g. one only reachable through this category's own subtree).
    const res = await fetch(`${BASE_URL}/api/part/category/${category.pk}/`, {
      method: 'DELETE',
      headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ delete_child_categories: true, delete_parts: true }),
    }).catch(() => null);
    if (res && (res.ok || res.status === 404)) deleted++;
  }
  console.log(`Categories: deleted ${deleted}/${categories.length} (name starts with "QA").`);
}

async function teardown() {
  let token;
  try {
    token = await getToken();
  } catch (err) {
    console.warn(`Teardown skipped — could not authenticate: ${err.message}`);
    return;
  }
  try {
    await deleteQaParts(token);
    await deleteQaCategories(token);
    console.log('Teardown complete.');
  } catch (err) {
    console.warn(`Teardown encountered an error (non-fatal, continuing): ${err.message}`);
  }
}

module.exports = teardown;

if (require.main === module) {
  teardown().then(() => process.exit(0));
}
