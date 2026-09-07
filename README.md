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
│   └── ui/                          # Phase 3 — runnable Playwright UI test project, POM (10/10 passing live)
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

## Video

Not yet recorded — see [`video/README.md`](video/README.md) for exactly what it needs to cover
(now including the live-debugging pass above, which is exactly the "iterative refinement" the
brief's video requirement asks for) and how to add it once captured.
