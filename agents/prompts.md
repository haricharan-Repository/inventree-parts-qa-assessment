# Agent Prompt Log

Chronological record of the prompts/instructions used to drive the agent (Claude Code, Sonnet 5)
through this assessment. This is a condensed, faithful log — not a verbatim transcript (see
`agents/conversation-notes.md` for the session narrative). Each entry names the tool the agent
invoked and the instruction given to it.

## 0. Task kickoff

**User → Agent:** Provided the assessment PDF (`Quality Architect Hiring (1) 1.pdf`) and the
instruction: *"based on the requirement create the project."*

**Agent → User (clarifying questions, via `AskUserQuestion`):**
1. "Which automation stack should I use for the API and UI automation scripts?" →
   user selected **TypeScript: Playwright API testing + Playwright UI**.
2. "Do you already have a running InvenTree instance ... or should I set up config for a
   not-yet-running local instance?" → user selected **not running yet — configure for
   localhost defaults**.

These answers fixed the tooling decisions recorded in `agents/system-instructions.md`.

## 1. Requirements ingestion (Phase 1 grounding) — `WebFetch`

Each call below used the pattern *"fetch URL, extract X"* so the returned summary could be
directly folded into `agents/context/parts-requirements-summary.md`:

- `https://docs.inventree.org/en/stable/part/` — *"List all sub-pages/links related to Parts
  documentation ... Also summarize the full content of this main Parts page: part attributes
  (Virtual, Template, Assembly, Component, Trackable, Purchaseable, Salable, Active/Inactive),
  IPN, part creation fields, and any other key concepts described."*
- `https://docs.inventree.org/en/stable/part/views/` — *"Summarize all part detail view tabs
  ... and what each tab shows/does. Also describe the part creation form fields (manual entry),
  and any import flow. List field names, required/optional status, validation rules."*
- `https://docs.inventree.org/en/stable/concepts/parameters/` — *"Summarize how Part Parameters
  work: parameter templates, units, part parameter values, parametric tables/filtering,
  validation rules, required vs optional."*
- `https://docs.inventree.org/en/stable/part/template/` — *"Summarize Part Templates and
  Variants: how template parts work, creating variants, template restrictions, virtual/template
  attribute interactions, any constraints."*
- `https://docs.inventree.org/en/stable/part/revision/` — *"Summarize Part Revisions: how to
  create a revision, constraints such as circular references, unique codes, template
  restrictions, revision-of-revision prevention, and any other rules."*
- `https://docs.inventree.org/en/stable/concepts/units/` — *"Summarize Units of Measure
  configuration for parts: how units are defined, custom units, unpacking rules, validation."*
- `https://docs.inventree.org/en/stable/part/test/` — *"Summarize Test Templates for parts: how
  to define required tests, test result recording, attributes (required, requires value,
  requires attachment), and constraints."*
- `https://docs.inventree.org/en/stable/part/category/` and `.../part/creation/` — attempted for
  Part Categories and the dedicated creation-flow page; both returned `404`. Followed up with a
  broader fetch of the docs root asking the agent to locate the correct hrefs — nav snippet did
  not expose them either. Resolved by **explicitly labelling category/creation behaviour not
  directly confirmed by a fetched page as `[inferred]`** in the context summary, to be verified
  against a running instance rather than silently presented as confirmed documentation.

## 2. API schema ingestion (Phase 2 grounding) — `WebFetch`

- `https://docs.inventree.org/en/stable/api/schema/part/` — *"Describe the API schema for Parts
  and Part Categories endpoints: list of endpoints (paths), HTTP methods supported, key
  request/response fields, required fields, field types, read-only fields, filtering/search/
  pagination query parameters, and any nested/related resources exposed via API."*

Result folded into `agents/context/api-schema-summary.md`, including endpoint table, field
reference tables (with required/read-only columns), filter/search/pagination parameters, and a
"Conflict / Integrity Scenarios" section used directly to seed Phase 2 negative test cases.

## 3. UI manual test case generation (Phase 1 deliverable)

**Instruction the agent followed:** *"Using `agents/context/parts-requirements-summary.md` as
the source of truth, generate a comprehensive UI/manual test suite in
`test-cases/ui-manual-tests.md` covering: part creation (manual + import), every part detail tab
listed in §4, part categories, all boolean attributes in §2, units of measure, revisions and
their constraints (§5), and negative/boundary scenarios (§11). Each case needs: ID, title,
preconditions, numbered steps, expected result, priority, and type (positive/negative/boundary).
Group into logical sections matching the brief's checklist so coverage is auditable line-for-line
against the assessment PDF."*

## 4. API manual test case generation (Phase 2 deliverable, manual part)

**Instruction the agent followed:** *"Using `agents/context/api-schema-summary.md`, generate a
manual API test suite in `test-cases/api-manual-tests.md` covering CRUD on Parts and Categories,
filtering/pagination/search on the list endpoint, field-level validation (required, max length,
nullable, read-only), relational integrity (category assignment, default location, supplier
linkage), and edge cases (invalid payloads, unauthorised access, conflict scenarios). Same
structured format as the UI suite, plus expected HTTP status code per case."*

## 5. API automation generation (Phase 2 deliverable, automated part)

**Instruction the agent followed:** *"Build a runnable TypeScript Playwright project under
automation/api/ implementing the highest-value cases from api-manual-tests.md: CRUD, filtering/
pagination/search, field validation, relational integrity, and edge cases (auth, conflicts,
invalid payloads). Use Playwright's `request` fixture, a shared authenticated API context via
storageState/token, data-driven `test.describe.parametrize`-style loops for boundary/validation
matrices, and assert status code + response shape + business-rule outcome for every case. Default
target http://localhost:8000, configurable via .env, and fail fast with a clear error if the
instance isn't reachable rather than hanging."*

## 6. UI automation generation (Phase 3 deliverable)

**Instruction the agent followed:** *"Build a runnable TypeScript Playwright project under
automation/ui/ implementing the core Part CRUD flows and detail-tab checks from
ui-manual-tests.md, using the Page Object Model. Include at least one cross-functional flow:
create a part → add a parameter → create a stock item → verify it surfaces in the category's
part list. Use role/label-based locators and explicit `expect(...).toBeVisible()` /
network-settled waits rather than fixed sleeps, and centralise the base URL / credentials in a
single fixture."*

## 6b. Live-verification follow-up

**User → Agent:** *"is everything done as per the requirement"* → agent gave an honest itemized
gap report (no live instance run, no literal `CLAUDE.md` agent-config file, no git commit, video
not recorded). **User → Agent:** *"yes"* (to all three offered next steps: start Docker and run
the suites live, add a config file, commit). This is what triggered §8 below.

## 7. Corrections applied before any live instance existed

1. Two documentation sub-pages guessed from the nav structure (`/part/category/`,
   `/part/creation/`) returned `404`. Rather than inventing behaviour, the context summary
   explicitly marked Part Category and creation/import-flow details sourced this way as
   `[inferred]`, to be re-verified against a running instance (see §8 — this is exactly what the
   live pass then did).
2. The first draft of `automation/ui/tests/part-crud.spec.ts` (case PC-03) reached into a
   `PartsListPage` instance's private `page` field via bracket-notation (`partsListPage['page']`)
   to submit an empty form — a Page-Object-Model leak. Replaced with a proper
   `submitOpenForm()` method on `PartsListPage`, keeping the page's internals encapsulated.
3. Both automation projects (`automation/api`, `automation/ui`) were `npm install`'d and
   type-checked (`npx tsc --noEmit`) after generation — both passed with zero errors on the
   first check, so no compilation fixes were required at this stage.

## 8. Live-instance verification pass — the real correction record

After the user confirmed Docker was available, the session stood up InvenTree for real
(`git clone` + `docker compose up` in a scratch directory) and ran both suites against it
repeatedly, fixing every genuine failure until both were green and stable across repeated runs
(API: 60/60, UI: 10/10). This — not the static-docs-only drafting above — is where almost all of
the assessment's "document what you changed and why" requirement actually comes from, since the
static InvenTree docs simply don't cover several of these behaviours at all.

**Environment (would block any testing, not this suite specifically):**
- The stock `inventree/inventree:stable` image never ran `collectstatic` — every Platform UI page
  was a blank white screen with a wall of `404`s in the browser console for `/static/web/assets/
  *.js`. Found by checking `page.on('console'/'requestfailed')` output, not the screenshot alone.
  Fixed with `invoke static` inside the `inventree-server` container.
- No superuser existed (`INVENTREE_ADMIN_*` wasn't set before first boot) — created one with
  `manage.py createsuperuser --noinput` + `DJANGO_SUPERUSER_*` env vars.
- A user created directly via `User.objects.create_user(...)` in the Django shell has no
  `UserProfile` row; `GET /api/user/token/` for that user crashed with `500
  RelatedObjectDoesNotExist: User has no profile` rather than a clean auth error. This one cost
  real debugging time: the symptom (500 on a token-fetch endpoint) gives no hint that the actual
  cause is a missing *profile* row on the *user*, not a token or auth-header problem. Root-caused
  by reading the Django error response body (`{"error": "RelatedObjectDoesNotExist", ...}`) and
  the server's structured log output via `docker compose logs`, then fixed by also creating
  `UserProfile.objects.get_or_create(user=u)`.

**API suite (`automation/api/`) — see its README for the fully detailed list:**
- Playwright's `httpCredentials` never sent Basic auth at all, because InvenTree's `401` responses
  carry no `WWW-Authenticate` header and Playwright (unlike `curl -u`) only sends Basic auth after
  such a challenge. Diagnosed by comparing `curl -i -u ...` (worked) against the Playwright fixture
  (didn't) and inspecting response headers directly.
- `GET /api/part/` returns a bare array without `limit=`/`offset=`, not the documented paginated
  envelope — found because `body.results` was `undefined` on first run, and the actual response
  body (piped through `python3 -m json.tool`) turned out to be a plain array of ~50 objects.
- Deleting an *active* part is unconditionally rejected (`400`) regardless of what references it —
  found because API-P-07 (delete an unreferenced part) failed with a `400` it had no reason to get;
  reading the error body directly (`curl ... -X DELETE`) surfaced
  `"Cannot delete this part as it is still active"`. This also invalidated the original assumption
  behind API-P-10 (that a stock reference specifically blocks deletion) — verified via a targeted
  curl sequence (create part + stock → deactivate → delete) that stock alone does **not** block
  deletion once inactive, while a BOM reference (verified the same way) still does.
- `DELETE /api/part/category/{id}/` needs a JSON body (`delete_child_categories`, `delete_parts`)
  — found the same way, by reading the `400` response body directly rather than trusting the
  assumed contract.
- `/api/bom-item/` and `/api/part/parameter/template/` both 404'd; found the real paths
  (`/api/bom/`, `/api/parameter/template/`) by downloading the instance's own OpenAPI schema
  (`GET /api/schema/`) and grepping its `paths` for the resource name, rather than guessing again.
- `assembly: "yes"` was accepted as `true` (DRF's `BooleanField` coerces common truthy strings) —
  found because the "invalid boolean" negative test unexpectedly got a `201`.
- Re-implementing Postgres's collation-based `ordering=name` sort client-side (first with
  `localeCompare`, then with plain codepoint comparison) never matched the server's actual order
  in either direction — abandoned that approach entirely in favour of asserting the
  algorithm-independent property that descending is the exact reverse of ascending.
- A boundary-length test using a fixed 100-`A` string for `name` broke on the *second* run of the
  suite (`Part.name` is part of a uniqueness set with IPN+revision) — found by literally re-running
  the suite twice in a row to check for state-pollution issues, which is what surfaced it.

**UI suite (`automation/ui/`) — see its README for the fully detailed list:**
- Discovered via Playwright's `ariaSnapshot()` (an accessibility-tree dump) on each screen rather
  than guessing selectors blind: InvenTree labels most interactive elements with stable,
  test-id-like `aria-label`s (`text-field-name`, `action-menu-add-parts`, `boolean-field-active`,
  `tree-field-category`, `related-field-template`, ...) that differ entirely from the visible
  label text. Every locator was rewritten to match on these instead of `getByLabel`.
- `/web/part` opens the Categories browser, not a flat Parts list — the list is a same-named
  sub-tab that has to be clicked into; found by screenshotting after `page.goto('/web/part')` and
  seeing a category table, not a part table.
- `getByLabel(/password/i)` matched two elements (the password field and the "Toggle password
  visibility" button, which share an accessible-name group) — a strict-mode violation surfaced
  immediately on the first real login attempt; fixed by scoping to `getByRole('textbox', ...)`.
- The part detail header renders as a `<p>`, not a heading, and reads `"Part: <IPN> | <name>"`
  once an IPN is set rather than always `"Part: <name>"` — found because PC-02 (which sets an IPN)
  failed an exact-text assertion that PC-01 (no IPN) passed.
- Deleting a part in the UI is blocked identically to the API (disabled Delete menu item while
  active) — found the same way, by inspecting the `ariaSnapshot()` of the open Actions menu and
  seeing `[disabled]` on the Delete `menuitem`.
- Creating a stock item navigates to the new Stock Item's own detail page, not back to the part —
  found because the post-submit `page.url()` didn't match the expected pattern.
- Category table rows are plain `<td>` cells, not `<a>` links — `getByRole('link', {name:
  categoryName})` matched nothing; found via `ariaSnapshot()` again, which showed `cell`, not
  `link`, roles.
- A stable "Electronics" category and "Resistance" parameter template don't exist on a fresh
  instance (two test cases reference them by name) — added an idempotent `npm run seed` script
  rather than have those tests silently fail on missing fixture data.
