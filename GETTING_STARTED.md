# Getting Started

You're new to this repo and want everything running — test suites green, InvenTree up, nothing
guessed. Follow this top to bottom; it's the exact sequence that works. For *why* things are
built this way, or the full list of real issues found while building it, see the root
[`README.md`](README.md) — this file only covers *doing*, not *deciding*.

Total time: ~15 minutes, most of it waiting on Docker.

## 0. Prerequisites

- **Docker Desktop** (or another Docker Engine) — running, not just installed
- **Node.js 20+** and npm
- **git**

Check you have them:

```bash
docker --version && node --version && npm --version
```

## 1. Clone this repo

```bash
git clone <this-repo-url>
cd inventree-parts-qa-assessment   # or whatever you named it locally
```

## 2. Stand up InvenTree

This repo doesn't bundle InvenTree — it tests a real instance you run separately, anywhere
(this machine, a VM, CI). Clone it and bring up its own Docker stack:

```bash
git clone https://github.com/inventree/InvenTree.git
cd InvenTree/contrib/container
docker compose up -d
```

Wait for it to report healthy (first boot pulls several images and runs migrations — a few
minutes):

```bash
until docker compose ps --format '{{.Service}}: {{.Status}}' | grep -qE 'inventree-server.*\(healthy\)'; do sleep 5; done
echo "InvenTree is up."
```

**Two one-time steps the stock image needs that aren't defaults** — skip either and the next
steps fail in confusing ways:

```bash
# The Platform UI's own JS bundle 404s until this runs (collectstatic never runs on first boot)
docker compose exec inventree-server invoke static

# No superuser exists unless you create one — these are the credentials every automation
# project's .env.example expects
docker compose exec \
  -e DJANGO_SUPERUSER_USERNAME=admin \
  -e DJANGO_SUPERUSER_EMAIL=admin@example.com \
  -e DJANGO_SUPERUSER_PASSWORD=inventree \
  inventree-server sh -c "cd src/backend/InvenTree && python3 manage.py createsuperuser --noinput"
```

Confirm it's really up: open `http://localhost:8000` in a browser, or `curl -s -o /dev/null -w
'%{http_code}\n' http://localhost:8000/api/` — expect `200`.

## 3. Run the API suite

Change back to *this* repo (not the `InvenTree` checkout from step 2), into `automation/api`:

```bash
npm install
cp .env.example .env        # defaults already match steps above — nothing to edit
npm test
```

Expect `60 passed`. This suite creates its own throwaway parts/categories per test and deletes
them all automatically when the run finishes (`globalTeardown`) — nothing to clean up yourself.

**One extra fixture this suite wants** (for the "insufficient permission" test — it's skipped,
not failed, if you don't set this up). Run this from `InvenTree/contrib/container` (same place
as step 2's commands, not from this repo):

```bash
docker compose exec inventree-server \
  sh -c "cd src/backend/InvenTree && python3 manage.py shell -v 0" <<'PY'
from django.contrib.auth import get_user_model
from users.models import UserProfile
User = get_user_model()
u, _ = User.objects.get_or_create(username="readonly", defaults={"email": "readonly@example.com"})
u.set_password("readonlypass")
u.is_superuser = False
u.save()
UserProfile.objects.get_or_create(user=u)   # without this row, token auth 500s — see README
PY
```

## 4. Run the UI suite

```bash
cd ../ui
npm install
npx playwright install --with-deps chromium   # downloads a browser binary, first time only
cp .env.example .env
npm run seed     # creates "Electronics" category + "Resistance" parameter template by name
npm test
```

Expect `10 passed`. A browser window doesn't pop up (headless by default) — if you want to
watch it happen, `npm run test:ui` opens Playwright's interactive UI mode instead.

## 5. Read the results

- Terminal output tells you pass/fail immediately.
- `npx playwright show-report` (either project) opens the last HTML report — richer detail per
  test, and for the UI suite, traces/screenshots/video on any failure.
- Nothing needs cleaning up afterward — both suites tear down their own test data on every run.

## If something doesn't match this

- **UI pages render blank / 404s in the browser console** → step 2's `invoke static` didn't run.
- **Can't log in / `createsuperuser` errors** → step 2's superuser step didn't run, or you're
  pointed at a different InvenTree instance than you think (`.env`'s `BASE_URL`).
- **`GET /api/user/token/` returns 500** → a user exists without a `UserProfile` row (only
  matters if you created the `readonly` user by hand differently than shown above).
- **PC-06 / cross-functional-flow fail on "category not found"** → step 4's `npm run seed`
  wasn't run.
- **UI suite times out logging in, only on the very first `npm test` against a brand-new
  instance** → this is expected and already handled: the first request InvenTree ever serves
  after `docker compose up` is meaningfully slower than every one after it. `LoginPage.login()`
  waits up to 60s for the post-login redirect specifically to absorb this. If it still times out
  past that, something else is wrong — check `docker compose logs inventree-server`.
- Anything else: the root [`README.md`](README.md) → "Corrections made against the live
  instance" is a list of every real issue hit building this, in the order they were found —
  good odds whatever you're seeing is already on it.

## What to look at next

| Want to... | Look at |
|---|---|
| See the manual test cases these suites automate | `test-cases/ui-manual-tests.md`, `test-cases/api-manual-tests.md` |
| Understand the automation architecture, file by file | `automation/api/README.md`, `automation/ui/README.md` |
| See how the agent built this, prompt by prompt | `agents/prompts.md` |
| See the full "what was found wrong and fixed" narrative | root `README.md` |
| Add a new test | Pick a manual test-case ID without automation yet, follow the pattern in the nearest existing spec file — page objects for UI, `authedRequest` fixture for API |
