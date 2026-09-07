# InvenTree Parts UI — Automation (Playwright / TypeScript, Page Object Model)

Runnable UI test suite implementing the core flows from
[`../../test-cases/ui-manual-tests.md`](../../test-cases/ui-manual-tests.md). **Verified against
a live InvenTree 1.5.2 instance** (`docker compose up`, stock `inventree/inventree:stable`
image) — 10/10 tests passing, confirmed stable across repeated runs. See "Corrections made
against the live instance" below for what that verification pass actually found and fixed.

| File | Manual cases covered |
|---|---|
| `tests/part-crud.spec.ts` | PC-01, PC-02, PC-03, PC-06, + a delete flow |
| `tests/part-detail-tabs.spec.ts` | PDV-01, PDV-02, PDV-09, PDV-10, PDV-13, PDV-22 |
| `tests/cross-functional-flow.spec.ts` | Phase 3's required cross-functional journey: create part → add parameter → add stock → verify in category view |

## Setup

A fresh `docker compose up` InvenTree instance needs three one-time steps beyond just starting
the containers before this suite (or InvenTree's own Platform UI) is usable at all — none of
these are InvenTree defaults, and skipping any of them will make the suite fail in confusing
ways:

```bash
# From an InvenTree checkout, contrib/container/:
docker compose up -d

# 1. The stock image does not run collectstatic on first boot, so the Platform UI's own JS
#    bundle 404s and every page renders blank until this runs:
docker compose exec inventree-server invoke static

# 2. No superuser is auto-created unless INVENTREE_ADMIN_* was set before first boot. Create one
#    non-interactively (Django's createsuperuser --noinput honours these DJANGO_SUPERUSER_* env vars):
docker compose exec -e DJANGO_SUPERUSER_USERNAME=admin -e DJANGO_SUPERUSER_EMAIL=admin@example.com \
  -e DJANGO_SUPERUSER_PASSWORD=inventree inventree-server \
  sh -c "cd src/backend/InvenTree && python3 manage.py createsuperuser --noinput"
```

Then:

```bash
cd automation/ui
npm install
npx playwright install --with-deps   # only needed the first time on a machine
cp .env.example .env                 # edit BASE_URL / credentials if not using defaults

# 3. Seed the fixed-name fixtures PC-06 and the cross-functional flow reference by name
#    (idempotent — safe to re-run):
npm run seed
```

## Test data cleanup

Every test names what it creates with a "QA " prefix. `playwright.config.ts` wires
`scripts/teardown.js` as a `globalTeardown` — it runs once after the full suite finishes and
deletes everything matching that prefix, so repeated runs don't accumulate data on a shared
instance. It never touches the `npm run seed` fixtures ("Electronics", "Resistance"). Also
runnable standalone: `npm run teardown`.

## Run

```bash
npm test               # headless run, HTML report + trace/video on failure
npm run test:ui        # Playwright's interactive UI mode — useful while fixing selectors
npx playwright test tests/part-crud.spec.ts
```

`global-setup.ts` logs in once via the real login form and persists `storageState.json`, which
every test then reuses — avoids re-authenticating per spec.

Also runs in CI: `.github/workflows/playwright.yml` at the repo root stands up InvenTree from
scratch, runs both suites, and uploads the HTML reports as build artifacts on every push/PR.

## Design notes

- **Page Object Model**: `pages/LoginPage.ts`, `pages/PartsListPage.ts`, `pages/PartDetailPage.ts`,
  `pages/CategoryPage.ts` encapsulate selectors and interactions; specs read as user journeys, not
  selector soup.
- **Locators**: role-based (`getByRole`) throughout, matching on InvenTree's own stable
  aria-labels (`text-field-name`, `action-menu-add-parts`, `boolean-field-active`, ...) rather
  than visible label text — see "What the live verification pass found" below for why.
- **Waits**: no fixed `page.waitForTimeout()` calls in any spec or page object. Every wait is an
  `expect(...)` assertion with Playwright's built-in auto-retry, or a `page.waitForURL()`.
- **Cross-functional flow**: `tests/cross-functional-flow.spec.ts` is structured with
  `test.step(...)` so a failure clearly identifies which stage of the journey (create / parameter /
  stock / category verification) broke, and the report renders each stage separately.

## Corrections made against the live instance

The first drafts of these page objects were written from InvenTree's documented UI behaviour
(`agents/context/parts-requirements-summary.md`) without a running instance (see the project root
`README.md` → "Test target" decision at the time). Running the suite against a real
`docker compose up` instance surfaced the following, all now fixed — this is the "iterative
refinement" the assessment's video requirement asks to capture:

1. **Accessible names are stable aria-labels, not visible text.** InvenTree labels most
   interactive elements with test-id-like `aria-label`s (`text-field-name`, `tree-field-category`,
   `action-menu-add-parts`, `boolean-field-active`, ...) that differ from the on-screen label —
   e.g. `getByLabel(/password/i)` matched *two* elements (the field and the "Toggle password
   visibility" button, which shares the same accessible label group). Fixed by matching on
   `getByRole(<role>, { name: '<aria-label>' })` throughout instead of `getByLabel`.
2. **`/web/part` lands on the Categories browser, not a Parts list.** The flat Parts list is a
   sub-tab (`panel-tabs-partcategory` → "Parts") that has to be clicked into.
3. **"New Part" is actually "Add Part", reached via a dropdown menu** (`action-menu-add-parts` →
   `action-menu-add-parts-create-part`), not a single visible button.
4. **The part header has no semantic heading element** — it's a `<p>`, so
   `getByRole('heading', ...)` never matches. It also reads `"Part: <IPN> | <name>"` when an IPN
   is set, not always `"Part: <name>"` — `expectLoaded()` now does a substring/regex match.
5. **Deleting a part is blocked while it is `active`** — confirmed both via the API (`400`,
   `"Cannot delete this part as it is still active"`) and the UI (the Delete menu item is
   `disabled` in the DOM until the part is deactivated via Edit first). `deletePart()` now
   deactivates before deleting.
6. **Creating a stock item navigates away** to the new Stock Item's own detail page, not back to
   the part's Stock tab — `addStockItem()` now asserts the item's own quantity badge there, then
   returns via `page.goBack()`.
7. **Category rows aren't links.** Table cells, not `<a>` elements — navigated by clicking the
   cell (and `.first()` is needed: the Name and Path columns both render the category name for a
   root category, so the same text matches twice).
8. **Parameter templates and a stable "Electronics" category don't exist on a fresh instance** —
   PC-06 and the cross-functional flow reference them by name, so `npm run seed` creates them
   (see "Setup" above) rather than the tests silently failing on missing fixture data.

**Found during a later post-review hardening pass** (root `README.md` → "Post-review hardening"):

9. **The category combobox renders an inline preview of the matched value inside the input
   itself while filtering** — a second, ambiguous match for a bare `getByText(categoryName)`
   alongside the real dropdown option. This caused PC-06 to intermittently time out, but only
   when run as part of the full suite (never in isolation) — a render/GC-timing-dependent race,
   not a deterministic failure, which made it easy to miss on a single passing run. Fixed by
   scoping to `getByRole('option', { name: /category/ })`, matching the popover's real ARIA
   structure (confirmed via `ariaSnapshot()`) — stable across 3 repeated full-suite runs after
   the fix, where it had failed reliably before.
10. **The BOM tab's real label is "Bill of Materials"**, not "BOM" — confirmed by creating an
    actual `assembly=true` part rather than only spot-checking parts without that flag.
11. **There is no "Revisions" tab at all.** Confirmed by creating a real revision pair: the
    switcher is a "Select Part Revision" dropdown inside the *Part Details* tab's own content, not
    a sibling tab. `PartTab` no longer includes a tab that never existed; use
    `expectRevisionSelectorVisible()` instead of `openTab('Revisions')`.
12. **The cross-functional flow's final assertion used an unanchored `getByText(/50/)`** to
    confirm a stock quantity appeared in a category's part list row. Every test part's name
    embeds a millisecond timestamp for uniqueness, which can itself coincidentally contain the
    substring "50" — this genuinely happened live (a strict-mode violation matched the name cell
    instead of the stock cell). The "Total Stock" cell's full text is exactly `"50"` with nothing
    else in it, so `getByText('50', { exact: true })` unambiguously targets only that cell.
