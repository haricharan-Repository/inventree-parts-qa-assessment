#!/usr/bin/env node
/**
 * Seeds the fixed-name prerequisites the UI suite references by name rather than creating
 * fresh each run: the "Electronics" category (PC-06, cross-functional-flow) and the
 * "Resistance" parameter template (PDV-09/10, cross-functional-flow). Idempotent — safe to
 * re-run; skips anything that already exists.
 *
 * Also a reminder list of the *manual* one-time setup steps a fresh `docker compose up`
 * InvenTree instance needs before either automation project can run at all (none of these are
 * scriptable from outside the container) — see automation/ui/README.md "Setup" for the exact
 * commands:
 *   1. `invoke static` inside the inventree-server container — the stock image does not run
 *      collectstatic on first boot, so the Platform UI's JS bundle 404s until this runs.
 *   2. Create an admin superuser (the image doesn't auto-create one unless INVENTREE_ADMIN_*
 *      env vars were set before first boot).
 *
 * Usage: BASE_URL=http://localhost:8000 INVENTREE_USERNAME=admin INVENTREE_PASSWORD=inventree node scripts/seed.js
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8000';
const USERNAME = process.env.INVENTREE_USERNAME ?? 'admin';
const PASSWORD = process.env.INVENTREE_PASSWORD ?? 'inventree';

async function getToken() {
  const res = await fetch(`${BASE_URL}/api/user/token/`, {
    headers: { Authorization: `Basic ${Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64')}` },
  });
  if (!res.ok) {
    throw new Error(
      `Could not obtain a token for "${USERNAME}" (${res.status}). Is InvenTree running at ` +
        `${BASE_URL}, and does that user exist? See automation/ui/README.md "Setup".`,
    );
  }
  const body = await res.json();
  return body.token;
}

async function ensureCategory(token, name) {
  const existing = await fetch(`${BASE_URL}/api/part/category/?search=${encodeURIComponent(name)}&limit=50`, {
    headers: { Authorization: `Token ${token}` },
  }).then((r) => r.json());
  if (existing.results?.some((c) => c.name === name)) {
    console.log(`Category "${name}" already exists — skipping.`);
    return;
  }
  const res = await fetch(`${BASE_URL}/api/part/category/`, {
    method: 'POST',
    headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description: 'QA stable category for UI automation' }),
  });
  if (!res.ok) throw new Error(`Failed to create category "${name}": ${res.status} ${await res.text()}`);
  console.log(`Created category "${name}".`);
}

async function ensureParameterTemplate(token, name, units) {
  const existing = await fetch(`${BASE_URL}/api/parameter/template/?search=${encodeURIComponent(name)}&limit=50`, {
    headers: { Authorization: `Token ${token}` },
  }).then((r) => r.json());
  if (existing.results?.some((t) => t.name === name)) {
    console.log(`Parameter template "${name}" already exists — skipping.`);
    return;
  }
  const res = await fetch(`${BASE_URL}/api/parameter/template/`, {
    method: 'POST',
    headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, units }),
  });
  if (!res.ok) throw new Error(`Failed to create parameter template "${name}": ${res.status} ${await res.text()}`);
  console.log(`Created parameter template "${name}" (units: ${units}).`);
}

(async () => {
  const token = await getToken();
  await ensureCategory(token, 'Electronics');
  await ensureParameterTemplate(token, 'Resistance', 'ohm');
  console.log('Seed complete.');
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
