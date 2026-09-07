# InvenTree Parts API — Automation (Playwright / TypeScript)

Runnable API test suite implementing the highest-value cases from
[`../../test-cases/api-manual-tests.md`](../../test-cases/api-manual-tests.md), grouped to mirror
that document's sections. **Verified against a live InvenTree 1.5.2 instance**
(`docker compose up`, stock `inventree/inventree:stable` image) — 60/60 tests passing, confirmed
stable across repeated runs. See "Corrections made against the live instance" below for what that
verification pass actually found and fixed.

| File | Manual cases covered |
|---|---|
| `tests/parts-crud.spec.ts` | API-P-01..10 |
| `tests/categories-crud.spec.ts` | API-C-01..08 |
| `tests/filtering-pagination-search.spec.ts` | API-F-01..13 |
| `tests/field-validation.spec.ts` | API-V-01..13 |
| `tests/relational-integrity.spec.ts` | API-R-01, 02, 05, 06, 07 |
| `tests/edge-cases.spec.ts` | API-E-01, 03, 04, 05, 07, 09, 10, 11, 12 |

## Setup

A fresh `docker compose up` InvenTree instance needs one manual step before the API is fully
usable — the stock image doesn't auto-create a superuser unless `INVENTREE_ADMIN_*` was set
before first boot:

```bash
# From an InvenTree checkout, contrib/container/:
docker compose up -d

docker compose exec -e DJANGO_SUPERUSER_USERNAME=admin -e DJANGO_SUPERUSER_EMAIL=admin@example.com \
  -e DJANGO_SUPERUSER_PASSWORD=inventree inventree-server \
  sh -c "cd src/backend/InvenTree && python3 manage.py createsuperuser --noinput"
```

Then:

```bash
cd automation/api
npm install
npx playwright install --with-deps   # only needed the first time on a machine
cp .env.example .env                 # edit BASE_URL / credentials if not using defaults
```

Default `.env` targets `http://localhost:8000` with `admin` / `inventree` — change these to match
your instance.

`API-E-03` (insufficient-permission check) additionally needs a second, non-admin InvenTree user
with no add/change permissions. Create one (e.g. via the Django shell, since the UI's own user
management needs an existing session):

```bash
docker compose exec inventree-server sh -c "cd src/backend/InvenTree && python3 manage.py shell -v 0" <<'PY'
from django.contrib.auth import get_user_model
from users.models import UserProfile
User = get_user_model()
u, _ = User.objects.get_or_create(username='readonly', defaults={'email': 'readonly@example.com'})
u.set_password('readonlypass')
u.is_superuser = False
u.save()
UserProfile.objects.get_or_create(user=u)  # see correction #3 below — required or token auth 500s
PY
```

Set `READONLY_USERNAME` / `READONLY_PASSWORD` in `.env` to match; the test is skipped (not
failed) if these are left blank.

## Run

```bash
npm test               # headless run, HTML report generated
npm run test:report    # open the last HTML report
npx playwright test tests/parts-crud.spec.ts   # run a single file
```

Tests run with `workers: 1` (see `playwright.config.ts`) because several suites share mutable
server-side state (categories, IPNs); this keeps runs deterministic at the cost of some wall-clock
time, which is an acceptable trade-off for a CRUD-heavy suite of this size.

## Design notes

- **Auth**: a worker-scoped fixture (`fixtures/api.fixtures.ts`) exchanges the configured
  username/password for an API token once via `GET /api/user/token/`, then all tests reuse that
  token through an `authedRequest` fixture — avoids re-authenticating per test.
- **Data-driven**: `filtering-pagination-search.spec.ts` loops the same assertion body over the
  boolean functional filters (`assembly`, `component`, `trackable`, `purchaseable`, `salable`,
  `active`) instead of duplicating six near-identical tests.
- **Unreachable instance**: the token fixture throws a descriptive error (naming `BASE_URL` and
  suggesting `docker compose up`) instead of letting requests hang/time out silently.

## Corrections made against the live instance

The first draft of this suite was written from the static API schema docs
(`agents/context/api-schema-summary.md`) without a running instance. Running it against a real
`docker compose up` instance surfaced the following, all now fixed and reflected in both the code
and `agents/context/api-schema-summary.md` — this is the "iterative refinement" the assessment's
video requirement asks to capture:

1. **`httpCredentials` (Playwright's challenge-response Basic auth) never fires against this
   API.** InvenTree's `401` response carries no `WWW-Authenticate` header, so Playwright — which,
   unlike `curl -u`, only sends Basic auth *after* such a challenge (RFC 7235) — never sends
   credentials at all. Fixed by sending the `Authorization: Basic ...` header preemptively
   (`fixtures/api.fixtures.ts`, `tests/edge-cases.spec.ts`).
2. **`GET /api/part/` only returns the paginated `{count, results, ...}` envelope when a
   `limit`/`offset` param is present**; without one it returns a bare JSON array. Every list call
   that reads `.results` now explicitly passes `limit=`.
3. **A user created directly via the Django shell (`User.objects.create(...)`) has no
   `UserProfile`**, which the app assumes always exists — `GET /api/user/token/` for such a user
   crashes with a `500` (`RelatedObjectDoesNotExist: User has no profile`), not a clean `401`/`403`.
   Fixed by also creating the `UserProfile` (see "Setup" above); this cost real debugging time
   since the symptom (a 500 on token fetch) doesn't obviously point at "missing profile row".
4. **Deleting a part is unconditionally rejected while `active=true`** (`400`,
   `"Cannot delete this part as it is still active"`), *regardless of whether anything
   references it*. The original API-P-10 case assumed stock references specifically block
   deletion (by analogy with BOM references); verified this is false for this InvenTree version —
   deactivating a part with stock still attached and then deleting it succeeds (`204`). API-P-07
   and API-P-10 both now deactivate before deleting, and API-P-10 asserts the corrected
   behaviour directly. `test-cases/api-manual-tests.md` API-P-10 has been updated to match.
5. **`DELETE /api/part/category/{id}/` requires a JSON body** (`delete_child_categories`,
   `delete_parts` booleans) — a bodyless DELETE returns `400`, "This field is required", and
   deletes nothing. Fixed in API-C-05/06 and API-R-05.
6. **BOM lines live at `/api/bom/`, not `/api/bom-item/`** (the guessed path 404'd). Fixed in
   API-R-06/07.
7. **Parameter templates live at `/api/parameter/template/`, not `/api/part/parameter/template/`**
   (discovered while seeding UI test fixtures, but corrected here too since the original context
   summary had the same wrong guess).
8. **DRF's `BooleanField` coerces common truthy/falsy strings** (`"yes"`, `"true"`, `"1"`, ...)
   rather than rejecting them as invalid — `assembly: "yes"` returns `201` with `assembly: true`.
   API-V-08 now sends a genuinely non-coercible value (a nested object) to test real type
   validation.
9. **Postgres's collation-based `ordering=` doesn't match either plain codepoint comparison or
   JS's `localeCompare`.** Reimplementing the server's sort client-side turned out to be a dead
   end; API-F-10 now asserts the algorithm-independent property that actually holds — descending
   is the exact reverse of ascending for the same (page-scoped) result set — rather than trying to
   independently re-derive the order.
10. A boundary-length test (API-V-03) used a fixed 100-`A` string for `name`, which collided with
    itself on repeated suite runs (`Part.name` is part of a `(name, IPN, revision)` uniqueness
    set). Fixed with a unique-but-still-exactly-100-char generator (`uniqueStringOfLength`).
