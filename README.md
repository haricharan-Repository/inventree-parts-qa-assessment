# InvenTree Parts Module — Agent-Assisted QA Assessment

An end-to-end, agent-assisted QA workflow against the **Parts module** of
[InvenTree](https://github.com/inventree/InvenTree) (open-source Python/Django inventory
management): requirements ingestion → manual test case generation → API schema analysis → runnable
API and UI automation, **both verified against a live InvenTree instance**. Built with
**Claude Code** (Sonnet 5) as the agent, per the assessment brief in
`Quality Architect Hiring (1) 1.pdf`.

## Repository layout

```
├── README.md                        # this file
├── CLAUDE.md                        # agent configuration Claude Code auto-loads for this repo
├── .github/workflows/playwright.yml # CI: stands up InvenTree, runs both suites, uploads reports
├── agents/                          # agent artefacts (prompts, instructions, research)
│   ├── prompts.md                   # chronological prompt log
│   ├── system-instructions.md       # operating brief the agent worked under
│   └── context/                     # research ingested from InvenTree docs, feeds test-case generation
│       ├── parts-requirements-summary.md
│       └── api-schema-summary.md
├── test-cases/
│   ├── ui-manual-tests.md           # Phase 1 — 80+ UI/manual test cases
│   └── api-manual-tests.md          # Phase 2 — 50+ API manual test cases
├── automation/
│   ├── api/                         # Phase 2 — runnable Playwright API test project (60/60 passing live)
│   │   └── scripts/teardown.js      # deletes this run's QA-prefixed test data (globalTeardown)
│   └── ui/                          # Phase 3 — runnable Playwright UI test project, POM (10/10 passing live)
│       └── scripts/{seed,teardown}.js
└── video/                           # Phase C deliverable — NOT YET RECORDED, see video/README.md
```

## Tool choices

| Decision | Choice | Why |
|---|---|---|
| Agent | Claude Code (Sonnet 5) | Full agentic loop (web research → file authoring → dependency install → live-instance debugging → type-check) in one session |
| Automation language | TypeScript | One language for both API and UI suites |
| API automation | Playwright `request` fixture | Same toolchain as UI suite; first-class assertions on status/JSON, no separate HTTP client dependency |
| UI automation | Playwright + Page Object Model | Auto-waiting locators, trace/video-on-failure built in, resilient role-based selectors |
| Target instance | `docker compose up` from the InvenTree repo, `http://localhost:8000` | Per the brief's suggested local setup |

Both automation projects were built against static documentation first, then **actually stood up
against a live `docker compose up` InvenTree 1.5.2 instance and debugged until green**: the API
suite is **60/60 passing**, the UI suite **10/10 passing**, both confirmed stable across repeated
runs. See "Corrections made against the live instance" below and each project's own README for
the full list of what that debugging pass found and fixed.

## Approach summary

1. **Phase 1 — Requirements analysis**: fetched the InvenTree Parts docs (`/part/`, `/part/views/`,
   `/part/template/`, `/part/revision/`, `/part/test/`, `/concepts/parameters/`,
   `/concepts/units/`) via `WebFetch`, consolidated into
   [`agents/context/parts-requirements-summary.md`](agents/context/parts-requirements-summary.md),
   then generated [`test-cases/ui-manual-tests.md`](test-cases/ui-manual-tests.md) — 80+ cases
   across part creation (manual + import), all 10 detail-view tabs, categories, the 9 boolean
   attributes, units of measure, revisions with their documented constraints, and cross-cutting
   negative/boundary scenarios.
2. **Phase 2 — API spec analysis & tests**: fetched
   `https://docs.inventree.org/en/stable/api/schema/part/`, consolidated into
   [`agents/context/api-schema-summary.md`](agents/context/api-schema-summary.md), generated
   [`test-cases/api-manual-tests.md`](test-cases/api-manual-tests.md) (CRUD, filtering/pagination/
   search, field validation, relational integrity, edge cases), then implemented the highest-value
   subset as runnable, data-driven Playwright tests in [`automation/api/`](automation/api/).
3. **Phase 3 — UI automation**: implemented core Part CRUD flows, several detail-tab checks, and
   the required cross-functional flow (create part → add parameter → create stock → verify in
   category view) as Playwright + POM tests in [`automation/ui/`](automation/ui/).
4. **Live verification pass**: stood up InvenTree via `docker compose up`, discovered and fixed
   the one-time setup steps the stock image needs (static file collection, superuser creation —
   see below), then ran both suites repeatedly against it, fixing every real failure until both
   were green and stable. This is the largest source of genuine corrections in this repo — static
   API docs and inferred UI structure both turned out to have real gaps, listed in full below.

Full prompt-by-prompt detail is in [`agents/prompts.md`](agents/prompts.md).

## Running against a live instance

```bash
git clone https://github.com/inventree/InvenTree.git
cd InvenTree/contrib/container
docker compose up -d
```

A fresh image needs two one-time steps beyond `docker compose up` before it's usable at all —
neither is an InvenTree default, and both were discovered the hard way during this session (see
corrections #1 and #2 below):

```bash
# 1. Collect static files — the stock image does not run this on first boot, so the Platform
#    UI's own JS bundle 404s and every page renders blank until it does.
docker compose exec inventree-server invoke static

# 2. Create a superuser — none is auto-created unless INVENTREE_ADMIN_* was set before first boot.
docker compose exec -e DJANGO_SUPERUSER_USERNAME=admin -e DJANGO_SUPERUSER_EMAIL=admin@example.com \
  -e DJANGO_SUPERUSER_PASSWORD=inventree inventree-server \
  sh -c "cd src/backend/InvenTree && python3 manage.py createsuperuser --noinput"
```

Then, for each automation project:

```bash
cd automation/api   # or automation/ui
npm install
npx playwright install --with-deps   # UI project only
cp .env.example .env                 # adjust BASE_URL / credentials if needed
npm test
```

The UI project additionally needs `npm run seed` once (creates the "Electronics" category and
"Resistance" parameter template a couple of test cases reference by name — idempotent, safe to
re-run). The API project needs a second, non-admin user for the permission-check test — see
`automation/api/README.md` → "Setup" for the exact command (a plain
`User.objects.create(...)` isn't enough — see correction #3 below).

See [`automation/api/README.md`](automation/api/README.md) and
[`automation/ui/README.md`](automation/ui/README.md) for full per-project setup, run instructions,
and which manual test-case IDs each spec file covers.

## Corrections made against the live instance

Per the brief's "document what you changed and why" — this is the substantial list; each
project's own README has the same list scoped to its own tests plus the exact fix.

**Environment / setup** (would block *any* automated testing, not specific to this suite):
1. The stock `inventree/inventree:stable` Docker image does not run Django's `collectstatic` on
   first boot — the Platform UI's JS bundle 404s and every page renders blank (confirmed via
   browser console: `Failed to load resource: 404` on `/static/web/assets/*.js`) until
   `invoke static` is run manually inside the container.
2. No superuser is auto-created unless `INVENTREE_ADMIN_*` env vars were set *before* first boot
   — created one non-interactively via `manage.py createsuperuser --noinput` instead.
3. A user created directly via `User.objects.create(...)` in the Django shell has no
   `UserProfile` row (which the app assumes always exists), and `GET /api/user/token/` for that
   user crashes with a `500` rather than a clean auth error — fixed by also creating the
   `UserProfile` row for any shell-created test user.

**API automation** (`automation/api/` — see its README for the full numbered list):
4. Playwright's `httpCredentials` (challenge-response Basic auth) never fires against this API,
   because its `401` response carries no `WWW-Authenticate` header — fixed by sending the Basic
   auth header preemptively, like `curl -u` does.
5. `GET /api/part/` only returns the paginated envelope when `limit`/`offset` is present;
   otherwise it's a bare array — every list assertion now passes `limit=`.
6. Deleting a part is unconditionally rejected while `active=true`, regardless of what
   references it — the original API-P-10 case's assumption (a stock reference alone blocks
   deletion) was wrong; verified a deactivated part with only stock references deletes
   successfully, while a BOM reference still blocks it even once inactive.
7. `DELETE /api/part/category/{id}/` requires a JSON body (`delete_child_categories`,
   `delete_parts`) — undocumented on the static schema page; a bodyless DELETE returns `400` and
   deletes nothing.
8. Two endpoints were at different paths than the static docs implied: BOM lines at `/api/bom/`
   (not `/api/part/bom-item/`), parameter templates at `/api/parameter/template/` (not
   `/api/part/parameter/template/`).
9. DRF's `BooleanField` coerces truthy/falsy strings (`"yes"` → `true`) rather than rejecting
   them — the invalid-boolean test now uses a genuinely non-coercible value.
10. Postgres's collation-based `ordering=` doesn't match plain codepoint comparison or JS's
    `localeCompare` — the ordering test now asserts the algorithm-independent property that
    descending is the exact reverse of ascending, rather than re-deriving the sort order client-side.

**UI automation** (`automation/ui/` — see its README for the full numbered list):
11. InvenTree labels most interactive elements with stable, test-id-like `aria-label`s
    (`text-field-name`, `action-menu-add-parts`, `boolean-field-active`, ...) that differ from
    the visible label text — every selector now matches on those instead of `getByLabel`.
12. `/web/part` lands on the Categories browser, not a flat Parts list — the actual list is a
    sub-tab that has to be clicked into.
13. "New Part" is reached via a two-step "Add Part" dropdown menu, not a single button.
14. The part header is a `<p>`, not a semantic heading, and reads `"Part: <IPN> | <name>"` when
    an IPN is set — `expectLoaded()` was asserting an exact string that only matched sometimes.
15. Deleting a part via the UI is blocked identically to the API (disabled Delete menu item while
    active) — `deletePart()` now deactivates via Edit first.
16. Creating a stock item navigates to the new Stock Item's own page, not back to the part.
17. Category rows are plain table cells, not links — and the Name/Path columns both render the
    category name for a root category, so `.first()` is required to disambiguate.
18. A stable "Electronics" category and "Resistance" parameter template don't exist on a fresh
    instance — added `npm run seed` rather than have two test cases silently fail on missing data.

**Found during a post-review hardening pass** (see "Post-review hardening" below):
19. The "Add Part" category combobox renders an inline text preview of the matched value inside
    the input itself while filtering — a second, ambiguous match for a bare
    `getByText(categoryName)` alongside the real dropdown option. This caused an intermittent
    click-timeout on PC-06 that reproduced reliably when run as part of the full suite but not in
    isolation (render/GC timing-dependent). Fixed by scoping to `getByRole('option', ...)`,
    matching the popover's real ARIA structure — confirmed stable across 3 repeated full-suite runs.
20. The guessed BOM tab name ("BOM") was wrong — the real tab, confirmed by creating an actual
    assembly/template/testable part, is labelled **"Bill of Materials"**.
21. There is **no separate "Revisions" tab at all** — confirmed by creating a real revision pair.
    The revision switcher is a "Select Part Revision" dropdown rendered inside the *Part Details*
    tab's own content. The original `PartTab` type included a tab that never existed.
22. Two test-data name literals didn't carry the "QA " prefix every other test uses (a
    `Resistor<timestamp>` search keyword, and the boundary-length string generator) — found only
    once a cleanup script existed to *notice* untracked data was leaking past it. Both fixed to
    carry the prefix.
23. The cross-functional flow's final assertion used an unanchored `getByText(/50/)` to confirm a
    stock quantity appeared in a category's part list row — but every test part's name embeds a
    millisecond timestamp for uniqueness, which can itself coincidentally contain the substring
    "50" (this genuinely happened live, matching the name cell instead of the stock cell and
    causing a strict-mode violation). The "Total Stock" cell's full text is exactly `"50"` with
    nothing else, so `getByText('50', { exact: true })` unambiguously targets only that cell.

## Test data hygiene

Every test names what it creates with a "QA " prefix (see `automation/api/utils/testData.ts`).
Each project's `playwright.config.ts` wires a `globalTeardown` (`scripts/teardown.js`) that
deletes everything matching that prefix once, after the full suite finishes — so repeated runs
against a shared instance don't accumulate data forever. It does **not** touch the `npm run seed`
fixtures ("Electronics", "Resistance"), since neither starts with "QA ". Runnable standalone too:
`npm run teardown` in either project.

This was added after discovering — by actually counting rows on the live instance used for the
"Corrections made against the live instance" work above — that a day of iterative debugging had
left **397 parts and 125 categories** behind on what started as a fresh install. The teardown
script cleaned up 100% of them on its first run once every test's naming was made consistent
(finding and fixing the two non-conforming names in correction #22 above was itself a direct
result of testing the teardown against real accumulated data).

## Automation coverage — what's automated vs backlog

The automation suites implement the **highest-value subset** of the manual test cases, not full
parity with all 130+ of them — intentional scoping, made explicit here rather than left as an
implicit gap:

**Automated (API):** CRUD on parts/categories, filtering/pagination/search, field-level
validation (required/max-length/nullable/read-only/type coercion), revision validation rules
(circular reference, template restriction, duplicate revision code), relational integrity
(category assignment, BOM component/sub-component rules, category-delete reassignment), and
auth/edge cases (unauthenticated, insufficient permission, malformed payloads, SQL-injection-style
input).

**Automated (UI):** part creation (manual, with/without category), required-field validation,
adding a parameter, creating a stock item, conditional-tab visibility (Variants/Test Templates
hidden for a plain part), part deletion (including the deactivate-first requirement), and the
required cross-functional flow (create → parameter → stock → category view).

**Not yet automated** (documented backlog, not an accident):
- Part **import/bulk-import** flow (`test-cases/ui-manual-tests.md` PI-01..06)
- **Variant creation** flow and template/variant stock consolidation (PDV-14..16)
- **Test Template** creation and required-test enforcement on stock results (PDV-23..26)
- Full **BOM lifecycle** via the UI (add/edit/remove lines, not just the API-level component rule)
- **Attachments** upload/delete, **Related Parts** linking (PDV-19..21)
- **Units of measure** edge cases — engineering notation, custom units, imperial shorthand (UOM-02..06)
- **Category** structural/default-location inheritance (CAT-07..08)
- **Concurrency** scenarios — concurrent edit conflicts, DELETE race conditions beyond the basic
  idempotency check already covered (NEG-07, API-E-08)

## Post-review hardening

After an initial "is this good, any suggestions?" architectural review, the following were added:
a `globalTeardown` in both projects (see "Test data hygiene" above), the explicit coverage-backlog
list above, a GitHub Actions workflow (`.github/workflows/playwright.yml` — stands up InvenTree,
runs both suites, uploads HTML reports as artifacts), and closing the one remaining
unverified-selector risk (corrections #19-22 above). One suggestion — enabling `fullyParallel`/
multiple workers — was deliberately **not** applied: several tests (the pagination assertions in
`API-F-08/09`, the shared "Electronics"/"Resistance" seed fixtures) assume the sequential,
single-worker ordering this suite already relies on; parallelizing safely would need those
rewritten to not depend on total counts or shared fixture state first. Documented here as a
conscious deferral, not an oversight.

## Video

Not yet recorded — see [`video/README.md`](video/README.md) for exactly what it needs to cover
(now including the live-debugging pass above, which is exactly the "iterative refinement" the
brief's video requirement asks for) and how to add it once captured.
